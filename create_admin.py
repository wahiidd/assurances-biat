import os
import sys
from flask import Flask

# On ajoute le dossier backend au path pour pouvoir importer les modules
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from extensions import db, bcrypt
from models.user import User

def create_admin():
    # On crée une app Flask factice pour avoir le contexte
    app = Flask(__name__)
    
    # Récupération de l'URL de la base de données (Vercel ou Locale)
    # Si vous voulez cibler Vercel, assurez-vous que DATABASE_URL est bien dans votre terminal
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        # Fallback local par défaut si aucune variable n'est définie
        database_url = "postgresql://wahid:wahid@localhost:5432/AssurancesBiatDB"
    
    # Correction pour SQLAlchemy (postgres:// -> postgresql://)
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    bcrypt.init_app(app)
    
    with app.app_context():
        email = "admin@biat.tn"
        user = User.query.filter_by(email=email).first()
        
        if user:
            print(f"L'utilisateur {email} existe déjà. Mise à jour du mot de passe et du rôle...")
        else:
            print(f"Création de l'utilisateur {email}...")
            user = User(email=email, nom="Admin", prenom="BIAT")
        
        # On définit le mot de passe avec la méthode Bcrypt de l'app
        user.set_password("AdminBiat2026!")
        user.role = "admin"
        user.is_active = True
        user.mfa_enabled = False # Bypass MFA comme demandé
        
        if not user.id:
            db.session.add(user)
            
        db.session.commit()
        print("Opération réussie ! Vous pouvez maintenant vous connecter.")

if __name__ == "__main__":
    create_admin()
