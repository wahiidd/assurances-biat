"""
Extensions Flask — initialisées séparément pour éviter les imports circulaires
"""
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_mail import Mail

# Base de données PostgreSQL
db = SQLAlchemy()

# Gestion des tokens JWT
jwt = JWTManager()

# Hachage bcrypt (facteur 12 configuré dans set_password)
bcrypt = Bcrypt()

# Envoi d'emails SMTP
mail = Mail()
