"""
Service d'authentification — Assurances BIAT

Contient toute la logique métier des opérations d'authentification.
Les fonctions retournent des tuples (dict, status_code) — aucune dépendance Flask HTTP ici.
"""
import io
import base64
from datetime import datetime, timedelta

import qrcode
from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token

from extensions import db
from models.user import User
from models.invitation import Invitation
from models.audit_log import AuditLog
from utils.db import safe_commit


# ==================== Inscription ====================

def register_user(nom: str, prenom: str, email: str, password: str, ip: str) -> tuple:
    """Inscrit un nouvel utilisateur. Retourne (dict, status_code)."""
    if len(nom) < 2 or len(prenom) < 2:
        return {'error': 'Nom et prénom doivent contenir au moins 2 caractères'}, 400

    if len(password) < 8:
        return {'error': 'Le mot de passe doit contenir au moins 8 caractères'}, 400

    if User.query.filter_by(email=email).first():
        return {'error': 'Cette adresse email est déjà utilisée'}, 400

    user = User(nom=nom, prenom=prenom, email=email)
    user.set_password(password)
    user.generate_mfa_secret()

    db.session.add(user)
    AuditLog.log(
        action='REGISTER',
        user_id=user.id,
        ip_address=ip,
        metadata={'email': email},
    )

    if not safe_commit():
        return {'error': 'Erreur lors de la création du compte'}, 500

    return {
        'message': 'Compte créé avec succès',
        'user': user.to_dict(),
    }, 201


# ==================== Connexion (Étape 1) ====================

def login_user(email: str, password: str, ip: str) -> tuple:
    """Connexion étape 1 — email + mot de passe. Retourne (dict, status_code)."""
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        AuditLog.log(
            action='LOGIN_FAILED',
            user_id=user.id if user else None,
            ip_address=ip,
            metadata={'email': email, 'reason': 'invalid_credentials'},
        )
        safe_commit()
        return {'error': 'Identifiants invalides'}, 401

    if not user.is_active:
        AuditLog.log(
            action='LOGIN_FAILED',
            user_id=user.id,
            ip_address=ip,
            metadata={'email': email, 'reason': 'account_inactive'},
        )
        safe_commit()
        return {'error': 'Identifiants invalides'}, 401

    if user.mfa_enabled:
        temp_token = create_access_token(
            identity=str(user.id),
            additional_claims={'type': 'temp_2fa', 'step': 'pending_2fa'},
            expires_delta=current_app.config.get('TEMP_TOKEN_EXPIRES'),
        )
        return {
            'message': 'Vérification 2FA requise',
            'requires_2fa': True,
            'temp_token': temp_token,
        }, 200

    user.last_login = datetime.utcnow()
    AuditLog.log(
        action='LOGIN',
        user_id=user.id,
        ip_address=ip,
        metadata={'email': email},
    )
    safe_commit()

    access_token  = create_access_token(identity=str(user.id), additional_claims={'type': 'access'})
    refresh_token = create_refresh_token(identity=str(user.id))

    return {
        'message': 'Connexion réussie',
        'requires_2fa': False,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    }, 200


# ==================== Connexion (Étape 2 : OTP) ====================

def verify_2fa_login(user_id: str, code: str, ip: str) -> tuple:
    """Connexion étape 2 — vérification TOTP. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()

    if not user or not user.is_active:
        return {'error': 'Utilisateur non trouvé'}, 404

    if not code.isdigit() or len(code) != 6:
        return {'error': 'Le code doit être composé de 6 chiffres'}, 400

    if not user.verify_totp(code):
        AuditLog.log(
            action='LOGIN_FAILED',
            user_id=user.id,
            ip_address=ip,
            metadata={'email': user.email, 'reason': 'invalid_totp'},
        )
        safe_commit()
        return {'error': 'Code de vérification invalide'}, 401

    user.last_login = datetime.utcnow()
    AuditLog.log(
        action='LOGIN',
        user_id=user.id,
        ip_address=ip,
        metadata={'email': user.email, 'method': '2fa'},
    )
    safe_commit()

    access_token  = create_access_token(identity=str(user.id), additional_claims={'type': 'access'})
    refresh_token = create_refresh_token(identity=str(user.id))

    return {
        'message': 'Authentification 2FA réussie',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    }, 200


# ==================== MFA Setup ====================

def get_qrcode_for_user(user_id: str) -> tuple:
    """Génère le QR code TOTP base64. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return {'error': 'Utilisateur non trouvé'}, 404

    if not user.mfa_secret:
        user.generate_mfa_secret()
        db.session.commit()

    uri = user.get_totp_uri()
    qr  = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)

    img    = qr.make_image(fill_color='black', back_color='white')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    img_b64 = base64.b64encode(buffer.getvalue()).decode()
    return {
        'qrcode': f'data:image/png;base64,{img_b64}',
        'secret': user.mfa_secret,
    }, 200


