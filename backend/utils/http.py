"""
Utilitaires HTTP partagés — Assurances BIAT
Fonctions extraites des routes pour éviter la duplication et respecter le SRP.
"""
from functools import wraps
from flask import request, jsonify


def get_client_ip() -> str:
    """Retourne l'adresse IP du client (supporte X-Forwarded-For)."""
    return request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'


def validate_json(*required_fields):
    """Décorateur : valide la présence des champs JSON obligatoires."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({'error': 'Content-Type doit être application/json'}), 400
            data = request.get_json(silent=True)
            if data is None:
                return jsonify({'error': 'Corps JSON invalide'}), 400
            missing = [field for field in required_fields if field not in data]
            if missing:
                return jsonify({'error': f'Champs manquants : {", ".join(missing)}'}), 400
            return f(*args, **kwargs)
        return decorated_function
    return decorator
