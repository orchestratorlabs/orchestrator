import json
import os
import re

from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
RAG_DIR = BASE_DIR / "rag"
RAG_REGISTRY_FILE = RAG_DIR / "orchestrator_rag_registry.txt"
BUTTON_RAG_FILE = RAG_DIR / "orchestrator_button_health_score_rag.txt"

COMPONENT_RAG_MAP = {
    "button": BUTTON_RAG_FILE,
}

SUPPORTED_COMPONENTS = list(COMPONENT_RAG_MAP.keys())

# ---------------------------------------------------------------------------
# RAG helpers
# ---------------------------------------------------------------------------

def get_rag_directory_path():
    return RAG_DIR


def load_rag_file(file_path):
    path = Path(file_path)
    if not path.exists():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return None


def load_rag_manifest():
    """Build an in-memory manifest of every .txt file in the rag directory."""
    rag_dir = get_rag_directory_path()
    if not rag_dir.exists():
        return []

    manifest = []
    for file_path in sorted(rag_dir.glob("*.txt")):
        content = load_rag_file(file_path)
        if content is None:
            continue
        manifest.append({
            "fileName": file_path.name,
            "filePath": str(file_path),
            "fileType": "text/plain",
            "characterCount": len(content),
            "preview": content[:300],
        })
    return manifest


def get_registry_preview():
    text = load_rag_file(RAG_REGISTRY_FILE)
    return text[:500] if text else None


def get_button_rag_preview():
    text = load_rag_file(BUTTON_RAG_FILE)
    return text[:1200] if text else None


def resolve_component_rag(component_type):
    """Return (text, error_message). text is None when the component is unsupported."""
    normalized = (component_type or "button").strip().lower()
    rag_path = COMPONENT_RAG_MAP.get(normalized)
    if rag_path is None:
        return None, (
            f"'{normalized}' is not a currently supported component type. "
            f"OrchestratoR MVP supports: {', '.join(SUPPORTED_COMPONENTS)}. "
            "Falling back to button accessibility context is not automatic — "
            "please resubmit with componentType set to 'button'."
        )
    text = load_rag_file(rag_path)
    if text is None:
        return None, f"RAG file for component type '{normalized}' could not be read from the backend rag directory."
    return text, None


# ---------------------------------------------------------------------------
# Claude helpers
# ---------------------------------------------------------------------------

def get_claude_client():
    """Return an Anthropic client if ANTHROPIC_API_KEY is set, otherwise None."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception:
        return None


def get_claude_model():
    return os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6").strip()


def format_evaluation_context_block(evaluation_context):
    """Return a formatted string block describing the current evaluation result."""
    if not evaluation_context:
        return "Not provided."

    mode = evaluation_context.get("evaluatedMode", "unknown")
    score = evaluation_context.get("score", "N/A")
    pass_count = evaluation_context.get("passCount", 0)
    unknown_count = evaluation_context.get("unknownCount", 0)
    fail_count = evaluation_context.get("failCount", 0)
    findings = evaluation_context.get("findings", [])

    mode_label = "Dark mode" if mode == "dark" else "Light mode" if mode == "light" else mode

    lines = [
        f"Evaluated mode: {mode_label}",
        f"Score: {score}/100",
        f"Pass: {pass_count}",
        f"Unknown: {unknown_count}",
        f"Fail: {fail_count}",
    ]
    if findings:
        lines.append("Findings:")
        for f in findings:
            rule = f.get("ruleName") or f.get("rule") or "Unknown rule"
            status = f.get("status", "?")
            evidence = f.get("evidence") or f.get("message") or ""
            lines.append(f"  [{status}] {rule}: {evidence}")

    return "\n".join(lines)


def build_response_guidance(evaluation_context):
    """Return explicit response guidance based on the current evaluation state."""
    if not evaluation_context:
        return ""

    fail_count = evaluation_context.get("failCount", 0)
    score = evaluation_context.get("score", 0)

    if fail_count == 0 and score == 100:
        return """
RESPONSE GUIDANCE (PASS STATE):
- The evaluation result shows ALL rules PASSED with a score of 100/100 and ZERO failures.
- Answer this question by explaining WHY the evaluation passed.
- Reference the specific passing findings listed in CURRENT EVALUATION RESULT.
- Do NOT suggest fixes, remediation steps, or token changes — there are no failures.
- Do NOT mention failure conditions or contrast issues as if they need to be resolved.
- Use the evaluated mode name (e.g. "Dark mode") in your answer.
"""
    elif fail_count and fail_count > 0:
        return """
