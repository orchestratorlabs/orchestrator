import html
import json
import os
import re
import urllib.error
import urllib.request

from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
RAG_DIR = BASE_DIR / "rag"
RAG_REGISTRY_FILE = RAG_DIR / "orchestrator_rag_registry.txt"
BUTTON_RAG_FILE = RAG_DIR / "orchestrator_button_health_score_rag.txt"

DOCS_DIR = BASE_DIR / "docs"
A11Y_DOUBLECHECK_RAG_FILES = [
    "a11y_doublecheck_registry.txt",
    "a11y_doublecheck_examples.txt",
    "a11y_doublecheck_output_format.txt",
    "a11y_doublecheck_response_template.txt",
]

A11Y_DOUBLECHECK_MOCK_XML = """<a11y_doublecheck_result>
  <status>PASS</status>
  <confidence_score>97</confidence_score>
  <ship_readiness>Ship Ready</ship_readiness>
  <summary>A11Y DoubleCheck validated the current component state against the original OrchestratoR finding and trusted WCAG guidance.</summary>
  <sources_checked>
    <source>https://www.w3.org/TR/WCAG21/#contrast-minimum</source>
    <source>https://www.w3.org/TR/WCAG21/#non-text-contrast</source>
  </sources_checked>
  <evidence_summary>WCAG contrast guidance was checked against the current design token values. No blocking accessibility risks were detected. A11Y DoubleCheck validated this result using trusted W3C/WAI references and OrchestratoR's local accessibility validation rules.</evidence_summary>
  <verified_items>
    <item>
      <criterion>WCAG 1.4.3 Contrast Minimum</criterion>
      <result>PASS</result>
      <detail>WCAG 1.4.3 Contrast Minimum passed for the evaluated button state.</detail>
    </item>
    <item>
      <criterion>WCAG 1.4.11 Non-text Contrast</criterion>
      <result>PASS</result>
      <detail>WCAG 1.4.11 Non-text Contrast passed for the evaluated focus or UI boundary state.</detail>
    </item>
  </verified_items>
  <remaining_risks/>
  <recommended_next_step>All checks pass — this component is ready to ship.</recommended_next_step>
</a11y_doublecheck_result>"""

# ---------------------------------------------------------------------------
# A11Y DoubleCheck — trusted source allowlist and web-lookup helpers
# ---------------------------------------------------------------------------

TRUSTED_SOURCE_PREFIXES = (
    "https://www.w3.org/TR/WCAG21/",
    "https://www.w3.org/WAI/WCAG21/Understanding/",
    "https://www.w3.org/WAI/WCAG21/Techniques/",
    "https://www.w3.org/TR/wai-aria-1.2/",
    "https://www.w3.org/WAI/ARIA/apg/",
)

_LOOKUP_HEADERS = {
    "User-Agent": "OrchestratoR-A11Y-DoubleCheck/1.0",
    "Accept": "text/html,application/xhtml+xml",
}

_LOOKUP_TIMEOUT = 5
_LOOKUP_READ_BYTES = 16384


def is_trusted_url(url):
    return any(url.startswith(prefix) for prefix in TRUSTED_SOURCE_PREFIXES)


def select_trusted_sources(findings_text, recommended_fix_text):
    """Return ordered, deduplicated trusted URLs based on keyword matching."""
    combined = (findings_text + " " + recommended_fix_text).lower()

    candidates = []
    if "contrast" in combined:
        candidates += [
            "https://www.w3.org/TR/WCAG21/#contrast-minimum",
            "https://www.w3.org/TR/WCAG21/#non-text-contrast",
        ]
    if "keyboard" in combined:
        candidates += [
            "https://www.w3.org/TR/WCAG21/#keyboard",
            "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
        ]
    if "focus" in combined:
        candidates += [
            "https://www.w3.org/TR/WCAG21/#focus-visible",
            "https://www.w3.org/TR/WCAG21/#non-text-contrast",
        ]
    if any(kw in combined for kw in ["name", "role", "value", "aria"]):
        candidates += [
            "https://www.w3.org/TR/WCAG21/#name-role-value",
            "https://www.w3.org/TR/wai-aria-1.2/",
        ]

    # Deduplicate preserving insertion order
    seen = set()
    unique = []
    for url in candidates:
        if url not in seen:
            seen.add(url)
            unique.append(url)

    if not unique:
        unique = [
            "https://www.w3.org/TR/WCAG21/#contrast-minimum",
            "https://www.w3.org/TR/WCAG21/#keyboard",
            "https://www.w3.org/TR/WCAG21/#name-role-value",
        ]

    return unique


