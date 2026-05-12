-- =============================================================
-- Script d'initialisation — AssurancesBiatDB
-- PostgreSQL 14+
-- Usage : psql -U wahid -d AssurancesBiatDB -f init_db.sql
-- =============================================================

-- Extensions obligatoires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- opérations cryptographiques
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- recherche textuelle GIN

-- =============================================================
-- Fonction trigger pour updated_at automatique
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- =============================================================
-- Table : users
-- Table centrale — comptes, credentials, MFA, rôles
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom         VARCHAR(100) NOT NULL,
    prenom      VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'user'
                CHECK (role IN ('admin', 'user')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret  VARCHAR(64),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    last_login  TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Table : invitations
-- Flux de promotion admin via token email à usage unique
-- =============================================================
CREATE TABLE IF NOT EXISTS invitations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    email       VARCHAR(255) NOT NULL,
    token       VARCHAR(255) NOT NULL UNIQUE,
    role_cible  VARCHAR(20)  DEFAULT 'admin',
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Table : csv_uploads
-- Trace chaque upload CSV fait par un admin
-- =============================================================
CREATE TABLE IF NOT EXISTS csv_uploads (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    filename    VARCHAR(255) NOT NULL,
    filepath    VARCHAR(500) NOT NULL,
    nb_lignes   INTEGER,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'done', 'error')),
    error_msg   TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Table : audit_log
-- Traçabilité obligatoire — toutes les actions sensibles
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    ip_address  VARCHAR(45),
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Index obligatoires (performance + unicité)
-- =============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token
    ON invitations(token);

CREATE INDEX IF NOT EXISTS idx_audit_user_date
    ON audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_uploads_status
    ON csv_uploads(status, uploaded_at DESC);

-- Index GIN pour recherche textuelle sur email
CREATE INDEX IF NOT EXISTS idx_users_email_trgm
    ON users USING GIN (email gin_trgm_ops);

-- =============================================================
-- Confirmation
-- =============================================================
DO $$
BEGIN
    RAISE NOTICE 'AssurancesBiatDB — initialisation terminée avec succès.';
    RAISE NOTICE '4 tables créées : users, invitations, csv_uploads, audit_log';
    RAISE NOTICE 'Extensions actives : uuid-ossp, pgcrypto, pg_trgm';
    RAISE NOTICE 'Exécutez seed_admin.py pour créer le premier administrateur.';
END $$;