RESPONSE GUIDANCE (FAIL STATE):
- The evaluation result shows one or more FAILURES.
- Explain the failing rules and how to fix them.
- Reference the specific failing findings listed in CURRENT EVALUATION RESULT.
"""
    return ""


def build_rag_prompt(question, component_type, registry_text, component_rag_text, component_context, evaluation_context=None):
    eval_block = format_evaluation_context_block(evaluation_context)
    response_guidance = build_response_guidance(evaluation_context)

    return f"""You are OrchestratoR, an accessibility co-pilot. Answer the user's accessibility question using only the RAG context provided below.
{response_guidance}
CRITICAL INSTRUCTIONS:
- Your entire response must be a single valid JSON object.
- Do NOT include any text before or after the JSON.
- Do NOT wrap the JSON in markdown code fences (no ```json, no ```).
- Do NOT include explanations, introductions, or closing remarks.
- Start your response with {{ and end with }}.

Required JSON shape:
{{
  "status": "success",
  "message": "OrchestratoR Claude response loaded.",
  "question": "<echo the question>",
  "componentContext": "<echo componentContext>",
  "answer": "<plain-text answer to the question>",
  "apiMode": "claude",
  "outputFormat": {{
    "accessibilityHealthScore": "<guidance string>",
    "summary": "<one sentence describing the accessibility issue or rule>",
    "findings": {{
      "pass": [],
      "unknown": [],
      "fail": []
    }},
    "recommendedFixes": []
  }}
}}

---
RAG REGISTRY CONTEXT:
{registry_text[:500]}

---
COMPONENT RAG CONTEXT ({component_type}):
{component_rag_text[:2000]}

---
COMPONENT CONTEXT FROM EVALUATOR:
{component_context or "Not provided."}

---
CURRENT EVALUATION RESULT:
{eval_block}

---
USER QUESTION:
{question}

