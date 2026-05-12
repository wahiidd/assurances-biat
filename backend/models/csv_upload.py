"""
Modèle CsvUpload — Assurances BIAT
Trace chaque fichier CSV uploadé par un admin
"""
import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID as PGUUID
from extensions import db

VALID_STATUSES = ('pending', 'processing', 'done', 'error')


class CsvUpload(db.Model):
    """
    Trace chaque upload CSV.
    Le traitement est synchrone — le statut reflète l'état en temps réel.
    """
    __tablename__ = 'csv_uploads'

    id          = db.Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_by = db.Column(
        PGUUID(as_uuid=True),
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True
    )
    filename    = db.Column(db.String(255), nullable=False)
    filepath    = db.Column(db.String(500), nullable=False)
    nb_lignes   = db.Column(db.Integer, nullable=True)
    status      = db.Column(db.String(20), nullable=False, default='pending')
    error_msg   = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self):
        return f'<CsvUpload {self.filename} status={self.status}>'

    def to_dict(self) -> dict:
        return {
            'id':          str(self.id),
            'filename':    self.filename,
            'nb_lignes':   self.nb_lignes,
            'status':      self.status,
            'error_msg':   self.error_msg,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'uploaded_by': str(self.uploaded_by) if self.uploaded_by else None,
        }
