import os
import uuid
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from sqlalchemy.dialects.postgresql import UUID

# Configuration minimale
load_dotenv()
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# Modèle simplifié pour l'insertion
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom = db.Column(db.String(100), nullable=False)
    prenom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='admin')
    is_active = db.Column(db.Boolean, default=True)
    mfa_enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

def create_admin():
    email = "admin@biat.tn"
    password = "AdminBiat2026!"
    
    with app.app_context():
        # Vérifier si l'user existe déjà
        existing = User.query.filter_by(email=email).first()
        if existing:
            print(f"L'utilisateur {email} existe déjà.")
            return

        hashed_pw = bcrypt.generate_password_hash(password, rounds=12).decode('utf-8')
        new_admin = User(
            nom="ADMIN",
            prenom="Wahid",
            email=email,
            password_hash=hashed_pw,
            role="admin",
            is_active=True
        )
        
        try:
            db.session.add(new_admin)
            db.session.commit()
            print("---------------------------------------------")
            print("ADMIN CRÉÉ AVEC SUCCÈS !")
            print(f"Email : {email}")
            print(f"Mot de passe : {password}")
            print("---------------------------------------------")
        except Exception as e:
            print(f"Erreur : {e}")

if __name__ == "__main__":
    if not app.config['SQLALCHEMY_DATABASE_URI']:
        print("Erreur : La variable DATABASE_URL n'est pas définie.")
    else:
        create_admin()
