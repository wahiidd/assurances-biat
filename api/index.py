import sys
import os

# Ajout du dossier racine au sys.path pour permettre l'importation du dossier backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.app import create_app

# Point d'entrée pour Vercel
app = create_app('production')
