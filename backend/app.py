"""
Application Flask principale — Assurances BIAT
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from extensions import db, jwt, bcrypt, mail


def create_app(config_name: str = None) -> Flask:
    """
    Factory function — crée et configure l'application Flask.

    Args:
        config_name: 'development' | 'production' (défaut : FLASK_ENV env var)

    Returns:
        Instance Flask configurée
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # ── Extensions ──────────────────────────────────────────────────
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)

    # ── CORS (Next.js frontend) ──────────────────────────────────────
    CORS(app, resources={
        r'/api/*': {
            'origins': [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
            ],
            'methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            'allow_headers': ['Content-Type', 'Authorization'],
            'supports_credentials': True,
        }
    })

    # ── Blueprints ───────────────────────────────────────────────────
    from routes.auth import auth_bp
    from routes.admin import admin_bp
    from routes.analytics import analytics_bp
    from routes.ml import ml_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(ml_bp)

    # ── Route de santé ───────────────────────────────────────────────
    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({
            'status':  'ok',
            'message': 'API Assurances BIAT opérationnelle',
        }), 200

    # ── Callbacks JWT ────────────────────────────────────────────────
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error':   'Session expirée',
            'message': 'Veuillez vous reconnecter',
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'error':   'Token invalide',
            'message': str(error),
        }), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authentification requise'}), 401

    # ── Gestionnaire d'erreurs global ────────────────────────────────
    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.error(f"ERREUR CRITIQUE: {str(e)}")
        return jsonify({
            "error": "Internal Server Error",
            "message": str(e)
        }), 500

    # ── Création des tables (Sécurisée pour le déploiement) ──────────
    try:
        with app.app_context():
            # Importer tous les modèles pour que SQLAlchemy les enregistre
            from .models.user import User
            from .models.invitation import Invitation
            from .models.csv_upload import CsvUpload
            from .models.audit_log import AuditLog
            # db.create_all() # Désactivé pour éviter les timeouts en production
            pass
    except Exception as e:
        app.logger.error(f"Erreur au démarrage : {e}")

    return app


# ── Point d'entrée développement ────────────────────────────────────
if __name__ == '__main__':
    app = create_app('development')
    app.run(host='0.0.0.0', port=5000, debug=True)
