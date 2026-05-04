from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

BASE_DIR = Path(__file__).resolve().parent
RAG_DIR = BASE_DIR / "rag"
RAG_REGISTRY_FILE = RAG_DIR / "orchestrator_rag_registry.txt"
BUTTON_RAG_FILE = RAG_DIR / "orchestrator_button_health_score_rag.txt"


def read_text_file(path):
    if not path.exists():
        return ""

    return path.read_text(encoding="utf-8")

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
        "echo": component_code
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
        "message": "The component uses a native button element."
    },
    {
        "status": "Pass",
        "rule": "Accessible name",
        "message": "The button includes visible text that can act as an accessible name."
    },
    {
        "status": "Pass",
        "rule": "Keyboard interaction",
        "message": "The component remains operable through standard button keyboard behavior."
    },
    {
        "status": "Pass",
        "rule": "Focus indicator contrast",
        "message": "No verified focus indicator contrast issue was found in the current test state."
    }
],
        "echo": component_code
    }

    return jsonify(mock_result)

@app.route("/rag-query", methods=["POST"])
def rag_query():
    data = request.get_json()
    question = data.get("question", "")
    component_context = data.get("componentContext", "")

    registry_text = read_text_file(RAG_REGISTRY_FILE)
    button_rag_text = read_text_file(BUTTON_RAG_FILE)

    if not registry_text or not button_rag_text:
        return jsonify({
            "status": "error",
            "message": "RAG files could not be loaded from the backend rag directory.",
            "question": question
        }), 500

    return jsonify({
        "status": "success",
        "message": "Backend RAG context loaded successfully.",
        "question": question,
        "componentContext": component_context,
        "registryPreview": registry_text[:500],
        "ragPreview": button_rag_text[:1200],
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
                ]
            },
            "recommendedFixes": [
                "Update the disabled text color to a darker accessible value, rerun the checker, and confirm the finding changes from Fail to Pass."
            ]
        }
    })
if __name__ == "__main__":
    app.run(debug=True, port=5001)