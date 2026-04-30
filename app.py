from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

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

if __name__ == "__main__":
    app.run(debug=True, port=5001)