"""
Configuration Flask — Assurances BIAT
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuration de base"""
    # Clé secrète Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'

    # PostgreSQL
    SQLALCHEMY_DATABASE_URI = (
        os.environ.get('POSTGRES_URL') or
        os.environ.get('DATABASE_URL') or
        'postgresql://wahid:wahid@localhost:5432/AssurancesBiatDB'
    )
    # Fix for SQLAlchemy 1.4+ which requires 'postgresql://' instead of 'postgres://'
    if SQLALCHEMY_DATABASE_URI and SQLALCHEMY_DATABASE_URI.startswith('postgres://'):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace('postgres://', 'postgresql://', 1)

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    TEMP_TOKEN_EXPIRES = timedelta(minutes=5)

    # Flask-Mail (Gmail SMTP)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', 'assurancesbiatplateforme@gmail.com')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_USERNAME', 'assurancesbiatplateforme@gmail.com')

    # Application
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500 MB
    APP_NAME = 'Assurances BIAT'


class DevelopmentConfig(Config):
    """Configuration développement"""
    DEBUG = True


class ProductionConfig(Config):
    """Configuration production"""
    DEBUG = False
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    UPLOAD_FOLDER = '/tmp'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
