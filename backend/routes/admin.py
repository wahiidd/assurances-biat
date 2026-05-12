"""
Contrôleur d'administration — Assurances BIAT

Responsabilité unique (SRP) :
  1. Parser la requête HTTP entrante + vérification des droits admin
  2. Appeler le service métier approprié
  3. Retourner la réponse JSON

Aucune logique métier ici — toute la logique est dans services/admin_service.py.
"""
import os
from functools import wraps

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from models.user import User
from utils.http import get_client_ip, validate_json
import services.admin_service as admin_service

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


# ==================== Décorateur admin ====================

def admin_required(f):
    """Vérifie que le JWT est valide ET que l'utilisateur est admin actif."""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({'error': 'Authentification requise'}), 401

        user_id = get_jwt_identity()
        user = User.query.filter_by(id=user_id).first()

        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        if not user.is_active:
            return jsonify({'error': 'Compte désactivé'}), 403
        if user.role != 'admin':
            return jsonify({'error': 'Accès réservé aux administrateurs'}), 403

        return f(*args, **kwargs)
    return decorated


# ==================== Gestion des utilisateurs ====================

@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    result, status = admin_service.list_users(
        page=request.args.get('page', 1, type=int),
        per_page=request.args.get('per_page', 50, type=int),
    )
    return jsonify(result), status


@admin_bp.route('/users/<user_id>/toggle-active', methods=['PUT'])
@admin_required
def toggle_user_active(user_id):
    result, status = admin_service.toggle_user_active(
        admin_id=get_jwt_identity(),
        user_id=user_id,
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== Actions d'urgence ====================

@admin_bp.route('/users/<user_id>/reset-password', methods=['PUT'])
@admin_required
@validate_json('new_password')
def admin_reset_password(user_id):
    result, status = admin_service.admin_reset_password(
        admin_id=get_jwt_identity(),
        user_id=user_id,
        new_password=request.get_json().get('new_password', '').strip(),
        ip=get_client_ip(),
    )
    return jsonify(result), status


@admin_bp.route('/users/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    result, status = admin_service.delete_user(
        admin_id=get_jwt_identity(),
        user_id=user_id,
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== Invitations admin ====================

@admin_bp.route('/invitations', methods=['POST'])
@admin_required
def send_invitation():
    if not request.is_json:
        return jsonify({'error': 'Content-Type doit être application/json'}), 400

    data  = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({'error': 'Email requis'}), 400

    result, status = admin_service.send_invitation(
        admin_id=get_jwt_identity(),
        email=email,
        ip=get_client_ip(),
        frontend_url=current_app.config.get('FRONTEND_URL', 'http://localhost:3000'),
        app_name=current_app.config.get('APP_NAME', 'Assurances BIAT'),
    )
    return jsonify(result), status


@admin_bp.route('/invitations', methods=['GET'])
@admin_required
def list_invitations():
    result, status = admin_service.list_invitations()
    return jsonify(result), status


# ==================== Upload CSV ====================

@admin_bp.route('/csv/upload', methods=['POST'])
@admin_required
def upload_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni (champ "file" attendu)'}), 400

    file = request.files['file']

    if not file or file.filename == '':
        return jsonify({'error': 'Nom de fichier vide'}), 400

    if not file.filename.lower().endswith('.csv'):
        return jsonify({'error': 'Seuls les fichiers CSV (.csv) sont acceptés'}), 400

    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    result, status = admin_service.upload_csv(
        admin_id=get_jwt_identity(),
        file=file,
        upload_folder=upload_folder,
        ip=get_client_ip(),
    )
    return jsonify(result), status


@admin_bp.route('/csv/uploads', methods=['GET'])
@admin_required
def list_csv_uploads():
    result, status = admin_service.list_csv_uploads()
    return jsonify(result), status


# ==================== Audit log (lecture seule) ====================

@admin_bp.route('/audit', methods=['GET'])
@admin_required
def list_audit():
    result, status = admin_service.list_audit_logs(
        limit=request.args.get('limit', 100, type=int)
    )
    return jsonify(result), status
