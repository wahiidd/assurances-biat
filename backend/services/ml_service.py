"""
ml_service.py — Pipeline ML complet pour la prédiction de rachat BIAT

Process :
  1. Chargement et nettoyage du CSV
  2. Encoding des variables catégorielles
  3. Entraînement : Régression Logistique, Random Forest, XGBoost
  4. Évaluation avec cross-validation 5-fold
  5. Corrélations et Feature Importance
  6. Analyse SHAP du meilleur modèle
  7. Scoring des contrats PM (Rachat == 0)
"""

import os
import json
import glob
import warnings
import logging
import math
from datetime import datetime

import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    roc_auc_score, f1_score, accuracy_score,
    precision_score, recall_score, confusion_matrix, roc_curve
)

from xgboost import XGBClassifier
import shap

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────

CSV_VARIANTS = [
    "base_annee_rachat.csv",
    "Base_annee_rachat.csv",
    "Base_Annee_Rachat.csv",
    "BASE_ANNEE_RACHAT.csv",
]

COLS_A_SUPPRIMER = ["ID_Police", "Date_Naissance", "Debut", "Fin", "ï»¿ID_Police",
                     "annee_rachat", "année de rachat", "Annee_Rachat"]

CAT_COLS = ["Type_versement", "Frequence", "Ville", "Agence", "Beneficiaires"]

RESULTS_FILE = os.path.join(os.path.dirname(__file__), "..", "uploads", "ml_results.json")
SCORING_FILE  = os.path.join(os.path.dirname(__file__), "..", "uploads", "scoring_pm.csv")
EXPLANATIONS_FILE = os.path.join(os.path.dirname(__file__), "..", "uploads", "pm_explanations.json")

# ── Utilitaires ───────────────────────────────────────────────────────────────

