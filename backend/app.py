from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import hashlib
from datetime import timedelta

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'your-secret-key'  # Change this!
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

jwt = JWTManager(app)
CORS(app, origins=['*'])  # Configure this properly for production

# Simple in-memory user storage (replace with database)
users = {}

def hash_password(password):
    """Simple password hashing using hashlib"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    """Verify password against hash"""
    return hashlib.sha256(password.encode()).hexdigest() == hashed

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "AI Configuration Manager"})

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'user')
        
        # Validate input
        if not all([username, email, password]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Check if user already exists
        if username in users:
            return jsonify({"error": "Username already exists"}), 400
            
        # Hash password
        hashed_password = hash_password(password)
        
        # Store user
        users[username] = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'role': role
        }
        
        return jsonify({"message": "User registered successfully"}), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        # Validate input
        if not all([username, password]):
            return jsonify({"error": "Missing username or password"}), 400
        
        # Check if user exists
        if username not in users:
            return jsonify({"error": "Invalid credentials"}), 401
            
        user = users[username]
        
        # Verify password
        if verify_password(password, user['password']):
            # Create access token
            access_token = create_access_token(identity=username)
            return jsonify({
                "access_token": access_token,
                "user": {
                    "username": user['username'],
                    "email": user['email'],
                    "role": user['role']
                }
            }), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/profile', methods=['GET'])
@jwt_required()
def profile():
    current_user = get_jwt_identity()
    if current_user in users:
        user = users[current_user]
        return jsonify({
            "user": {
                "username": user['username'],
                "email": user['email'],
                "role": user['role']
            }
        }), 200
    return jsonify({"error": "User not found"}), 404

@app.route('/api/analytics/dashboard', methods=['GET'])
@jwt_required()
def dashboard_analytics():
    # Mock analytics data
    return jsonify({
        "summary": {
            "total_configurations": 42,
            "total_applications": 8,
            "sensitivity_distribution": {"high": 5, "medium": 15, "low": 22},
            "environments": {"production": 12, "staging": 18, "development": 12}
        },
        "recent_activity": [
            {"id": 1, "action": "configuration_updated", "configuration": "API Keys", "timestamp": "2025-06-14T10:00:00Z"},
            {"id": 2, "action": "application_created", "configuration": "Chat Bot", "timestamp": "2025-06-14T09:00:00Z"},
            {"id": 3, "action": "audit_completed", "configuration": None, "timestamp": "2025-06-14T08:00:00Z"}
        ]
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)