def enable_2fa_for_user(user_id: str, code: str, ip: str) -> tuple:
    """Active la 2FA après vérification OTP. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return {'error': 'Utilisateur non trouvé'}, 404

    if not user.verify_totp(code):
        return {'error': 'Code invalide. Vérifiez votre application Authenticator'}, 401

    user.enable_mfa()
    AuditLog.log(action='MFA_ENABLED', user_id=user.id, ip_address=ip, metadata={'email': user.email})

    if not safe_commit():
        return {'error': "Erreur lors de l'activation"}, 500

    return {'message': '2FA activée avec succès', 'mfa_enabled': True}, 200


def disable_2fa_for_user(user_id: str, password: str, ip: str) -> tuple:
    """Désactive la 2FA (nécessite le mot de passe). Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return {'error': 'Utilisateur non trouvé'}, 404

    if not user.check_password(password):
        return {'error': 'Mot de passe incorrect'}, 401

    user.disable_mfa()
    AuditLog.log(action='MFA_DISABLED', user_id=user.id, ip_address=ip, metadata={'email': user.email})

    if not safe_commit():
        return {'error': 'Erreur lors de la désactivation'}, 500

    return {'message': '2FA désactivée', 'mfa_enabled': False}, 200


# ==================== Profil ====================

def get_current_user(user_id: str) -> tuple:
    """Retourne les informations de l'utilisateur connecté. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return {'error': 'Utilisateur non trouvé'}, 404
    return {'user': user.to_dict()}, 200


def update_user_profile(user_id: str, nom: str, prenom: str, ip: str) -> tuple:
    """Met à jour le profil utilisateur. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return {'error': 'Utilisateur non trouvé'}, 404

    if len(nom) < 2 or len(prenom) < 2:
        return {'error': 'Nom et prénom doivent contenir au moins 2 caractères'}, 400

    user.nom    = nom
    user.prenom = prenom

    AuditLog.log(
        action='UPDATE_PROFILE',
        user_id=user.id,
        ip_address=ip,
        metadata={'email': user.email, 'nom': nom, 'prenom': prenom},
    )

    if not safe_commit():
        return {'error': 'Erreur lors de la mise à jour du profil'}, 500

    return {'message': 'Profil mis à jour avec succès', 'user': user.to_dict()}, 200


def update_user_password(user_id: str, old_password: str, new_password: str, ip: str) -> tuple:
    """Modifie le mot de passe de l'utilisateur connecté. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user:
        return {'error': 'Utilisateur non trouvé'}, 404

    if not user.check_password(old_password):
        return {'error': 'Ancien mot de passe incorrect'}, 401

    if len(new_password) < 8:
        return {'error': 'Le nouveau mot de passe doit contenir au moins 8 caractères'}, 400

    user.set_password(new_password)
    AuditLog.log(action='UPDATE_PASSWORD', user_id=user.id, ip_address=ip, metadata={'email': user.email})

    if not safe_commit():
        return {'error': 'Erreur lors de la modification du mot de passe'}, 500

    return {'message': 'Mot de passe modifié avec succès'}, 200


# ==================== Mot de Passe Oublié (Flux 3 étapes) ====================

def forgot_password_init(email: str) -> tuple:
    """Étape 1 : Vérification de l'email. Retourne (dict, status_code)."""
    user = User.query.filter_by(email=email).first()

    if not user or not user.is_active:
        return {'error': 'Aucun compte actif trouvé avec cette adresse email.'}, 404

    if not user.mfa_enabled:
        return {'error': "Le compte n'a pas la 2FA activée. Veuillez contacter l'administrateur."}, 400

    reset_token = create_access_token(
        identity=str(user.id),
        additional_claims={'type': 'reset_2fa', 'step': 'pending_2fa'},
        expires_delta=current_app.config.get('TEMP_TOKEN_EXPIRES', timedelta(minutes=10)),
    )

    return {
        'message': 'Veuillez saisir votre code Authenticator.',
        'reset_token': reset_token,
    }, 200


