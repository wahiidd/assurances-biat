"""
Contrôleur d'analyses KPI — Assurances BIAT

Responsabilité unique : exposer les KPIs calculés par analytics_service
via l'endpoint /api/analytics/kpis (admin uniquement).
"""
from functools import wraps

from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from models.user import User
import services.analytics_service as analytics_service

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


# ── Décorateur admin (identique à admin.py, extrait pour être autonome) ────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({'error': 'Authentification requise'}), 401

        user_id = get_jwt_identity()
        user = User.query.filter_by(id=user_id).first()

        if not user or not user.is_active:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        if user.role != 'admin':
            return jsonify({'error': 'Accès réservé aux administrateurs'}), 403

        return f(*args, **kwargs)
    return decorated


# ── Routes ─────────────────────────────────────────────────────────────────────

@analytics_bp.route('/kpis', methods=['GET'])
@admin_required
def get_kpis():
    """
    Calcule et retourne les 4 dimensions de KPIs depuis base_annee_rachat.csv.
    Le fichier doit avoir été uploadé préalablement via /api/admin/csv/upload.
    """
    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    
    # Extraire les filtres de la requête
    filters = {}
    for param in ['ville', 'annee', 'type_versement', 'annee_min', 'annee_max', 'montant_min', 'montant_max']:
        if param in request.args and request.args.get(param):
            filters[param] = request.args.get(param)

    result, status = analytics_service.compute_kpis(upload_folder, filters)
    return jsonify(result), status
