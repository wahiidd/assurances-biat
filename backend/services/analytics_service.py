"""
Service d'analyse KPI — Assurances BIAT

Calcule les 4 dimensions de KPIs à partir du fichier base_annee_rachat.csv.
Retourne des tuples (dict, status_code) — aucune dépendance Flask HTTP.
"""
import os
import glob
import math

import pandas as pd
import numpy as np
from flask import current_app

CSV_FILENAME = "base_annee_rachat.csv"
CSV_FILENAME_VARIANTS = [
    "base_annee_rachat.csv",
    "Base_annee_rachat.csv",
    "BASE_ANNEE_RACHAT.csv",
    "Base_Annee_Rachat.csv",
]


# ==================== Utilitaires internes ====================

def _find_csv(upload_folder: str) -> str | None:
    """
    Cherche base_annee_rachat.csv dans cet ordre :
    1. Dossier uploads/ — toutes les variantes de casse (nom exact)
    2. Dossier uploads/ — avec préfixe UUID (glob *rachat.csv)
    3. Répertoire parent (racine backend)
    """
    # 1. Nom exact (toutes variantes de casse) dans uploads/
    for variant in CSV_FILENAME_VARIANTS:
        exact = os.path.join(upload_folder, variant)
        if os.path.exists(exact):
            return exact

    # 2. Avec préfixe UUID — chercher tout fichier contenant "rachat"
    for pattern in [
        os.path.join(upload_folder, "*rachat*.csv"),
        os.path.join(upload_folder, "*Rachat*.csv"),
    ]:
        files = glob.glob(pattern)
        if files:
            return max(files, key=os.path.getmtime)

    # 3. Racine backend (dossier parent de uploads/)
    parent = os.path.dirname(os.path.abspath(upload_folder))
    for variant in CSV_FILENAME_VARIANTS:
        root_path = os.path.join(parent, variant)
        if os.path.exists(root_path):
            return root_path

    return None