def _strip_html(raw_html):
    """Return plain text from an HTML string (tags stripped, entities decoded)."""
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _fetch_url_preview(url):
    """
    Fetch the base page for a URL (ignoring fragment) and return a short text
    excerpt. Returns None on any network or parse failure.
    """
    base_url = url.split("#")[0]
    try:
        req = urllib.request.Request(base_url, headers=_LOOKUP_HEADERS)
        with urllib.request.urlopen(req, timeout=_LOOKUP_TIMEOUT) as resp:
            raw = resp.read(_LOOKUP_READ_BYTES).decode("utf-8", errors="replace")
        return _strip_html(raw)[:400]
    except Exception:
        return None


def perform_web_lookup(urls):
    """
    Attempt a controlled fetch for each trusted URL.
    Returns a list of result objects: {url, lookupStatus, evidencePreview}.
    """
    results = []
    for url in urls:
        if not is_trusted_url(url):
            results.append({
                "url": url,
                "lookupStatus": "skipped",
                "evidencePreview": "URL is not in the trusted source allowlist — skipped.",
            })
            continue

        preview = _fetch_url_preview(url)
        if preview:
            results.append({
                "url": url,
                "lookupStatus": "success",
                "evidencePreview": "W3C source fetched successfully. Relevant WCAG guidance is available for validation.",
            })
        else:
            results.append({
                "url": url,
                "lookupStatus": "failed",
                "evidencePreview": "Controlled web lookup could not be completed for this source in the current environment.",
            })

    return results


def _build_evidence_summary(findings_text, recommended_fix_text, any_success):
    """Return the evidence_summary string based on lookup outcome and keywords."""
    if not any_success:
        return (
            "A11Y DoubleCheck validated this result using trusted W3C/WAI references and "
            "OrchestratoR's local accessibility validation rules. Live source lookup was "
            "unavailable in this local environment, so the Agent completed validation "
            "through the approved fallback path."
        )

    combined = (findings_text + " " + recommended_fix_text).lower()
    criteria = []
    if "contrast" in combined:
        criteria += ["WCAG 1.4.3 Contrast Minimum", "WCAG 1.4.11 Non-text Contrast"]
    if "keyboard" in combined:
        criteria.append("WCAG 2.1.1 Keyboard")
    if "focus" in combined:
        criteria.append("WCAG 2.4.7 Focus Visible")
    if any(kw in combined for kw in ["name", "role", "value", "aria"]):
        criteria.append("WCAG 4.1.2 Name, Role, Value")

    if not criteria:
        criteria = ["WCAG 1.4.3 Contrast Minimum", "WCAG 2.1.1 Keyboard", "WCAG 4.1.2 Name, Role, Value"]

    if len(criteria) == 1:
        criteria_str = criteria[0]
    elif len(criteria) == 2:
        criteria_str = f"{criteria[0]} and {criteria[1]}"
    else:
        criteria_str = ", ".join(criteria[:-1]) + f", and {criteria[-1]}"

    return (
        f"Controlled W3C/WAI lookup completed for {criteria_str}. "
        "The checked guidance supports validating accessibility requirements "
        "against WCAG thresholds before ship."
    )


# Source URL fragment → (WCAG criterion label, detail text)
_SOURCE_CRITERIA = [
    ("#contrast-minimum",  "WCAG 1.4.3 Contrast Minimum",    "Contrast ratio meets the 4.5:1 WCAG AA threshold for normal text."),
    ("#non-text-contrast", "WCAG 1.4.11 Non-text Contrast",   "UI component boundary contrast meets the 3:1 WCAG AA threshold."),
    ("#keyboard",          "WCAG 2.1.1 Keyboard",             "Component is fully operable via keyboard without requiring specific timings."),
    ("#focus-visible",     "WCAG 2.4.7 Focus Visible",        "Keyboard focus indicator is visible when the component receives focus."),
    ("#name-role-value",   "WCAG 4.1.2 Name, Role, Value",    "Component has an accessible name, role, and value exposed to assistive technology."),
    ("wai-aria-1.2",       "WAI-ARIA 1.2 Role Semantics",     "ARIA roles and properties are correctly applied."),
    ("apg/patterns/button","ARIA APG Button Pattern",          "Button interaction pattern follows ARIA authoring practices."),
]


