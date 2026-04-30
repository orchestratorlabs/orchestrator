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
        "message": "Mock LLM accessibility review complete.",
        "score": 84,
        "summary": "The component includes a semantic button and an accessible name. Additional verification is needed for focus state contrast and full keyboard interaction coverage.",
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
                "status": "Unknown",
                "rule": "Keyboard interaction",
                "message": "Keyboard behavior cannot be fully verified from the static code sample alone."
            },
            {
                "status": "Fail",
                "rule": "Focus indicator contrast",
                "message": "Focus indicator contrast requires further validation against the surrounding background."
            }
        ],
        "echo": component_code
    }

    return jsonify(mock_result)

if __name__ == "__main__":
    app.run(debug=True, port=5001)