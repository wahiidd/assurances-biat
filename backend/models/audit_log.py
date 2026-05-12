"""
Modèle AuditLog — Assurances BIAT
Traçabilité obligatoire de toutes les actions sensibles
"""
import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from extensions import db

# Actions reconnues
ACTIONS = (
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'REGISTER',
    'MFA_ENABLED', 'MFA_DISABLED',
    'UPLOAD_CSV', 'PROMOTE_ADMIN', 'INVITE_SENT',
    'ACTIVATE_USER', 'DEACTIVATE_USER',
    'SEED_ADMIN_CREATED',
)


class AuditLog(db.Model):
    """
    Journal d'audit immuable.
    Chaque action sensible est tracée avec l'IP, l'acteur et les métadonnées.
    """
    __tablename__ = 'audit_log'

    id           = db.Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = db.Column(
        PGUUID(as_uuid=True),
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True
    )
    action       = db.Column(db.String(100), nullable=False)
    ip_address   = db.Column(db.String(45), nullable=True)
    log_metadata = db.Column(JSONB, nullable=True, name='metadata')
    created_at   = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self):
        return f'<AuditLog {self.action} user={self.user_id}>'

    @classmethod
    def log(cls, action: str, user_id=None, ip_address: str = None, metadata: dict = None):
        """
        Crée une entrée de log sans la committer.
        Ajouter à la session et committer côté appelant.
        """
        entry = cls(
            action=action,
            user_id=user_id,
            ip_address=ip_address,
            log_metadata=metadata,
        )
        db.session.add(entry)
        return entry

    def to_dict(self) -> dict:
        return {
            'id':         str(self.id),
            'user_id':    str(self.user_id) if self.user_id else None,
            'action':     self.action,
            'ip_address': self.ip_address,
            'metadata':   self.log_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