Remember: respond with the JSON object only. No markdown. No code fences. No extra text.
"""


def parse_claude_json_response(raw_text):
    """
    Robustly parse a JSON object from Claude's raw response text.
    Handles: raw JSON, ```json fences, ``` fences, and leading/trailing prose.
    Returns parsed dict on success, raises ValueError on failure.
    """
    text = raw_text.strip()

    # Strip ```json ... ``` or ``` ... ``` fences
    if text.startswith("```"):
        text = text.lstrip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        end_fence = text.rfind("```")
        if end_fence != -1:
            text = text[:end_fence]
        text = text.strip()

    # If still not starting with {, find the first { and last } to extract the object
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("No JSON object found in Claude response.")
        text = text[start:end + 1]

    return json.loads(text)


def call_claude(question, component_type, registry_text, component_rag_text, component_context, evaluation_context=None):
    """
    Call Claude with the RAG prompt.
    Returns (parsed_dict, api_mode, error_type, error_message).
    api_mode is 'claude' on success, 'mock' when no key, 'error' on failure.
    """
    client = get_claude_client()
    if client is None:
        return None, "mock", None, None

    prompt = build_rag_prompt(
        question, component_type, registry_text, component_rag_text, component_context, evaluation_context
    )

    raw = None
    try:
        response = client.messages.create(
            model=get_claude_model(),
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        parsed = parse_claude_json_response(raw)
        parsed["apiMode"] = "claude"
        parsed.setdefault("status", "success")
        return parsed, "claude", None, None
    except (json.JSONDecodeError, ValueError) as e:
        error_type = type(e).__name__
        error_message = f"Claude response could not be parsed as JSON: {str(e)}"
        raw_preview = raw[:500] if raw else None
        print(f"[OrchestratoR] Claude JSON parse error — {error_type}: {error_message}")
        print(f"[OrchestratoR] Claude raw preview: {raw_preview}")
        return None, "error", error_type, error_message, raw_preview
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e)
        print(f"[OrchestratoR] Claude API error — {error_type}: {error_message}")
        return None, "error", error_type, error_message, None


# ---------------------------------------------------------------------------
# Static fallback response
# ---------------------------------------------------------------------------

STATIC_ANSWER_FAILURE = (
    "OrchestratoR loaded the backend RAG registry and button accessibility rule context. "
    "For disabled text contrast, compare the disabled label color against the disabled background color. "
    "If the contrast ratio is below the WCAG 2.1 text contrast threshold, update the disabled text color, "
    "rerun the checker, and confirm the finding changes from Fail to Pass."
)

STATIC_OUTPUT_FORMAT_FAILURE = {
    "accessibilityHealthScore": "Use current evaluator score when available. If no score is provided, respond with guidance only.",
    "summary": "Disabled text contrast compares the disabled label color against the disabled button background color.",
    "findings": {
        "pass": [],
        "unknown": [],
        "fail": [
            "Disabled-state text contrast may fail when the label color is too close to the disabled background color."
        ],
    },
    "recommendedFixes": [
        "Update the disabled text color to a darker accessible value, rerun the checker, and confirm the finding changes from Fail to Pass."
    ],
}


def build_static_response(evaluation_context):
    """Return (answer, output_format) appropriate for the current evaluation state."""
    if not evaluation_context:
        return STATIC_ANSWER_FAILURE, STATIC_OUTPUT_FORMAT_FAILURE

    fail_count = evaluation_context.get("failCount", 0)
    score = evaluation_context.get("score", 0)
    pass_count = evaluation_context.get("passCount", 0)
    mode = evaluation_context.get("evaluatedMode", "unknown")
    findings = evaluation_context.get("findings", [])
    mode_label = "Dark mode" if mode == "dark" else "Light mode" if mode == "light" else "The evaluated mode"

    # --- Pass state ---
    if fail_count == 0 and score == 100:
        passing_rules = [
            f.get("ruleName") or f.get("rule") or "rule"
            for f in findings
            if f.get("status") == "Pass"
        ]
        rules_summary = ", ".join(passing_rules) if passing_rules else f"all {pass_count} evaluated rules"

        answer = (
            f"{mode_label} passed because all {pass_count} evaluated button accessibility rules passed "
            f"with no known failures. The {mode_label} tokens provide sufficient contrast across the "
            f"tested button states, including default, hover, active, disabled, and focused. "
            f"The disabled text token meets the required contrast against the disabled background, "
            f"and the focus styling remains visible. "
            f"Passing rules: {rules_summary}."
        )
        output_format = {
            "accessibilityHealthScore": f"{score}/100 — all rules passed.",
            "summary": f"{mode_label} passed all {pass_count} button accessibility rules with no failures.",
            "findings": {
                "pass": [f.get("ruleName") or f.get("rule") or "rule" for f in findings if f.get("status") == "Pass"],
                "unknown": [],
                "fail": [],
            },
            "recommendedFixes": [],
        }
        return answer, output_format

    # --- Failure state ---
    if fail_count > 0:
        failing_findings = [f for f in findings if f.get("status") == "Fail"]

        # Specific handler: text contrast failure (rule-5-text-contrast)
        text_contrast_fail = next(
            (f for f in failing_findings if f.get("ruleId") == "rule-5-text-contrast"),
            None
        )
        if text_contrast_fail:
            evidence = text_contrast_fail.get("evidence", "")
            ratio_match = re.search(r"(\d+\.\d+):1", evidence)
            ratio_str = f"{ratio_match.group(1)}:1" if ratio_match else "below 4.5:1"

            answer = (
                f"Disabled text contrast failed in {mode_label}. "
                f"The likely failing token pair is --Text-Disabled and --Bg-Disabled. "
                f"OrchestratoR measured a contrast ratio of {ratio_str}, which is below the WCAG 2.1 AA threshold of 4.5:1. "
                f"The disabled text token is too light against the disabled background. "
                f"The approved design-system value is #494949. "
                f"Update --Text-Disabled to #494949, then rerun the accessibility check. "
                f"If fixed, the score should move from {score}/100 to 100/100."
            )
            output_format = {
                "accessibilityHealthScore": f"{score}/100 — disabled text contrast failing in {mode_label}.",
                "summary": f"Disabled text contrast failed in {mode_label}: --Text-Disabled does not meet 4.5:1 against --Bg-Disabled. Approved fix: #494949.",
                "findings": {
                    "pass": [f.get("ruleName") or f.get("rule") or "rule" for f in findings if f.get("status") == "Pass"],
                    "unknown": [f.get("ruleName") or f.get("rule") or "rule" for f in findings if f.get("status") == "Unknown"],
                    "fail": [text_contrast_fail.get("ruleName") or "Text Contrast"],
                },
                "recommendedFixes": [
                    "Update --Text-Disabled to #494949 (approved design-system value), then rerun the accessibility check."
                ],
            }
            return answer, output_format

        # Generic failure handler for other rules
        failing_names = [f.get("ruleName") or f.get("rule") or "unknown rule" for f in failing_findings]
        failing_recs = [f.get("recommendation", "") for f in failing_findings if f.get("recommendation")]
        answer = (
            f"{mode_label} has {fail_count} failing rule(s): {', '.join(failing_names)}. "
            f"Current score: {score}/100. "
            f"Review the findings and apply the recommended fixes, then rerun the accessibility check."
        )
        output_format = {
            "accessibilityHealthScore": f"{score}/100 — {fail_count} rule(s) failing in {mode_label}.",
            "summary": f"{mode_label} has {fail_count} failing accessibility rule(s): {', '.join(failing_names)}.",
            "findings": {
                "pass": [f.get("ruleName") or f.get("rule") or "rule" for f in findings if f.get("status") == "Pass"],
                "unknown": [f.get("ruleName") or f.get("rule") or "rule" for f in findings if f.get("status") == "Unknown"],
                "fail": failing_names,
            },
            "recommendedFixes": failing_recs,
        }
        return answer, output_format

    return STATIC_ANSWER_FAILURE, STATIC_OUTPUT_FORMAT_FAILURE


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    return "<h1>OrchestratoR Flask Server Works</h1>"


@app.route("/echo", methods=["POST"])
def echo():
    data = request.get_json()
    component_code = data.get("componentCode", "")
    return jsonify({
        "status": "success",
        "message": "OrchestratoR received the component code for evaluation.",
        "echo": component_code,
    })


@app.route("/mock-llm", methods=["POST"])
def mock_llm():
    data = request.get_json()
    component_code = data.get("componentCode", "")
    mock_result = {
        "status": "success",
        "message": "Mock LLM complete: 100/100",
        "score": 100,
        "summary": "The component passed the current WCAG 2.1 accessibility checks with no verified accessibility issues.",
        "findings": [
            {
                "status": "Pass",
                "rule": "Semantic button",
                "message": "The component uses a native button element.",
            },
            {
                "status": "Pass",
                "rule": "Accessible name",
                "message": "The button includes visible text that can act as an accessible name.",
            },
            {
                "status": "Pass",
                "rule": "Keyboard interaction",
                "message": "The component remains operable through standard button keyboard behavior.",
            },
            {
                "status": "Pass",
                "rule": "Focus indicator contrast",
                "message": "No verified focus indicator contrast issue was found in the current test state.",
            },
        ],
        "echo": component_code,
    }
    return jsonify(mock_result)


@app.route("/rag-directory", methods=["GET"])
def rag_directory():
    rag_dir = get_rag_directory_path()
    if not rag_dir.exists():
        return jsonify({
            "status": "error",
            "message": "Backend rag directory does not exist.",
            "ragDirectory": str(rag_dir),
            "files": [],
        }), 500

    manifest = load_rag_manifest()
    return jsonify({
        "status": "success",
        "message": f"{len(manifest)} RAG file(s) loaded from the backend rag directory.",
        "ragDirectory": str(rag_dir),
        "files": manifest,
    })


@app.route("/rag-query", methods=["POST"])
def rag_query():
    data = request.get_json()
    question = data.get("question", "")
    component_context = data.get("componentContext", "")
    component_type = data.get("componentType", "button")
    use_claude = data.get("useClaude", False)
    evaluation_context = data.get("evaluationContext", None)

    registry_text = load_rag_file(RAG_REGISTRY_FILE)
    if not registry_text:
        return jsonify({
            "status": "error",
            "message": "RAG registry file could not be loaded from the backend rag directory.",
            "question": question,
        }), 500

    component_rag_text, component_error = resolve_component_rag(component_type)
    if component_error:
        return jsonify({
            "status": "error",
            "message": component_error,
            "question": question,
            "componentType": component_type,
        }), 400

    registry_preview = registry_text[:500]
    rag_preview = component_rag_text[:1200]

    static_answer, static_output_format = build_static_response(evaluation_context)

    # --- Claude path ---
    if use_claude:
        call_result = call_claude(
            question, component_type, registry_text, component_rag_text, component_context, evaluation_context
        )
        # Success returns 4-tuple; parse/API errors return 5-tuple with raw_preview
        parsed, api_mode, error_type, error_message = call_result[:4]
        raw_preview = call_result[4] if len(call_result) == 5 else None

        if api_mode == "mock":
            # API key not configured — fall through to static response with apiMode flag
            pass
        elif api_mode == "claude" and parsed:
            parsed.setdefault("registryPreview", registry_preview)
            parsed.setdefault("ragPreview", rag_preview)
            return jsonify(parsed)
        else:
            # Claude call failed — return safe error fallback with sanitized debug fields
            error_body = {
                "status": "error",
                "message": "OrchestratoR could not complete the Claude request. Returning static fallback.",
                "question": question,
                "componentContext": component_context,
                "registryPreview": registry_preview,
                "ragPreview": rag_preview,
                "answer": static_answer,
                "apiMode": "error",
                "claudeErrorType": error_type,
                "claudeErrorMessage": error_message,
                "outputFormat": static_output_format,
            }
            if raw_preview is not None:
                error_body["claudeRawPreview"] = raw_preview
            return jsonify(error_body)

    # --- Static / mock path ---
    api_mode = "mock" if use_claude else "static"
    return jsonify({
        "status": "success",
        "message": "Backend RAG context loaded successfully.",
        "question": question,
        "componentContext": component_context,
        "registryPreview": registry_preview,
        "ragPreview": rag_preview,
        "answer": static_answer,
        "apiMode": api_mode,
        "outputFormat": static_output_format,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5001)