def forgot_password_verify_2fa(user_id: str, code: str, ip: str) -> tuple:
    """Étape 2 : Vérification TOTP pour réinitialisation. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user or not user.is_active:
        return {'error': 'Utilisateur non trouvé'}, 404

    if not code.isdigit() or len(code) != 6:
        return {'error': 'Le code doit être composé de 6 chiffres'}, 400

    if not user.verify_totp(code):
        AuditLog.log(
            action='PWD_RESET_MFA_FAILED',
            user_id=user.id,
            ip_address=ip,
            metadata={'email': user.email},
        )
        safe_commit()
        return {'error': 'Code de vérification invalide'}, 401

    reset_pw_token = create_access_token(
        identity=str(user.id),
        additional_claims={'type': 'reset_password'},
        expires_delta=timedelta(minutes=10),
    )

    return {
        'message': 'Code 2FA validé. Vous pouvez modifier votre mot de passe.',
        'reset_pw_token': reset_pw_token,
    }, 200


def forgot_password_reset(user_id: str, new_password: str, ip: str) -> tuple:
    """Étape 3 : Application du nouveau mot de passe. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user or not user.is_active:
        return {'error': 'Utilisateur non trouvé'}, 404

    if len(new_password) < 8:
        return {'error': 'Le nouveau mot de passe doit contenir au moins 8 caractères'}, 400

    user.set_password(new_password)
    AuditLog.log(action='PWD_RESET_SUCCESS', user_id=user.id, ip_address=ip, metadata={'email': user.email})

    if not safe_commit():
        return {'error': 'Erreur lors de la réinitialisation du mot de passe'}, 500

    return {'message': 'Votre mot de passe a été réinitialisé avec succès.'}, 200


# ==================== Invitations ====================

def validate_invitation_token(token: str) -> tuple:
    """Valide un token d'invitation (public). Retourne (dict, status_code)."""
    invitation = Invitation.query.filter_by(token=token).first()
    if not invitation:
        return {'valid': False, 'error': 'Invitation invalide ou expirée'}, 404

    if not invitation.is_valid():
        reason = 'déjà utilisée' if invitation.used else 'expirée'
        return {'valid': False, 'error': f'Cette invitation est {reason}'}, 400

    return {
        'valid': True,
        'email': invitation.email,
        'role_cible': invitation.role_cible,
    }, 200


def accept_invitation(user_id: str, token_str: str, ip: str) -> tuple:
    """Accepte une invitation et promeut l'utilisateur. Retourne (dict, status_code)."""
    user = User.query.filter_by(id=user_id).first()
    if not user or not user.is_active:
        return {'error': 'Utilisateur non trouvé'}, 404

    invitation = Invitation.query.filter_by(token=token_str).first()
    if not invitation:
        return {'error': 'Invitation invalide'}, 404

    if invitation.email.lower() != user.email.lower():
        return {'error': "Cette invitation ne vous est pas destinée"}, 403

    if not invitation.is_valid():
        reason = 'déjà utilisée' if invitation.used else 'expirée'
        return {'error': f'Cette invitation est {reason}'}, 400

    old_role       = user.role
    user.role      = invitation.role_cible
    invitation.used = True

    AuditLog.log(
        action='PROMOTE_ADMIN',
        user_id=str(invitation.invited_by),
        ip_address=ip,
        metadata={
            'promoted_email':   user.email,
            'promoted_user_id': str(user.id),
            'old_role':         old_role,
            'new_role':         invitation.role_cible,
            'invited_by_id':    str(invitation.invited_by),
        },
    )

    if not safe_commit():
        return {'error': 'Erreur lors de la promotion'}, 500

    access_token  = create_access_token(identity=str(user.id), additional_claims={'type': 'access'})
    refresh_token = create_refresh_token(identity=str(user.id))

    return {
        'message': f'Félicitations ! Vous êtes maintenant {invitation.role_cible}.',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token,
    }, 200
