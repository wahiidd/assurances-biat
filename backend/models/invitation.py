"""
Modèle Invitation — Assurances BIAT
Token UUID à usage unique pour la promotion admin
"""
import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID as PGUUID
from extensions import db


class Invitation(db.Model):
    """
    Gère le flux de promotion admin.
    Un admin génère un token envoyé par email à un utilisateur existant.
    Le token est à usage unique et expire après 48h.
    """
    __tablename__ = 'invitations'

    id         = db.Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invited_by = db.Column(
        PGUUID(as_uuid=True),
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True
    )
    email      = db.Column(db.String(255), nullable=False)
    token      = db.Column(db.String(255), nullable=False, unique=True)
    role_cible = db.Column(db.String(20), default='admin')
    used       = db.Column(db.Boolean, default=False, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self):
        return f'<Invitation {self.email} used={self.used}>'

    def is_valid(self) -> bool:
        """Vérifie que le token est encore valide (non utilisé et non expiré)."""
        if self.used:
            return False
        now = datetime.utcnow()
        expires = self.expires_at.replace(tzinfo=None) if self.expires_at.tzinfo else self.expires_at
        return expires > now

    def to_dict(self) -> dict:
        return {
            'id':          str(self.id),
            'email':       self.email,
            'role_cible':  self.role_cible,
            'used':        self.used,
            'expires_at':  self.expires_at.isoformat() if self.expires_at else None,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
            'invited_by':  str(self.invited_by) if self.invited_by else None,
        }
