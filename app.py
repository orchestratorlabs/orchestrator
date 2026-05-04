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

    registry_preview = get_registry_preview()
    if registry_preview is None:
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

    return jsonify({
        "status": "success",
        "message": "Backend RAG context loaded successfully.",
        "question": question,
        "componentContext": component_context,
        "registryPreview": registry_preview,
        "ragPreview": component_rag_text[:1200],
        "answer": (
            "OrchestratoR loaded the backend RAG registry and button accessibility rule context. "
            "For disabled text contrast, compare the disabled label color against the disabled background color. "
            "If the contrast ratio is below the WCAG 2.1 text contrast threshold, update the disabled text color, "
            "rerun the checker, and confirm the finding changes from Fail to Pass."
        ),
        "outputFormat": {
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
        },
    })


if __name__ == "__main__":
    app.run(debug=True, port=5001)
