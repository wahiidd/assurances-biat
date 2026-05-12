"""
Service d'administration — Assurances BIAT

Contient toute la logique métier des opérations d'administration.
Les fonctions retournent des tuples (dict, status_code) — aucune dépendance Flask HTTP ici.
"""
import os
import uuid
from datetime import datetime, timedelta

from flask import current_app
from flask_mail import Message

from extensions import db, mail
from models.user import User
from models.invitation import Invitation
from models.csv_upload import CsvUpload
from models.audit_log import AuditLog
from utils.db import safe_commit


# ==================== Gestion des utilisateurs ====================

def list_users(page: int, per_page: int) -> tuple:
    """Liste tous les utilisateurs avec pagination. Retourne (dict, status_code)."""
    paginated = User.query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return {
        'users':        [u.to_dict() for u in paginated.items],
        'total':        paginated.total,
        'pages':        paginated.pages,
        'current_page': paginated.page,
    }, 200


def toggle_user_active(admin_id: str, user_id: str, ip: str) -> tuple:
    """Active ou désactive un compte utilisateur. Retourne (dict, status_code)."""
    target = User.query.filter_by(id=user_id).first()
    if not target:
        return {'error': 'Utilisateur non trouvé'}, 404

    if str(target.id) == admin_id:
        return {'error': 'Vous ne pouvez pas modifier votre propre statut'}, 400

    old_status       = target.is_active
    target.is_active = not old_status
    action = 'ACTIVATE_USER' if target.is_active else 'DEACTIVATE_USER'

    AuditLog.log(
        action=action,
        user_id=admin_id,
        ip_address=ip,
        metadata={
            'target_user_id': str(target.id),
            'target_email':   target.email,
            'old_status':     old_status,
            'new_status':     target.is_active,
        },
    )

    if not safe_commit():
        return {'error': 'Erreur lors de la mise à jour'}, 500

    status_label = 'activé' if target.is_active else 'désactivé'
    return {
        'message': f'Compte {status_label} avec succès',
        'user':    target.to_dict(),
    }, 200


# ==================== Actions d'urgence ====================

def admin_reset_password(admin_id: str, user_id: str, new_password: str, ip: str) -> tuple:
    """L'admin force un nouveau mot de passe (et désactive le MFA). Retourne (dict, status_code)."""
    target = User.query.filter_by(id=user_id).first()
    if not target:
        return {'error': 'Utilisateur non trouvé'}, 404

    if len(new_password) < 8:
        return {'error': 'Le mot de passe doit contenir au moins 8 caractères'}, 400

    target.set_password(new_password)
    old_mfa = target.mfa_enabled
    if old_mfa:
        target.disable_mfa()

    AuditLog.log(
        action='ADMIN_RESET_PASSWORD',
        user_id=admin_id,
        ip_address=ip,
        metadata={
            'target_user_id':            str(target.id),
            'target_email':              target.email,
            'mfa_disabled_automatically': old_mfa,
        },
    )

    if not safe_commit():
        return {'error': 'Erreur lors de la réinitialisation'}, 500

    return {
        'message': 'Mot de passe réinitialisé avec succès. Le MFA a été désactivé pour ce compte.',
        'user': target.to_dict(),
    }, 200


def delete_user(admin_id: str, user_id: str, ip: str) -> tuple:
    """Supprime définitivement un utilisateur. Retourne (dict, status_code)."""
    target = User.query.filter_by(id=user_id).first()
    if not target:
        return {'error': 'Utilisateur non trouvé'}, 404

    if str(target.id) == admin_id:
        return {'error': 'Vous ne pouvez pas supprimer votre propre compte'}, 400

    target_email  = target.email
    target_id_str = str(target.id)

    db.session.delete(target)

    AuditLog.log(
        action='DELETE_USER',
        user_id=admin_id,
        ip_address=ip,
        metadata={
            'target_user_id': target_id_str,
            'target_email':   target_email,
        },
    )

    if not safe_commit():
        return {'error': 'Erreur lors de la suppression'}, 500

    return {'message': 'Utilisateur supprimé définitivement.'}, 200


# ==================== Invitations admin ====================

