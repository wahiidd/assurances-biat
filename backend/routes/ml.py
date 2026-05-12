"""
Routes ML — /api/ml/*
Lance le pipeline ML en arrière-plan et expose les résultats.
"""
import threading
import logging
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required

logger = logging.getLogger(__name__)

ml_bp = Blueprint("ml", __name__, url_prefix="/api/ml")

# État global du pipeline (simple flag en mémoire)
_pipeline_state = {"status": "idle", "error": None}
_pipeline_lock  = threading.Lock()


def _run_pipeline_bg(upload_folder: str, selected_features: list = None):
    """Exécute le pipeline ML dans un thread séparé."""
    from services.ml_service import run_ml_pipeline
    with _pipeline_lock:
        _pipeline_state["status"] = "running"
        _pipeline_state["error"]  = None
    try:
        run_ml_pipeline(upload_folder, selected_features)
        with _pipeline_lock:
            _pipeline_state["status"] = "done"
        logger.info("Pipeline ML terminé avec succès.")
    except Exception as e:
        with _pipeline_lock:
            _pipeline_state["status"] = "error"
            _pipeline_state["error"]  = str(e)
        logger.error(f"Pipeline ML échoué : {e}", exc_info=True)


# ── GET /api/ml/status ─────────────────────────────────────────────────────────
@ml_bp.route("/status", methods=["GET"])
@jwt_required()
def ml_status():
    """Retourne l'état actuel du pipeline ML."""
    from services.ml_service import get_cached_results
    cached = get_cached_results()

    with _pipeline_lock:
        state = _pipeline_state.copy()

    # Si on a des résultats en cache et que le pipeline n'est pas en cours
    if cached and state["status"] != "running":
        state["status"]    = "done"
        state["timestamp"] = cached.get("timestamp")
        state["best_model"]= cached.get("best_model")

    return jsonify(state), 200


# ── GET /api/ml/features-info ──────────────────────────────────────────────────
@ml_bp.route("/features-info", methods=["GET"])
@jwt_required()
def ml_features_info():
    """Retourne la liste des features et leurs corrélations pour sélection."""
    from services.ml_service import get_features_info
    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    info = get_features_info(upload_folder)
    if "error" in info:
        return jsonify(info), 400
    return jsonify(info), 200


# ── POST /api/ml/run ───────────────────────────────────────────────────────────
@ml_bp.route("/run", methods=["POST"])
@jwt_required()
def ml_run():
    """Lance le pipeline ML en arrière-plan avec les features sélectionnées."""
    data = request.get_json() or {}
    selected_features = data.get("selected_features", None)

    with _pipeline_lock:
        if _pipeline_state["status"] == "running":
            return jsonify({"status": "running", "message": "Pipeline déjà en cours…"}), 202

    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")

    thread = threading.Thread(
        target=_run_pipeline_bg,
        args=(upload_folder, selected_features),
        daemon=True
    )
    thread.start()

    return jsonify({
        "status":  "running",
        "message": "Pipeline ML lancé. Vérifiez /api/ml/status toutes les 5 secondes."
    }), 202


# ── GET /api/ml/results ────────────────────────────────────────────────────────
@ml_bp.route("/results", methods=["GET"])
@jwt_required()
def ml_results():
    """Retourne les résultats complets du dernier pipeline."""
    from services.ml_service import get_cached_results
    results = get_cached_results()

    if not results:
        return jsonify({
            "error": "Aucun résultat disponible. Lancez d'abord le pipeline via POST /api/ml/run"
        }), 404

    return jsonify(results), 200


# ── GET /api/ml/scoring ────────────────────────────────────────────────────────
@ml_bp.route("/scoring", methods=["GET"])
@jwt_required()
def ml_scoring():
    """Retourne les données de scoring paginées."""
    from services.ml_service import get_scoring_data
    page         = int(request.args.get("page", 1))
    per_page     = int(request.args.get("per_page", 50))
    risque_filter = request.args.get("risque", None)

    data = get_scoring_data(page=page, per_page=per_page, risque_filter=risque_filter)

    if "error" in data:
        return jsonify(data), 404

    return jsonify(data), 200


# ── GET /api/ml/contract/<id_police> ───────────────────────────────────────────
@ml_bp.route("/contract/<id_police>", methods=["GET"])
@jwt_required()
def ml_contract_explanation(id_police):
    """Retourne l'explication SHAP locale pour un contrat spécifique."""
    from services.ml_service import get_contract_explanation
    data = get_contract_explanation(id_police)
    
    if "error" in data:
        return jsonify(data), 404
        
    return jsonify(data), 200
