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

if __name__ == "__main__":
    app.run(debug=True, port=5001)