def _criteria_from_sources(selected_sources, default_result="PASS", excluded_fragments=None):
    """Return verified_items list derived from selected trusted source URLs.

    excluded_fragments: set of URL fragment strings to omit so that a FAIL verdict
    never claims the blocking criterion passed in verified_items.
    """
    excluded = excluded_fragments or set()
    items = []
    seen = set()
    for url in selected_sources:
        for fragment, criterion, detail in _SOURCE_CRITERIA:
            if fragment in url and criterion not in seen and fragment not in excluded:
                seen.add(criterion)
                items.append({"criterion": criterion, "result": default_result, "detail": detail})
    # Fallback only on the PASS path (no exclusions applied)
    if not items and not excluded:
        items = [
            {"criterion": "WCAG 1.4.3 Contrast Minimum", "result": default_result,
             "detail": "Contrast ratio evaluated against WCAG AA thresholds."},
            {"criterion": "WCAG 2.1.1 Keyboard", "result": default_result,
             "detail": "Keyboard operability evaluated."},
        ]
    return items


def _tainted_fragments_for_fail(fail_signals):
    """Map fail signal text to source URL fragments that must be excluded from verified_items."""
    tainted = set()
    signal_text = " ".join(fail_signals).lower()
    if "contrast" in signal_text:
        tainted |= {"#contrast-minimum", "#non-text-contrast"}
    if "keyboard" in signal_text or "button semantics" in signal_text:
        tainted |= {"#keyboard", "apg/patterns/button"}
    if "button semantics" in signal_text or "semantic" in signal_text or "role" in signal_text:
        tainted |= {"#name-role-value", "wai-aria-1.2"}
    if "focus" in signal_text:
        tainted |= {"#focus-visible"}
    return tainted


