#!/usr/bin/env python3
"""
Script de seed — création du premier administrateur.
Ce script est la SEULE façon de créer un admin initial.
Les admins suivants sont créés via le système d'invitation.

Usage :
    python seed_admin.py --password MonMotDePasse123!
    python seed_admin.py --nom Dupont --prenom Marie --email marie@biat.tn --password Secret123!
"""
import argparse
import sys
import os

# Ajouter le répertoire backend au path Python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from extensions import db
from models.user import User
from models.audit_log import AuditLog


def seed_admin(nom: str, prenom: str, email: str, password: str) -> None:
    """Insère le premier administrateur en base avec audit log."""
    app = create_app('development')

    with app.app_context():
        # Vérifier l'unicité de l'email
        existing = User.query.filter_by(email=email.lower()).first()
        if existing:
            print(f"\n❌  Un compte avec l'email '{email}' existe déjà.")
            print(f"    Rôle actuel : {existing.role}")
            sys.exit(1)

        # Créer l'administrateur
        admin = User(
            nom=nom.strip(),
            prenom=prenom.strip(),
            email=email.strip().lower(),
            role='admin',
            is_active=True,
        )
        admin.set_password(password)       # bcrypt coût 12
        admin.generate_mfa_secret()        # Prêt pour l'activation MFA

        db.session.add(admin)

        # Audit log obligatoire
        AuditLog.log(
            action='SEED_ADMIN_CREATED',
            user_id=admin.id,
            ip_address='127.0.0.1',
            metadata={
                'email':   admin.email,
                'nom':     admin.nom,
                'prenom':  admin.prenom,
                'method':  'seed_script',
            },
        )

        db.session.commit()

        print("\n✅  Administrateur créé avec succès !")
        print(f"   Nom complet : {admin.prenom} {admin.nom}")
        print(f"   Email       : {admin.email}")
        print(f"   Rôle        : {admin.role}")
        print(f"   ID          : {admin.id}")
        print("\n⚠️   N'oubliez pas d'activer la 2FA lors de la première connexion !")
        print("     Connectez-vous sur http://localhost:3000/login\n")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Créer le premier administrateur Assurances BIAT',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python seed_admin.py --password MonSecret123!
  python seed_admin.py --nom Ben-Ali --prenom Wahid --email wahid@biat.tn --password Secret123!
        """
    )
    parser.add_argument('--nom',      default='Admin',                        help='Nom de famille (défaut: Admin)')
    parser.add_argument('--prenom',   default='Super',                        help='Prénom (défaut: Super)')
    parser.add_argument('--email',    default='admin@assurancesbiat.tn',      help='Adresse email (défaut: admin@assurancesbiat.tn)')
    parser.add_argument('--password', required=True,                           help='Mot de passe (min. 8 caractères)')

    args = parser.parse_args()

    if len(args.password) < 8:
        print("\n❌  Le mot de passe doit contenir au moins 8 caractères.")
        sys.exit(1)

    seed_admin(args.nom, args.prenom, args.email, args.password)
