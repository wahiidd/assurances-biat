import sys
import os

# Ajout de la racine et du dossier backend au sys.path
root_dir = os.path.join(os.path.dirname(__file__), '..')
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, 'backend'))

from backend.app import create_app

# Point d'entrée pour Vercel
app = create_app('production')

@app.route('/api/ping')
def ping():
    return {"status": "pong", "message": "Flask is alive on Vercel"}