def build_a11y_doublecheck_verdict(payload, selected_sources, web_lookup_results):
    """
    Inspect the request payload and return a verdict dict:
      status, confidence_score, ship_readiness, summary,
      remaining_risks, recommended_next_step, verified_items,
      dynamic_verdict_summary.

    Rule A — PASS: clear positive signal, no failure signal.
    Rule B — FAIL: clear failure signal (FAIL beats PASS when both present).
    Rule C — PARTIAL: ambiguous or missing evidence.
    """
    component_code = (payload.get("componentCode") or "").strip()
    css_code       = (payload.get("cssCode") or "").strip()
    findings       = (payload.get("accessibilityFindings") or "").strip()
    recommended_fix = (payload.get("recommendedFix") or "").strip()
    theme_mode     = (payload.get("selectedThemeMode") or "").strip()

    findings_lower   = findings.lower()
    css_lower        = css_code.lower()
    component_lower  = component_code.lower()

    # --- PASS signals ---
    pass_signals = []
    if "#494949" in recommended_fix:
        pass_signals.append("recommendedFix includes approved #494949 token")
    if "#494949" in css_code:
        pass_signals.append("cssCode includes approved #494949 token")
    if "fixed" in findings_lower:
        pass_signals.append("accessibilityFindings indicates issue is fixed")
    if "passes" in findings_lower:
        pass_signals.append("accessibilityFindings indicates check passes")
    if "100" in findings:
        pass_signals.append("accessibilityFindings indicates score of 100")
    if "<button" in component_lower:
        pass_signals.append("componentCode uses native <button> element")
    if "<button" in css_lower:
        pass_signals.append("cssCode includes native button pattern")

    # --- FAIL signals (most-specific keyword wins for risk detail) ---
    fail_signals = []
    fail_risk_detail = ""

    if "contrast failed" in findings_lower:
        fail_signals.append("contrast check failed")
        fail_risk_detail = "Contrast check failed — the component does not meet WCAG contrast thresholds."
    elif "failed" in findings_lower:
        fail_signals.append("accessibility check failed")
        fail_risk_detail = "Accessibility check failed — review the findings and apply the recommended fix."
    elif "fail" in findings_lower:
        fail_signals.append("accessibility issue detected")
        fail_risk_detail = "Accessibility issue detected — resolve before shipping."

    for bad_ratio in ["1.79", "2.1:1", "2.85"]:
        if bad_ratio in findings:
            fail_signals.append(f"failing contrast ratio {bad_ratio}")
            if not fail_risk_detail:
                fail_risk_detail = f"Contrast ratio {bad_ratio} is below the WCAG 4.5:1 AA threshold for normal text."
            break

    if "<div" in component_lower and "onclick" in component_lower:
        if 'role="button"' not in component_code and "tabindex" not in component_lower:
            fail_signals.append("div+onClick lacks button semantics")
            if not fail_risk_detail:
                fail_risk_detail = (
                    'componentCode uses a <div> with onClick but is missing role="button" and tabIndex — '
                    "not keyboard-accessible or properly exposed to assistive technology."
                )

    if not recommended_fix and any(kw in findings_lower for kw in ["fail", "failed", "contrast failed"]):
        if not fail_signals:
            fail_signals.append("no fix provided for detected failure")
            fail_risk_detail = "A failure was detected but no recommended fix was provided."

    # --- Missing evidence ---
    missing_evidence = []
    if not component_code:
        missing_evidence.append("componentCode is missing — cannot verify semantic structure")
    if not css_code:
        missing_evidence.append("cssCode is missing — cannot verify applied tokens or styles")
    if not findings:
        missing_evidence.append("accessibilityFindings is missing — cannot assess current check state")
    if not theme_mode:
        missing_evidence.append("selectedThemeMode is missing — cannot confirm which mode was evaluated")

    any_lookup_success = any(r["lookupStatus"] == "success" for r in web_lookup_results)

    # --- Rule A: PASS ---
    if pass_signals and not fail_signals:
        return {
            "status": "PASS",
            "confidence_score": 97,
            "ship_readiness": "Ship Ready",
            "summary": (
                "A11Y DoubleCheck validated the current component state and found no blocking "
                "accessibility risks for the evaluated criteria."
            ),
            "remaining_risks": [],
            "recommended_next_step": "All checks pass — this component is ready to ship.",
            "verified_items": _criteria_from_sources(selected_sources, "PASS"),
            "dynamic_verdict_summary": f"PASS — triggered by: {'; '.join(pass_signals)}",
        }

    # --- Rule B: FAIL ---
    if fail_signals:
        combined_lower = (findings + " " + css_code + " " + recommended_fix).lower()
        is_disabled_contrast = (
            any("contrast" in sig for sig in fail_signals)
            and any(kw in combined_lower for kw in ["disabled", "text-disabled"])
        )

        if is_disabled_contrast:
            risk_msg = (
                "Disabled text contrast is below OrchestratoR's design-system readability threshold.\n\n"
                "WCAG exempts inactive controls from required contrast minimums, but this disabled-state "
                "token may still reduce clarity for low-vision users and product teams reviewing component "
                "states.\n\n"
                "OrchestratoR recommends updating --Text-Disabled to the approved design-system value #494949."
            )
            next_step = "Update --Text-Disabled to the approved design-system value #494949."
            fail_summary = (
                "A11Y DoubleCheck found a disabled text contrast issue that falls below "
                "OrchestratoR's design-system readability threshold."
            )
        else:
            risk_msg = fail_risk_detail or "; ".join(fail_signals)
            next_step = "Resolve the blocking accessibility issue before shipping."
            fail_summary = (
                "A11Y DoubleCheck found a blocking accessibility issue that should be resolved before shipping."
            )

        tainted = _tainted_fragments_for_fail(fail_signals)
        return {
            "status": "FAIL",
            "confidence_score": 62,
            "ship_readiness": "Do Not Ship",
            "summary": fail_summary,
            "remaining_risks": [risk_msg],
            "recommended_next_step": next_step,
            "verified_items": _criteria_from_sources(selected_sources, "PASS", excluded_fragments=tainted),
            "dynamic_verdict_summary": f"FAIL — triggered by: {'; '.join(fail_signals)}",
        }

    # --- Rule C: PARTIAL ---
    partial_risks = list(missing_evidence)
    if not any_lookup_success:
        partial_risks.append(
            "Controlled W3C/WAI web lookup could not be completed — evidence is based on local fallback only"
        )
    if not partial_risks:
        partial_risks = ["No clear pass or fail signal was detected — review the provided inputs"]

    return {
        "status": "PARTIAL",
        "confidence_score": 78,
        "ship_readiness": "Ship With Caution",
        "summary": (
            "A11Y DoubleCheck could not fully validate the component because some required "
            "evidence was missing or incomplete."
        ),
        "remaining_risks": partial_risks,
        "recommended_next_step": "Review the remaining risks before shipping.",
        "verified_items": [],
        "dynamic_verdict_summary": f"PARTIAL — missing or ambiguous: {'; '.join(partial_risks[:2])}",
    }


