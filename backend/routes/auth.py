"""
Contrôleur d'authentification — Assurances BIAT

Responsabilité unique (SRP) :
  1. Parser la requête HTTP entrante
  2. Appeler le service métier approprié
  3. Retourner la réponse JSON

Aucune logique métier ici — toute la logique est dans services/auth_service.py.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)

import services.auth_service as auth_service
from utils.http import get_client_ip, validate_json

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


# ==================== Inscription ====================

@auth_bp.route('/register', methods=['POST'])
@validate_json('nom', 'prenom', 'email', 'password')
def register():
    data = request.get_json()
    result, status = auth_service.register_user(
        nom=data['nom'].strip(),
        prenom=data['prenom'].strip(),
        email=data['email'].strip().lower(),
        password=data['password'],
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== Connexion (Étape 1 : email + mdp) ====================

@auth_bp.route('/login', methods=['POST'])
@validate_json('email', 'password')
def login():
    data = request.get_json()
    result, status = auth_service.login_user(
        email=data['email'].strip().lower(),
        password=data['password'],
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== Connexion (Étape 2 : code OTP) ====================

@auth_bp.route('/verify-2fa', methods=['POST'])
@jwt_required()
@validate_json('code')
def verify_2fa():
    claims = get_jwt()
    if claims.get('type') != 'temp_2fa':
        return jsonify({'error': "Token invalide. Utilisez le token temporaire de l'étape 1"}), 400

    result, status = auth_service.verify_2fa_login(
        user_id=get_jwt_identity(),
        code=request.get_json()['code'].strip(),
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== MFA Setup ====================

@auth_bp.route('/2fa/qrcode', methods=['GET'])
@jwt_required()
def get_qrcode():
    result, status = auth_service.get_qrcode_for_user(get_jwt_identity())
    return jsonify(result), status


@auth_bp.route('/2fa/enable', methods=['POST'])
@jwt_required()
@validate_json('code')
def enable_2fa():
    result, status = auth_service.enable_2fa_for_user(
        user_id=get_jwt_identity(),
        code=request.get_json()['code'].strip(),
        ip=get_client_ip(),
    )
    return jsonify(result), status


@auth_bp.route('/2fa/disable', methods=['POST'])
@jwt_required()
@validate_json('password')
def disable_2fa():
    result, status = auth_service.disable_2fa_for_user(
        user_id=get_jwt_identity(),
        password=request.get_json()['password'],
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== Routes protégées ====================

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    claims = get_jwt()
    if claims.get('type') == 'temp_2fa':
        return jsonify({'error': 'Authentification 2FA requise'}), 401

    result, status = auth_service.get_current_user(get_jwt_identity())
    return jsonify(result), status


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    from models.audit_log import AuditLog
    from utils.db import safe_commit
    AuditLog.log(action='LOGOUT', user_id=get_jwt_identity(), ip_address=get_client_ip())
    safe_commit()
    return jsonify({'message': 'Déconnexion réussie'}), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    access_token = create_access_token(
        identity=get_jwt_identity(),
        additional_claims={'type': 'access'},
    )
    return jsonify({'access_token': access_token}), 200


# ==================== Modification Profil & Mot de passe ====================

@auth_bp.route('/me', methods=['PUT'])
@jwt_required()
@validate_json('nom', 'prenom')
def update_profile():
    data = request.get_json()
    result, status = auth_service.update_user_profile(
        user_id=get_jwt_identity(),
        nom=data['nom'].strip(),
        prenom=data['prenom'].strip(),
        ip=get_client_ip(),
    )
    return jsonify(result), status


@auth_bp.route('/me/password', methods=['PUT'])
@jwt_required()
@validate_json('old_password', 'new_password')
def update_password():
    data = request.get_json()
    result, status = auth_service.update_user_password(
        user_id=get_jwt_identity(),
        old_password=data['old_password'],
        new_password=data['new_password'],
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== Mot de Passe Oublié (Flux) ====================

@auth_bp.route('/forgot-password/init', methods=['POST'])
@validate_json('email')
def forgot_password_init():
    email = request.get_json()['email'].strip().lower()
    result, status = auth_service.forgot_password_init(email)
    return jsonify(result), status


@auth_bp.route('/forgot-password/verify-2fa', methods=['POST'])
@jwt_required()
@validate_json('code')
def forgot_password_verify_2fa():
    claims = get_jwt()
    if claims.get('type') != 'reset_2fa':
        return jsonify({'error': 'Token invalide pour cette opération'}), 400

    result, status = auth_service.forgot_password_verify_2fa(
        user_id=get_jwt_identity(),
        code=request.get_json()['code'].strip(),
        ip=get_client_ip(),
    )
    return jsonify(result), status


@auth_bp.route('/forgot-password/reset', methods=['POST'])
@jwt_required()
@validate_json('new_password')
def forgot_password_reset():
    claims = get_jwt()
    if claims.get('type') != 'reset_password':
        return jsonify({'error': 'Token invalide pour cette opération'}), 400

    result, status = auth_service.forgot_password_reset(
        user_id=get_jwt_identity(),
        new_password=request.get_json()['new_password'],
        ip=get_client_ip(),
    )
    return jsonify(result), status


# ==================== Flux Invitation Admin ====================

@auth_bp.route('/invite/validate', methods=['GET'])
def validate_invite():
    token = request.args.get('token', '').strip()
    if not token:
        return jsonify({'valid': False, 'error': 'Token manquant'}), 400

    result, status = auth_service.validate_invitation_token(token)
    return jsonify(result), status


@auth_bp.route('/invite/accept', methods=['POST'])
@jwt_required()
@validate_json('token')
def accept_invite():
    claims = get_jwt()
    if claims.get('type') == 'temp_2fa':
        return jsonify({'error': 'Authentification complète requise'}), 401

    result, status = auth_service.accept_invitation(
        user_id=get_jwt_identity(),
        token_str=request.get_json()['token'].strip(),
        ip=get_client_ip(),
    )
    return jsonify(result), status
