"""
Utilitaires base de données partagés — Assurances BIAT
Extrait des routes pour centraliser la gestion des commits SQLAlchemy.
"""
from flask import current_app
from extensions import db


def safe_commit() -> bool:
    """Committe la session ou rollback en cas d'erreur. Retourne True si succès."""
    try:
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"DB commit error: {e}")
        return False