def _safe(val):
    """Convertit numpy → Python natif, gère NaN/inf → None."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if hasattr(val, "item"):
        v = val.item()
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v
    return val


def _find_csv(upload_folder: str) -> str | None:
    for variant in CSV_VARIANTS:
        p = os.path.join(upload_folder, variant)
        if os.path.exists(p):
            return p
    for pattern in [os.path.join(upload_folder, "*rachat*.csv"),
                    os.path.join(upload_folder, "*Rachat*.csv")]:
        files = glob.glob(pattern)
        if files:
            return max(files, key=os.path.getmtime)
    return None


def _load_and_clean(upload_folder: str) -> pd.DataFrame:
    """Charge, nettoie et encode le DataFrame."""
    path = _find_csv(upload_folder)
    if not path:
        raise FileNotFoundError("Fichier base_annee_rachat.csv introuvable dans uploads/")

    df = pd.read_csv(path, sep=";", encoding="utf-8-sig", low_memory=False)
    df.columns = [c.strip().replace("\ufeff", "") for c in df.columns]

    # Supprimer colonnes inutiles
    df = df.drop(columns=[c for c in COLS_A_SUPPRIMER if c in df.columns])

    # Parser dates → Ancienneté si pas déjà présente
    for col in ["Debut", "Fin"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], dayfirst=True, errors="coerce")

    # Colonnes numériques
    num_cols = ["Montant_Initial_Versement", "Montant_Regulier", "Age",
                "Anciennete", "Charge_Finale", "Rachat", "Annee_Effet", "TMP_ANNUITY_TERM"]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Encoding catégoriel
    le = LabelEncoder()
    for col in CAT_COLS:
        if col in df.columns:
            df[col] = df[col].fillna("Inconnu").astype(str)
            df[col] = le.fit_transform(df[col])

    # Supprimer colonnes dates restantes
    date_cols = df.select_dtypes(include=["datetime64", "object"]).columns.tolist()
    df = df.drop(columns=date_cols, errors="ignore")

    # Remplir valeurs manquantes
    for col in df.select_dtypes(include=[np.number]).columns:
        df[col] = df[col].fillna(df[col].median())

    return df


def get_features_info(upload_folder: str) -> dict:
    """
    Charge le dataset, nettoie et calcule la corrélation de chaque feature avec Rachat.
    Retourne la liste pour la sélection de l'utilisateur.
    """
    try:
        df = _load_and_clean(upload_folder)
        if "Rachat" not in df.columns:
            return {"error": "Colonne 'Rachat' manquante."}
        
        corrs = df.corr(numeric_only=True)["Rachat"].drop("Rachat", errors="ignore")
        features = []
        for col, corr in corrs.items():
            if pd.isna(corr): continue
            features.append({
                "name": str(col),
                "correlation": _safe(corr),
                "recommended": abs(corr) >= 0.05
            })
        
        # Trier par correlation absolue
        features.sort(key=lambda x: abs(x["correlation"]), reverse=True)
        return {"features": features}
    except Exception as e:
        logger.error(f"Error getting features info: {e}")
        return {"error": str(e)}


def run_ml_pipeline(upload_folder: str, selected_features: list = None) -> dict:
    """
    Lance le pipeline ML complet et retourne un dict avec tous les résultats.
    Sauvegarde également les résultats dans ml_results.json et scoring_pm.csv.
    """
    logger.info("=== Démarrage Pipeline ML ===")

    # ── 1. Chargement et nettoyage ──────────────────────────────────────────
    df = _load_and_clean(upload_folder)
    logger.info(f"Dataset chargé : {df.shape}")

    if "Rachat" not in df.columns:
        raise ValueError("Colonne 'Rachat' manquante dans le CSV")

    # ── 2. Séparation X / y ────────────────────────────────────────────────
    X = df.drop(columns=["Rachat"])
    y = df["Rachat"].astype(int)

    if selected_features:
        # Filtrer X avec les features sélectionnées existantes
        valid_features = [f for f in selected_features if f in X.columns]
        if valid_features:
            X = X[valid_features]

    logger.info(f"Features : {list(X.columns)}")
    logger.info(f"Taux de rachat : {y.mean():.2%}")

    # ── 3. Split 80/20 stratifié ───────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Normalisation pour LR
    scaler = StandardScaler()
    X_train_sc = pd.DataFrame(scaler.fit_transform(X_train), columns=X_train.columns)
    X_test_sc  = pd.DataFrame(scaler.transform(X_test),  columns=X_test.columns)

    ratio_classes = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

    # ── 4. Définition des modèles (process ML-Copy1.ipynb) ─────────────────
    modeles = {
        "Régression Logistique": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=42
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=300, max_depth=12, min_samples_leaf=10,
            class_weight="balanced", random_state=42, n_jobs=-1
        ),
        "XGBoost": XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=ratio_classes, random_state=42,
            eval_metric="logloss", verbosity=0
        ),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    resultats = {}

    # ── 5. Entraînement + Évaluation ───────────────────────────────────────
    for nom, modele in modeles.items():
        logger.info(f"Entraînement : {nom}")
        est_lr = nom == "Régression Logistique"
        Xtr = X_train_sc if est_lr else X_train
        Xte = X_test_sc  if est_lr else X_test

        modele.fit(Xtr, y_train)
        y_pred  = modele.predict(Xte)
        y_proba = modele.predict_proba(Xte)[:, 1]

        auc       = _safe(roc_auc_score(y_test, y_proba))
        f1        = _safe(f1_score(y_test, y_pred, zero_division=0))
        acc       = _safe(accuracy_score(y_test, y_pred))
        prec      = _safe(precision_score(y_test, y_pred, zero_division=0))
        rec       = _safe(recall_score(y_test, y_pred, zero_division=0))
        cm        = confusion_matrix(y_test, y_pred).tolist()

        cv_scores = cross_val_score(modele, Xtr, y_train, cv=cv,
                                    scoring="roc_auc", n_jobs=-1)

        # ROC curve data
        fpr, tpr, _ = roc_curve(y_test, y_proba)
        # Sous-échantillonner pour le JSON (200 points max pour la fluidité)
        step = max(1, len(fpr) // 200)
        roc_data = [{"fpr": _safe(fpr[i]), "tpr": _safe(tpr[i])} for i in range(0, len(fpr), step)]
        # S'assurer d'inclure le dernier point (1, 1)
        if len(fpr) > 0 and (len(fpr) - 1) % step != 0:
            roc_data.append({"fpr": _safe(fpr[-1]), "tpr": _safe(tpr[-1])})

        # Feature importance
        if est_lr:
            importances = np.abs(modele.coef_[0])
        else:
            importances = modele.feature_importances_

        fi_series = pd.Series(importances, index=Xtr.columns).sort_values(ascending=False)
        feature_importance = [
            {"variable": str(k), "importance": _safe(v)}
            for k, v in fi_series.head(15).items()
        ]

        resultats[nom] = {
            "modele":           modele,
            "y_pred":           y_pred,
            "y_proba":          y_proba,
            "Xte":              Xte,
            "auc":              auc,
            "f1":               f1,
            "accuracy":         acc,
            "precision":        prec,
            "recall":           rec,
            "cv_auc_mean":      _safe(cv_scores.mean()),
            "cv_auc_std":       _safe(cv_scores.std()),
            "confusion_matrix": cm,
            "roc_curve":        roc_data,
            "feature_importance": feature_importance,
        }

    # ── 6. Corrélations ────────────────────────────────────────────────────
    correlations_raw = df.corr(numeric_only=True)["Rachat"].drop("Rachat", errors="ignore")
    correlations = [
        {"variable": str(k), "correlation": _safe(v)}
        for k, v in correlations_raw.sort_values(key=abs, ascending=False).head(15).items()
    ]

    # ── 7. Meilleur modèle ─────────────────────────────────────────────────
    best_name = max(resultats, key=lambda n: resultats[n]["auc"] or 0)
    best      = resultats[best_name]
    logger.info(f"Meilleur modèle : {best_name} (AUC={best['auc']:.4f})")

    # ── 8. Analyse SHAP ────────────────────────────────────────────────────
    logger.info("Calcul SHAP...")
    Xte_shap = best["Xte"]
    modele_best = best["modele"]

    try:
        if best_name in ("XGBoost", "Random Forest"):
            explainer   = shap.TreeExplainer(modele_best)
            shap_values = explainer.shap_values(Xte_shap)
            if isinstance(shap_values, list):  # RF retourne [class0, class1]
                shap_values = shap_values[1]
        else:
            explainer   = shap.LinearExplainer(modele_best, X_train_sc)
            shap_values = explainer.shap_values(Xte_shap)

        shap_importance = pd.Series(
            np.abs(shap_values).mean(axis=0),
            index=Xte_shap.columns
        ).sort_values(ascending=False)

        # Beeswarm data : direction (positive = augmente le risque)
        shap_direction = pd.Series(
            shap_values.mean(axis=0),
            index=Xte_shap.columns
        )

        shap_summary = [
            {
                "variable":  str(k),
                "shap_mean": _safe(v),
                "direction": "positif" if shap_direction[k] > 0 else "négatif",
            }
            for k, v in shap_importance.head(15).items()
        ]

        # SHAP valeurs individuelles pour top 5 variables (beeswarm simplifié)
        top5_vars = list(shap_importance.head(5).index)
        shap_beeswarm = []
        sample_size = min(200, len(Xte_shap))
        for var in top5_vars:
            idx = Xte_shap.columns.get_loc(var)
            feat_vals = Xte_shap[var].values[:sample_size]
            shap_vals = shap_values[:sample_size, idx]
            shap_beeswarm.append({
                "variable": var,
                "points": [
                    {"feature_value": _safe(fv), "shap_value": _safe(sv)}
                    for fv, sv in zip(feat_vals, shap_vals)
                ]
            })

    except Exception as e:
        logger.warning(f"SHAP failed: {e}")
        shap_summary  = []
        shap_beeswarm = []

    # ── 9. Scoring des contrats PM ─────────────────────────────────────────
    logger.info("Scoring des contrats PM...")
    df_pm = df[df["Rachat"] == 0].copy()
    X_pm  = df_pm.drop(columns=["Rachat"])

    # Aligner les features avec celles du modèle
    best_features = best["modele"].feature_names_in_ if hasattr(best["modele"], "feature_names_in_") else X_train.columns
    missing = set(best_features) - set(X_pm.columns)
    for col in missing:
        X_pm[col] = 0
    X_pm = X_pm[best_features]

    if best_name == "Régression Logistique":
        X_pm_inp = pd.DataFrame(scaler.transform(X_pm), columns=X_pm.columns)
    else:
        X_pm_inp = X_pm

    proba_n1 = modele_best.predict_proba(X_pm_inp)[:, 1]

    # Simuler N+1
    proba_n1 = modele_best.predict_proba(X_pm_inp)[:, 1]

    def categorie(p):
        if p >= 0.50:
            return "Élevé"
        elif p >= 0.20:
            return "Modéré"
        return "Faible"

    # Calcul SHAP individuel pour chaque contrat PM
    logger.info("Calcul des explications SHAP individuelles (PM)...")
    pm_explanations = {}
    try:
        if best_name in ("XGBoost", "Random Forest"):
            pm_shap_vals = explainer.shap_values(X_pm_inp)
            if isinstance(pm_shap_vals, list):
                pm_shap_vals = pm_shap_vals[1]
        else:
            pm_shap_vals = explainer.shap_values(X_pm_inp)

        for i, row_idx in enumerate(X_pm.index):
            id_pol = str(df_pm.at[row_idx, "ID_Police"]) if "ID_Police" in df_pm.columns else str(i)
            # Extraire les 3 variables qui augmentent et diminuent le plus le score
            sv = pm_shap_vals[i]
            feat_contribs = [(feat, float(val)) for feat, val in zip(X_pm.columns, sv)]
            feat_contribs.sort(key=lambda x: x[1], reverse=True)
            
            # Top 3 positifs (augmentent rachat)
            top_pos = [{"feature": f, "value": v} for f, v in feat_contribs if v > 0][:3]
            # Top 3 négatifs (réduisent rachat)
            top_neg = [{"feature": f, "value": v} for f, v in reversed(feat_contribs) if v < 0][:3]

            pm_explanations[id_pol] = {
                "proba": _safe(proba_n1[i]),
                "top_positive": top_pos,
                "top_negative": top_neg
            }
        
        os.makedirs(os.path.dirname(EXPLANATIONS_FILE), exist_ok=True)
        with open(EXPLANATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(pm_explanations, f, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Failed to compute individual SHAP: {e}")

    # Récupérer IDs originaux pour le rapport
    path = _find_csv(upload_folder)
    df_raw = pd.read_csv(path, sep=";", encoding="utf-8-sig", low_memory=False)
    df_raw.columns = [c.strip().replace("\ufeff", "") for c in df_raw.columns]
    pm_ids = df_raw[df_raw["Rachat"] == 0]["ID_Police"].astype(str).values[:len(df_pm)]
    
    charge_finale_col = df_pm["Charge_Finale"].values if "Charge_Finale" in df_pm.columns else np.zeros(len(df_pm))

    scoring_df = pd.DataFrame({
        "ID_Police":   pm_ids[:len(proba_n1)],
        "Proba_N+1":   np.round(proba_n1 * 100, 1),
        "Charge_Finale": charge_finale_col,
        "Risque":      [categorie(p) for p in proba_n1],
    })

    os.makedirs(os.path.dirname(SCORING_FILE), exist_ok=True)
    scoring_df.to_csv(SCORING_FILE, index=False, sep=";", encoding="utf-8-sig")
    logger.info(f"Scoring sauvegardé : {SCORING_FILE}")

    # Résumé scoring
    risque_counts = scoring_df["Risque"].value_counts().to_dict()
    charge_estimee = float(scoring_df[scoring_df["Risque"] == "Élevé"]["Charge_Finale"].sum())
    
    # Distribution des scores PM (bacs de 10%)
    bins = np.linspace(0, 100, 11)
    labels = [f"{int(b)}-{int(b+10)}%" for b in bins[:-1]]
    scoring_df["Bin"] = pd.cut(scoring_df["Proba_N+1"], bins=bins, labels=labels, include_lowest=True)
    dist = scoring_df["Bin"].value_counts().sort_index()
    distribution = [{"interval": str(k), "count": int(v)} for k, v in dist.items()]
    
    scoring_summary = {
        "total_pm":       len(scoring_df),
        "risque_eleve":   int(risque_counts.get("Élevé", 0)),
        "risque_modere":  int(risque_counts.get("Modéré", 0)),
        "risque_faible":  int(risque_counts.get("Faible", 0)),
        "charge_estimee": _safe(charge_estimee),
        "distribution":   distribution
    }

    # Top 50 contrats à risque élevé pour l'affichage
    top_risques = (
        scoring_df[scoring_df["Risque"] == "Élevé"]
        .sort_values("Proba_N+1", ascending=False)
        .head(50)
        .to_dict("records")
    )

    # ── 10. Construction du rapport JSON final ─────────────────────────────
    rapport = {
        "status":         "done",
        "timestamp":      datetime.now().isoformat(),
        "best_model":     best_name,
        "nb_lignes_train": len(X_train),
        "nb_features":     len(X.columns),
        "taux_rachat":     _safe(y.mean()),
        "features":        list(X.columns),
        "metrics": {
            nom: {
                "auc":              r["auc"],
                "f1":               r["f1"],
                "accuracy":         r["accuracy"],
                "precision":        r["precision"],
                "recall":           r["recall"],
                "cv_auc_mean":      r["cv_auc_mean"],
                "cv_auc_std":       r["cv_auc_std"],
                "confusion_matrix": r["confusion_matrix"],
                "roc_curve":        r["roc_curve"],
                "feature_importance": r["feature_importance"],
            }
            for nom, r in resultats.items()
        },
        "correlations":      correlations,
        "feature_importance": resultats[best_name]["feature_importance"],
        "shap_summary":      shap_summary,
        "shap_beeswarm":     shap_beeswarm,
        "scoring_summary":   scoring_summary,
        "top_risques":       top_risques,
    }

    # Sauvegarde JSON
    os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, default=str)
    logger.info("Rapport ML sauvegardé.")

    return rapport


def get_cached_results() -> dict | None:
    """Retourne les résultats ML mis en cache (ou None si inexistants)."""
    if os.path.exists(RESULTS_FILE):
        try:
            with open(RESULTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def get_scoring_data(page: int = 1, per_page: int = 50, risque_filter: str = None) -> dict:
    """Retourne les données de scoring paginées depuis scoring_pm.csv."""
    if not os.path.exists(SCORING_FILE):
        return {"error": "Fichier de scoring introuvable. Lancez d'abord le pipeline ML."}

    df = pd.read_csv(SCORING_FILE, sep=";", encoding="utf-8-sig")

    if risque_filter and risque_filter in ("Élevé", "Modéré", "Faible"):
        df = df[df["Risque"] == risque_filter]

    total = len(df)
    start = (page - 1) * per_page
    end   = start + per_page
    page_df = df.iloc[start:end]

    return {
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    math.ceil(total / per_page),
        "data":     page_df.to_dict("records"),
    }

def get_contract_explanation(id_police: str) -> dict:
    """Retourne l'explication SHAP spécifique pour un contrat PM."""
    if not os.path.exists(EXPLANATIONS_FILE):
        return {"error": "Fichier d'explications introuvable."}
    try:
        with open(EXPLANATIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if str(id_police) in data:
                return {"id_police": id_police, "explanation": data[str(id_police)]}
            else:
                return {"error": "Contrat non trouvé ou non évalué (PM)."}
    except Exception as e:
        return {"error": str(e)}
