"""
Modèle User — Assurances BIAT
UUID primary key, bcrypt, TOTP MFA, rôles admin/user
"""
import uuid
import pyotp
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID as PGUUID
from extensions import db, bcrypt


class User(db.Model):
    """
    Table centrale des utilisateurs.
    Stocke les comptes, credentials, configuration MFA et rôle.
    """
    __tablename__ = 'users'

    id            = db.Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom           = db.Column(db.String(100), nullable=False)
    prenom        = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.String(20), nullable=False, default='user')
    is_active     = db.Column(db.Boolean, default=True, nullable=False)
    mfa_enabled   = db.Column(db.Boolean, default=False, nullable=False)
    mfa_secret    = db.Column(db.String(64), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login    = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relations
    invitations_sent = db.relationship(
        'Invitation', foreign_keys='Invitation.invited_by',
        backref='invitor', lazy=True
    )
    csv_uploads = db.relationship(
        'CsvUpload', foreign_keys='CsvUpload.uploaded_by',
        backref='uploader', lazy=True
    )
    audit_logs = db.relationship(
        'AuditLog', foreign_keys='AuditLog.user_id',
        backref='actor', lazy=True
    )

    def __repr__(self):
        return f'<User {self.email} ({self.role})>'

    # ==================== Propriétés ====================

    @property
    def full_name(self) -> str:
        return f"{self.prenom} {self.nom}"

    # ==================== Mot de passe (bcrypt, coût 12) ====================

    def set_password(self, password: str) -> None:
        """Hash le mot de passe avec bcrypt (facteur 12) et le stocke."""
        self.password_hash = bcrypt.generate_password_hash(
            password, rounds=12
        ).decode('utf-8')

    def check_password(self, password: str) -> bool:
        """Vérifie le mot de passe contre le hash bcrypt stocké."""
        return bcrypt.check_password_hash(self.password_hash, password)

    # ==================== MFA TOTP ====================

    def generate_mfa_secret(self) -> str:
        """Génère et stocke un nouveau secret TOTP Base32."""
        self.mfa_secret = pyotp.random_base32()
        return self.mfa_secret

    def get_totp_uri(self, app_name: str = "Assurances BIAT") -> str:
        """Retourne l'URI otpauth:// pour le QR code Authenticator."""
        if not self.mfa_secret:
            self.generate_mfa_secret()
        totp = pyotp.TOTP(self.mfa_secret)
        return totp.provisioning_uri(name=self.email, issuer_name=app_name)

    def verify_totp(self, token: str) -> bool:
        """Vérifie un code OTP à 6 chiffres (fenêtre de tolérance ±1 période)."""
        if not self.mfa_secret:
            return False
        totp = pyotp.TOTP(self.mfa_secret)
        return totp.verify(token, valid_window=1)

    def enable_mfa(self) -> None:
        """Active la 2FA (mfa_secret doit déjà être défini)."""
        if not self.mfa_secret:
            self.generate_mfa_secret()
        self.mfa_enabled = True

    def disable_mfa(self) -> None:
        """Désactive la 2FA et efface le secret."""
        self.mfa_enabled = False
        self.mfa_secret = None

    # ==================== Sérialisation ====================

    def to_dict(self, include_sensitive: bool = False) -> dict:
        data = {
            'id':          str(self.id),
            'nom':         self.nom,
            'prenom':      self.prenom,
            'full_name':   self.full_name,
            'email':       self.email,
            'role':        self.role,
            'is_active':   self.is_active,
            'mfa_enabled': self.mfa_enabled,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
            'updated_at':  self.updated_at.isoformat() if self.updated_at else None,
            'last_login':  self.last_login.isoformat() if self.last_login else None,
        }
        if include_sensitive and self.mfa_secret:
            data['mfa_secret'] = self.mfa_secret
        return data