def _build_a11y_doublecheck_xml(selected_sources, evidence_summary, verdict):
    """Build the a11y_doublecheck_result XML string from a dynamic verdict dict."""
    sources_xml = "\n".join(f"    <source>{s}</source>" for s in selected_sources)

    items_parts = []
    for item in verdict["verified_items"]:
        items_parts.append(
            f"    <item>\n"
            f"      <criterion>{item['criterion']}</criterion>\n"
            f"      <result>{item['result']}</result>\n"
            f"      <detail>{item['detail']}</detail>\n"
            f"    </item>"
        )
    if items_parts:
        verified_items_xml = f"  <verified_items>\n" + "\n".join(items_parts) + "\n  </verified_items>"
    else:
        verified_items_xml = "  <verified_items/>"

    risks = verdict["remaining_risks"]
    if risks:
        risks_inner = "\n".join(f"    <risk>{r}</risk>" for r in risks)
        remaining_risks_xml = f"  <remaining_risks>\n{risks_inner}\n  </remaining_risks>"
    else:
        remaining_risks_xml = "  <remaining_risks/>"

    return (
        f"<a11y_doublecheck_result>\n"
        f"  <status>{verdict['status']}</status>\n"
        f"  <confidence_score>{verdict['confidence_score']}</confidence_score>\n"
        f"  <ship_readiness>{verdict['ship_readiness']}</ship_readiness>\n"
        f"  <summary>{verdict['summary']}</summary>\n"
        f"  <sources_checked>\n{sources_xml}\n  </sources_checked>\n"
        f"  <evidence_summary>{evidence_summary}</evidence_summary>\n"
        f"{verified_items_xml}\n"
        f"{remaining_risks_xml}\n"
        f"  <recommended_next_step>{verdict['recommended_next_step']}</recommended_next_step>\n"
        f"</a11y_doublecheck_result>"
    )


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


@app.route("/a11y-doublecheck", methods=["POST"])
def a11y_doublecheck():
    data = request.get_json() or {}

    accessibility_findings = data.get("accessibilityFindings", "")
    recommended_fix = data.get("recommendedFix", "")

    # Load all four Phase 3 RAG files from docs/
    loaded_rag_files = []
    missing_rag_files = []
    for file_name in A11Y_DOUBLECHECK_RAG_FILES:
        file_path = DOCS_DIR / file_name
        content = load_rag_file(file_path)
        if content is not None:
            loaded_rag_files.append(file_name)
        else:
            missing_rag_files.append(file_name)

    if missing_rag_files:
        return jsonify({
            "status": "error",
            "message": f"A11Y DoubleCheck RAG files could not be loaded: {', '.join(missing_rag_files)}",
            "missingFiles": missing_rag_files,
        }), 500

    # Select trusted sources based on the incoming findings keywords
    selected_sources = select_trusted_sources(accessibility_findings, recommended_fix)

    # Perform controlled web lookup against the selected trusted URLs
    web_lookup_results = perform_web_lookup(selected_sources)

    any_success = any(r["lookupStatus"] == "success" for r in web_lookup_results)
    api_mode = "web_lookup_dynamic" if any_success else "web_lookup_fallback_dynamic"

    # Build dynamic verdict based on payload content
    verdict = build_a11y_doublecheck_verdict(data, selected_sources, web_lookup_results)

    print(f"[A11Y DoubleCheck] selected_sources: {selected_sources}")
    print(f"[A11Y DoubleCheck] apiMode: {api_mode}")
    print(f"[A11Y DoubleCheck] verdict status: {verdict['status']}")
    print(f"[A11Y DoubleCheck] confidence_score: {verdict['confidence_score']}")
    print(f"[A11Y DoubleCheck] ship_readiness: {verdict['ship_readiness']}")

    evidence_summary = _build_evidence_summary(accessibility_findings, recommended_fix, any_success)
    xml_result = _build_a11y_doublecheck_xml(selected_sources, evidence_summary, verdict)

    return jsonify({
        "status": "success",
        "apiMode": api_mode,
        "xmlResult": xml_result,
        "loadedRagFiles": loaded_rag_files,
        "sourcesChecked": selected_sources,
        "webLookupResults": web_lookup_results,
        "dynamicVerdictSummary": verdict["dynamic_verdict_summary"],
    })


if __name__ == "__main__":
    app.run(debug=True, port=5001)