def send_invitation(admin_id: str, email: str, ip: str, frontend_url: str, app_name: str) -> tuple:
    """Génère un token d'invitation et envoie l'email. Retourne (dict, status_code)."""
    target = User.query.filter_by(email=email).first()
    if not target:
        return {'error': 'Aucun compte trouvé avec cette adresse email'}, 404
    if not target.is_active:
        return {'error': 'Ce compte est désactivé'}, 400
    if target.role == 'admin':
        return {'error': 'Cet utilisateur est déjà administrateur'}, 400

    existing = Invitation.query.filter_by(email=email, used=False).filter(
        Invitation.expires_at > datetime.utcnow()
    ).first()
    if existing:
        return {'error': 'Une invitation active existe déjà pour cet email'}, 400

    token      = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=48)

    invitation = Invitation(
        invited_by=admin_id,
        email=email,
        token=token,
        role_cible='admin',
        expires_at=expires_at,
    )

    invite_link = f"{frontend_url}/invite?token={token}"

    try:
        msg = Message(
            subject=f'Invitation Administrateur — {app_name}',
            recipients=[email],
            html=f"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:20px;">
              <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.1);">
                <div style="background:#093215; padding:30px; text-align:center;">
                  <h1 style="color:#fff; margin:0; font-size:24px;">{app_name}</h1>
                  <p style="color:#acc936; margin:8px 0 0; font-size:14px;">Plateforme de Gestion des Contrats d'Épargne</p>
                </div>
                <div style="padding:40px 30px;">
                  <h2 style="color:#093215; margin-top:0;">Invitation Administrateur</h2>
                  <p>Bonjour <strong>{target.prenom} {target.nom}</strong>,</p>
                  <p>Vous avez été invité(e) à rejoindre l'équipe d'administrateurs de la plateforme <strong>{app_name}</strong>.</p>
                  <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation :</p>
                  <div style="text-align:center; margin:35px 0;">
                    <a href="{invite_link}"
                       style="background:#19542b; color:#fff; padding:16px 32px; text-decoration:none;
                              border-radius:6px; font-weight:bold; font-size:16px; display:inline-block;">
                      Accepter l'invitation
                    </a>
                  </div>
                  <div style="background:#f9f9f9; border-left:4px solid #acc936; padding:12px 16px; border-radius:4px;">
                    <p style="margin:0; font-size:13px; color:#555;">
                      ⏳ Ce lien expirera dans <strong>48 heures</strong>.<br>
                      🔒 Il ne peut être utilisé qu'une seule fois.<br>
                      Vous devez être connecté(e) à votre compte pour accepter l'invitation.
                    </p>
                  </div>
                  <p style="color:#999; font-size:11px; margin-top:30px;">
                    Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
                  </p>
                </div>
                <div style="background:#093215; padding:15px; text-align:center;">
                  <p style="color:#fff; margin:0; font-size:12px;">© {datetime.utcnow().year} {app_name}. Tous droits réservés.</p>
                </div>
              </div>
            </body>
            </html>
            """,
        )
        mail.send(msg)
    except Exception as e:
        current_app.logger.error(f"Mail send error: {e}")
        return {'error': "Erreur lors de l'envoi de l'email"}, 500

    db.session.add(invitation)
    AuditLog.log(
        action='INVITE_SENT',
        user_id=admin_id,
        ip_address=ip,
        metadata={
            'target_email':   email,
            'target_user_id': str(target.id),
            'role_cible':     'admin',
            'expires_at':     expires_at.isoformat(),
        },
    )

    if not safe_commit():
        return {'error': "Erreur lors de la sauvegarde de l'invitation"}, 500

    return {
        'message':    f'Invitation envoyée à {email}',
        'invitation': invitation.to_dict(),
    }, 201


def list_invitations() -> tuple:
    """Liste toutes les invitations (ordre décroissant). Retourne (dict, status_code)."""
    invitations = Invitation.query.order_by(Invitation.created_at.desc()).all()
    return {'invitations': [i.to_dict() for i in invitations]}, 200


# ==================== Upload CSV ====================

def upload_csv(admin_id: str, file, upload_folder: str, ip: str) -> tuple:
    """Upload et traitement synchrone d'un fichier CSV. Retourne (dict, status_code)."""
    file_uuid = str(uuid.uuid4())
    safe_name = f"{file_uuid}_{file.filename}"
    filepath  = os.path.join(upload_folder, safe_name)

    csv_upload = CsvUpload(
        uploaded_by=admin_id,
        filename=file.filename,
        filepath=filepath,
        status='processing',
    )
    db.session.add(csv_upload)

    if not safe_commit():
        return {'error': "Erreur lors de la création de l'enregistrement"}, 500

    try:
        file.save(filepath)
    except Exception:
        csv_upload.status    = 'error'
        csv_upload.error_msg = 'Erreur lors de la sauvegarde du fichier'
        safe_commit()
        return {'error': 'Erreur lors de la sauvegarde du fichier'}, 500

    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            count = sum(1 for _ in f)
        nb_lignes = max(0, count - 1)  # -1 pour l'en-tête

        csv_upload.nb_lignes = nb_lignes
        csv_upload.status    = 'done'

        AuditLog.log(
            action='UPLOAD_CSV',
            user_id=admin_id,
            ip_address=ip,
            metadata={'filename': file.filename, 'nb_lignes': nb_lignes, 'status': 'done'},
        )
        safe_commit()

    except Exception as e:
        csv_upload.status    = 'error'
        csv_upload.error_msg = str(e)[:500]
        AuditLog.log(
            action='UPLOAD_CSV',
            user_id=admin_id,
            ip_address=ip,
            metadata={'filename': file.filename, 'status': 'error', 'error': str(e)[:200]},
        )
        safe_commit()

    message     = 'Fichier traité avec succès' if csv_upload.status == 'done' else 'Erreur de traitement'
    status_code = 201 if csv_upload.status == 'done' else 500

    return {'message': message, 'upload': csv_upload.to_dict()}, status_code


def list_csv_uploads() -> tuple:
    """Liste tous les uploads CSV. Retourne (dict, status_code)."""
    uploads = CsvUpload.query.order_by(CsvUpload.uploaded_at.desc()).all()
    return {'uploads': [u.to_dict() for u in uploads]}, 200


# ==================== Audit log ====================

def list_audit_logs(limit: int) -> tuple:
    """Liste les dernières entrées du journal d'audit. Retourne (dict, status_code)."""
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return {'logs': [log.to_dict() for log in logs]}, 200