def _load_df(filepath: str) -> pd.DataFrame:
    """Charge, nettoie et type-caste le DataFrame."""
    df = pd.read_csv(filepath, sep=';', encoding='utf-8', low_memory=False)
    df.columns = [c.strip() for c in df.columns]

    # Renommer "année de rachat" (avec espace et accent)
    for col in list(df.columns):
        if 'ann' in col.lower() and 'rachat' in col.lower():
            df = df.rename(columns={col: 'annee_rachat'})
            break

    # Parsing des dates
    for col in ['Debut', 'Fin']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], dayfirst=True, errors='coerce')

    # Colonnes numériques
    numeric_cols = [
        'Montant_Initial_Versement', 'Montant_Regulier', 'TMP_ANNUITY_TERM',
        'Age', 'Anciennete', 'Charge_Finale', 'Rachat', 'Annee_Effet', 'annee_rachat'
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    return df


def _safe(val):
    """Convertit les types numpy → Python natif, gère NaN/inf → None."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if hasattr(val, 'item'):
        v = val.item()
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v
    return val


# ==================== Point d'entrée principal ====================

def compute_kpis(upload_folder: str, filters: dict = None) -> tuple:
    """Calcule et retourne tous les KPIs. Retourne (dict, status_code)."""
    filepath = _find_csv(upload_folder)
    if not filepath:
        return {
            'error': (
                f"Fichier '{CSV_FILENAME}' introuvable. "
                "Veuillez l'uploader via la section CSV de la page Admin."
            )
        }, 404

    try:
        global_df = _load_df(filepath)
    except Exception as e:
        return {'error': f"Erreur de lecture du fichier CSV : {e}"}, 500

    if len(global_df) == 0:
        return {'error': "Le fichier CSV est vide."}, 400

    # -- Récupérer les options de filtres globales (AVANT filtrage)
    villes_disponibles = sorted([str(v) for v in global_df['Ville'].dropna().unique()]) if 'Ville' in global_df.columns else []
    annees_disponibles = sorted([int(v) for v in global_df['Annee_Effet'].dropna().unique()]) if 'Annee_Effet' in global_df.columns else []
    types_versement_disponibles = sorted([str(v) for v in global_df['Type_versement'].dropna().unique()]) if 'Type_versement' in global_df.columns else []
    montant_min_global = _safe(global_df['Montant_Initial_Versement'].min()) if 'Montant_Initial_Versement' in global_df.columns else None
    montant_max_global = _safe(global_df['Montant_Initial_Versement'].max()) if 'Montant_Initial_Versement' in global_df.columns else None

    # -- Copie pour le filtrage
    df = global_df.copy()

    # -- Appliquer les filtres
    filters = filters or {}

    if filters.get('ville'):
        df = df[df['Ville'] == filters['ville']]

    if filters.get('annee'):
        try:
            df = df[df['Annee_Effet'] == float(filters['annee'])]
        except ValueError:
            pass

    if filters.get('type_versement'):
        df = df[df['Type_versement'] == filters['type_versement']]

    if filters.get('annee_min'):
        try:
            df = df[df['Annee_Effet'] >= float(filters['annee_min'])]
        except ValueError:
            pass

    if filters.get('annee_max'):
        try:
            df = df[df['Annee_Effet'] <= float(filters['annee_max'])]
        except ValueError:
            pass

    if filters.get('montant_min'):
        try:
            df = df[df['Montant_Initial_Versement'] >= float(filters['montant_min'])]
        except ValueError:
            pass

    if filters.get('montant_max'):
        try:
            df = df[df['Montant_Initial_Versement'] <= float(filters['montant_max'])]
        except ValueError:
            pass

    total = len(df)
    if total == 0:
        return {'error': "Aucune donnée disponible pour ces critères de filtrage.", 'empty_filter': True}, 404

    return {
        'meta': {
            'nb_total_polices': total,
            'fichier':          os.path.basename(filepath),
            'villes_disponibles': villes_disponibles,
            'annees_disponibles': annees_disponibles,
            'types_versement_disponibles': types_versement_disponibles,
            'montant_range': {'min': montant_min_global, 'max': montant_max_global},
        },
        'demographique':   _kpi_demographique(df),
        'temporelle':      _kpi_temporelle(df),
        'financiere':      _kpi_financiere(df),
        'comportementale': _kpi_comportementale(df),
        'epargne_rachat':  _kpi_epargne_rachat(df),
    }, 200


# ==================== 5. Épargne & Rachat ====================

def _kpi_epargne_rachat(df: pd.DataFrame) -> dict:
    """Séries temporelles épargne/rachat utiles pour les graphes dynamiques."""

    # -- 1. Évolution annuelle de l'épargne et du rachat --
    epargne_par_annee = []
    if 'Annee_Effet' in df.columns:
        agg = {}
        if 'Montant_Initial_Versement' in df.columns:
            agg['montant_initial_moyen'] = ('Montant_Initial_Versement', 'mean')
            agg['montant_initial_total'] = ('Montant_Initial_Versement', 'sum')
        if 'Montant_Regulier' in df.columns:
            agg['montant_regulier_moyen'] = ('Montant_Regulier', 'mean')
        if 'Rachat' in df.columns:
            agg['taux_rachat']  = ('Rachat', 'mean')
            agg['nb_rachats']   = ('Rachat', 'sum')
        if 'ID_Police' in df.columns:
            agg['nb_contrats'] = ('ID_Police', 'count')

        if agg:
            g = df.dropna(subset=['Annee_Effet']).groupby('Annee_Effet').agg(**agg).reset_index()
            for _, r in g.sort_values('Annee_Effet').iterrows():
                row = {'annee': int(r['Annee_Effet'])}
                for k in agg:
                    row[k] = _safe(r.get(k))
                epargne_par_annee.append(row)

    # -- 2. Montant initial (tranches) vs taux de rachat --
    montant_vs_rachat = []
    if 'Montant_Initial_Versement' in df.columns and 'Rachat' in df.columns:
        bins   = [0, 1000, 5000, 10000, 25000, 50000, 999_999_999]
        labels = ['< 1k', '1k-5k', '5k-10k', '10k-25k', '25k-50k', '> 50k']
        tmp = df[['Montant_Initial_Versement', 'Rachat']].dropna().copy()
        tmp['tranche'] = pd.cut(tmp['Montant_Initial_Versement'], bins=bins, labels=labels, right=False)
        agg2 = tmp.groupby('tranche')['Rachat'].agg(['mean', 'count']).reset_index()
        montant_vs_rachat = [
            {'tranche': str(r['tranche']), 'taux_rachat': _safe(r['mean']), 'nb_contrats': int(r['count'])}
            for _, r in agg2.iterrows()
        ]

    # -- 3. Répartition épargne par type de versement --
    epargne_par_type = []
    if 'Type_versement' in df.columns and 'Montant_Initial_Versement' in df.columns:
        agg3 = df.groupby('Type_versement').agg(
            montant_moyen=('Montant_Initial_Versement', 'mean'),
            nb_contrats=('Montant_Initial_Versement', 'count'),
            taux_rachat=('Rachat', 'mean') if 'Rachat' in df.columns else ('Montant_Initial_Versement', 'count'),
        ).reset_index()
        epargne_par_type = [
            {
                'type': str(r['Type_versement']),
                'montant_moyen': _safe(r['montant_moyen']),
                'nb_contrats': int(r['nb_contrats']),
                'taux_rachat': _safe(r.get('taux_rachat')),
            }
            for _, r in agg3.iterrows()
        ]

    return {
        'epargne_par_annee':  epargne_par_annee,
        'montant_vs_rachat':  montant_vs_rachat,
        'epargne_par_type':   epargne_par_type,
    }


# ==================== 1. Dimension Démographique ====================

def _kpi_demographique(df: pd.DataFrame) -> dict:
    """Âge moyen souscription · Densité par zone · Valeur par ville."""

    # — KPI 1 : Âge moyen à la souscription (Age - Ancienneté) —
    if 'Age' in df.columns and 'Anciennete' in df.columns:
        age_souscription = (df['Age'] - df['Anciennete']).dropna()
        age_moyen = _safe(age_souscription.mean())
        age_min   = _safe(age_souscription.min())
        age_max   = _safe(age_souscription.max())

        bins   = [0, 25, 35, 45, 55, 65, 120]
        labels = ['< 25', '25–35', '35–45', '45–55', '55–65', '> 65']
        tranches = pd.cut(age_souscription, bins=bins, labels=labels, right=False)
        distribution_age = [
            {'tranche': str(l), 'nb': int(v)}
            for l, v in tranches.value_counts().sort_index().items()
        ]
    else:
        age_moyen = age_min = age_max = None
        distribution_age = []

    # — KPI 2 : Densité de portefeuille par Code Postal —
    if 'Code_Postal' in df.columns and 'ID_Police' in df.columns:
        densite = (
            df.groupby('Code_Postal')['ID_Police']
            .count()
            .sort_values(ascending=False)
            .head(20)
            .reset_index()
        )
        densite_par_zone = [
            {'code_postal': str(r['Code_Postal']), 'nb_contrats': int(r['ID_Police'])}
            for _, r in densite.iterrows()
        ]
    else:
        densite_par_zone = []

    # — KPI 3 : Valeur client par Ville —
    if 'Ville' in df.columns and 'Montant_Initial_Versement' in df.columns:
        valeur = (
            df.groupby('Ville')['Montant_Initial_Versement']
            .agg(['sum', 'count'])
            .sort_values('sum', ascending=False)
            .head(15)
            .reset_index()
        )
        valeur_par_ville = [
            {
                'ville':         str(r['Ville']),
                'montant_total': _safe(r['sum']),
                'nb_contrats':   int(r['count']),
            }
            for _, r in valeur.iterrows()
        ]
    else:
        valeur_par_ville = []

    return {
        'age_moyen_souscription':      age_moyen,
        'age_min_souscription':        age_min,
        'age_max_souscription':        age_max,
        'distribution_age':            distribution_age,
        'densite_par_zone':            densite_par_zone,
        'valeur_par_ville':            valeur_par_ville,
    }


# ==================== 2. Dimension Temporelle ====================

def _kpi_temporelle(df: pd.DataFrame) -> dict:
    """Taux de maturité · Recrutement annuel · Indice de stabilité."""

    # — KPI 1 : Taux de Maturité Moyen —
    taux_maturite_moyen  = None
    distribution_maturite = []

    if 'Debut' in df.columns and 'Fin' in df.columns and 'Anciennete' in df.columns:
        duree_prevue_ans = (df['Fin'] - df['Debut']).dt.days / 365.25
        ratio = (df['Anciennete'] / duree_prevue_ans).replace([np.inf, -np.inf], np.nan)
        taux_maturite_moyen = _safe(ratio.mean())

        bins   = [0, 0.25, 0.50, 0.75, 1.00, 99]
        labels = ['0–25%', '25–50%', '50–75%', '75–100%', '> 100%']
        tranches = pd.cut(ratio.dropna(), bins=bins, labels=labels, right=False)
        distribution_maturite = [
            {'tranche': str(l), 'nb': int(v)}
            for l, v in tranches.value_counts().sort_index().items()
        ]

    # — KPI 2 : Rythme de Recrutement Annuel —
    recrutement_annuel = []
    if 'Annee_Effet' in df.columns and 'ID_Police' in df.columns:
        recr = (
            df.dropna(subset=['Annee_Effet'])
            .groupby('Annee_Effet')['ID_Police']
            .count()
            .sort_index()
            .reset_index()
        )
        recrutement_annuel = [
            {'annee': int(r['Annee_Effet']), 'nb_polices': int(r['ID_Police'])}
            for _, r in recr.iterrows()
        ]

    # — KPI 3 : Indice de Stabilité (corr Ancienneté ↔ absence de Rachat) —
    indice_stabilite  = None
    stabilite_label   = "Données insuffisantes"
    distribution_anciennete = []

    if 'Anciennete' in df.columns and 'Rachat' in df.columns:
        sub = df[['Anciennete', 'Rachat']].dropna()
        if len(sub) > 1:
            sub = sub.copy()
            sub['fidelite'] = 1 - sub['Rachat']
            corr = sub['Anciennete'].corr(sub['fidelite'])
            indice_stabilite = _safe(corr)
            if indice_stabilite is not None:
                if indice_stabilite > 0.5:
                    stabilite_label = "Forte stabilité"
                elif indice_stabilite > 0.2:
                    stabilite_label = "Stabilité modérée"
                elif indice_stabilite >= 0:
                    stabilite_label = "Légère stabilité"
                else:
                    stabilite_label = "Instabilité détectée"

        bins   = [0, 2, 5, 10, 15, 20, 999]
        labels = ['0–2 ans', '2–5 ans', '5–10 ans', '10–15 ans', '15–20 ans', '> 20 ans']
        tranches = pd.cut(df['Anciennete'].dropna(), bins=bins, labels=labels, right=False)
        distribution_anciennete = [
            {'tranche': str(l), 'nb': int(v)}
            for l, v in tranches.value_counts().sort_index().items()
        ]

    return {
        'taux_maturite_moyen':   taux_maturite_moyen,
        'distribution_maturite': distribution_maturite,
        'recrutement_annuel':    recrutement_annuel,
        'indice_stabilite':      indice_stabilite,
        'stabilite_label':       stabilite_label,
        'distribution_anciennete': distribution_anciennete,
    }


# ==================== 3. Dimension Financière ====================

def _kpi_financiere(df: pd.DataFrame) -> dict:
    """Comparaison simplifiée : Avec Rachat vs Sans Rachat."""

    # -- 1. Ratio Global (Santé Financière) --
    taux_chargement_global = None
    total_charges          = 0.0
    total_encours_estime    = 0.0
    cols_chargement = ['Charge_Finale', 'Montant_Initial_Versement', 'Montant_Regulier', 'Anciennete']
    if all(c in df.columns for c in cols_chargement):
        total_charges = df['Charge_Finale'].sum()
        encours = df['Montant_Initial_Versement'] + (df['Montant_Regulier'] * df['Anciennete'])
        total_encours_estime = encours.sum()
        if total_encours_estime > 0:
            taux_chargement_global = _safe(total_charges / total_encours_estime)


    # -- 2. Comparaison Rachat vs Sans Rachat --
    comp_rachat = {
        'avec': {'total': 0.0, 'nb': 0, 'distribution': []},
        'sans': {'total': 0.0, 'nb': 0, 'distribution': []}
    }

    if 'Montant_Initial_Versement' in df.columns and 'Rachat' in df.columns:
        bins   = [0, 1000, 5000, 20000, 50000, 999_999_999]
        labels = ['0-1k', '1k-5k', '5k-20k', '20k-50k', '50k+']

        for key, rachat_val in [('avec', 1), ('sans', 0)]:
            sub = df[df['Rachat'] == rachat_val]
            comp_rachat[key]['total'] = _safe(sub['Montant_Initial_Versement'].sum())
            comp_rachat[key]['nb']    = len(sub)
            if len(sub) > 0:
                sub = sub.copy()
                sub['tranche'] = pd.cut(sub['Montant_Initial_Versement'], bins=bins, labels=labels, right=False)
                dist = sub.groupby('tranche', observed=True)['Montant_Initial_Versement'].agg(['count', 'sum']).reset_index()
                comp_rachat[key]['distribution'] = [
                    {'label': str(r['tranche']), 'nb': int(r['count']), 'total': _safe(r['sum'])}
                    for _, r in dist.iterrows()
                ]

    return {
        'taux_chargement_global':   taux_chargement_global,
        'total_charges':            _safe(total_charges),
        'total_encours_estime':     _safe(total_encours_estime),
        'comparaison_rachat':       comp_rachat
    }

# ==================== 4. Dimension Comportementale ====================

def _kpi_comportementale(df: pd.DataFrame) -> dict:
    """Taux de churn · Préférence fréquence · Indice de vulnérabilité."""

    # — KPI 1 : Taux de Churn —
    taux_churn = None
    nb_rachats  = 0
    if 'Rachat' in df.columns:
        taux_churn = _safe(df['Rachat'].mean())
        nb_rachats  = int(df['Rachat'].sum())

    # — KPI 2 : Préférence Type_versement —
    preference_type_versement = []
    if 'Type_versement' in df.columns:
        dist = df['Type_versement'].value_counts()
        total_type = dist.sum()
        preference_type_versement = [
            {'type': str(t), 'nb': int(v), 'pct': round(v / total_type * 100, 1)}
            for t, v in dist.items()
        ]

    # Distribution Fréquence (colonne Frequence différente de Type_versement)
    distribution_frequence = []
    if 'Frequence' in df.columns:
        dist2 = df['Frequence'].value_counts()
        total2 = dist2.sum()
        distribution_frequence = [
            {'frequence': str(t), 'nb': int(v), 'pct': round(v / total2 * 100, 1)}
            for t, v in dist2.items()
        ]

    # — KPI 3 : Indice de Vulnérabilité (Ancienneté ≤ 3 ans & Rachat = 1) —
    indice_vulnerabilite  = None
    pct_rachets_precoces  = None
    nb_vulnerables        = 0
    rachat_par_anciennete = []

    if 'Anciennete' in df.columns and 'Rachat' in df.columns:
        seuil_anc   = 3
        mask_vuln   = (df['Anciennete'] <= seuil_anc) & (df['Rachat'] == 1)
        nb_vulnerables      = int(mask_vuln.sum())
        total_rachets       = int((df['Rachat'] == 1).sum())
        total_polices       = len(df)
        indice_vulnerabilite = _safe(nb_vulnerables / total_polices) if total_polices > 0 else None
        pct_rachets_precoces = _safe(nb_vulnerables / total_rachets * 100) if total_rachets > 0 else None

        # Taux de rachat par tranche d'ancienneté
        bins   = [0, 2, 5, 10, 15, 20, 999]
        labels = ['0–2 ans', '2–5 ans', '5–10 ans', '10–15 ans', '15–20 ans', '> 20 ans']
        tmp = df[['Anciennete', 'Rachat']].dropna().copy()
        tmp['tranche'] = pd.cut(tmp['Anciennete'], bins=bins, labels=labels, right=False)
        agg = tmp.groupby('tranche')['Rachat'].agg(['mean', 'count']).reset_index()
        rachat_par_anciennete = [
            {
                'tranche':     str(r['tranche']),
                'nb_contrats': int(r['count']),
                'taux_rachat': _safe(r['mean']),
            }
            for _, r in agg.iterrows()
        ]

    return {
        'taux_churn':                taux_churn,
        'nb_rachats':                nb_rachats,
        'preference_type_versement': preference_type_versement,
        'distribution_frequence':    distribution_frequence,
        'indice_vulnerabilite':      indice_vulnerabilite,
        'pct_rachets_precoces':      pct_rachets_precoces,
        'nb_contrats_vulnerables':   nb_vulnerables,
        'rachat_par_anciennete':     rachat_par_anciennete,
    }
