# Assurances BIAT — Plateforme de Gestion des Contrats d'Épargne

Module 1 : Authentification, Inscription & Administration

---

## 🏗️ Stack technique

| Couche      | Technologie                                |
|-------------|--------------------------------------------|
| Frontend    | Next.js 16, React 19, TypeScript, Tailwind |
| Backend     | Python 3.11+, Flask 3, Flask-JWT-Extended  |
| Base de données | PostgreSQL 14+ (port 5432)            |
| Auth        | bcrypt (coût 12), TOTP via pyotp           |
| Email       | Flask-Mail (Gmail SMTP)                    |

---

## 📋 Prérequis

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+ (en cours d'exécution)
- Un mot de passe d'application Google pour l'adresse `assurancesbiatplateforme@gmail.com`

---

## 🗄️ 1. Initialisation PostgreSQL

### Créer la base de données

```sql
-- Dans psql en tant que superuser :
CREATE DATABASE "AssurancesBiatDB";
CREATE USER wahid WITH PASSWORD 'wahid';
GRANT ALL PRIVILEGES ON DATABASE "AssurancesBiatDB" TO wahid;
GRANT CREATE ON SCHEMA public TO wahid;
```

### Exécuter le script d'initialisation

```bash
psql -U wahid -d AssurancesBiatDB -f backend/init_db.sql
```

Ce script active les extensions `uuid-ossp`, `pgcrypto`, `pg_trgm` et crée les 4 tables avec index et triggers.

---

## 🐍 2. Backend Flask

### Installer les dépendances

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### Configurer les variables d'environnement

```bash
# Copier le fichier exemple et éditer
cp .env.example .env
```

Ouvrir `.env` et renseigner :

```env
SECRET_KEY=une-cle-secrete-longue-et-aleatoire
JWT_SECRET_KEY=une-autre-cle-pour-jwt

DATABASE_URL=postgresql://wahid:wahid@localhost:5432/AssurancesBiatDB

MAIL_USERNAME=assurancesbiatplateforme@gmail.com
MAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx   # Mot de passe d'application Google (voir ci-dessous)

FRONTEND_URL=http://localhost:3000
```

> **Mot de passe d'application Google :**
> 1. Aller sur [myaccount.google.com → Sécurité → Mots de passe des applications](https://myaccount.google.com/apppasswords)
> 2. Créer un mot de passe pour l'application "Mail"
> 3. Coller les 16 caractères dans `MAIL_PASSWORD`

### Lancer le backend

```bash
cd backend
python app.py
# API disponible sur http://localhost:5000
```

---

## 👑 3. Créer le premier administrateur

> ⚠️ Le premier admin **ne peut pas** être créé via l'interface. Utiliser le script de seed :

```bash
cd backend
python seed_admin.py --password VotreMotDePasse123!

# Ou avec des paramètres complets :
python seed_admin.py \
  --nom "Ben-Ali" \
  --prenom "Wahid" \
  --email "wahid@biat.tn" \
  --password "VotreMotDePasse123!"
```

Le script crée un compte admin avec un log dans `audit_log` (`action='SEED_ADMIN_CREATED'`).

---

## ⚛️ 4. Frontend Next.js

### Installer les dépendances

```bash
# À la racine du projet
npm install
```

### Lancer le frontend

```bash
npm run dev
# Disponible sur http://localhost:3000
```

---

## 🔄 Flux d'utilisation

### Connexion standard
1. `/login` — email + mot de passe
2. Si MFA activée → `/verify-2fa` — code OTP à 6 chiffres
3. Redirection vers `/profil`

### Nouveau compte
1. `/register` — prénom, nom, email, mot de passe
2. Login automatique → redirection `/profil`
3. **Activation 2FA obligatoire** — scanner le QR code avec Microsoft / Google Authenticator

### Flux invitation admin
1. L'admin connecté va sur `/admin` → onglet "Invitations"
2. Saisit l'email d'un utilisateur existant → envoie l'invitation
3. L'utilisateur reçoit un email avec un lien `/invite?token=<UUID>`
4. En cliquant le lien, son compte est promu `admin` (token usage unique, expire 48h)

---

## 📁 Structure du projet

```
PFE/
├── app/
│   ├── (auth)/
│   │   ├── login/          # Connexion par email
│   │   ├── register/       # Inscription (nom, prénom, email)
│   │   ├── invite/         # Acceptation d'invitation admin
│   │   └── verify-2fa/     # Code OTP TOTP
│   └── (protected)/
│       ├── profil/         # Profil utilisateur + gestion 2FA
│       └── admin/          # Dashboard admin (users, CSV, invitations)
├── lib/
│   └── auth-context.tsx    # Context React + hooks d'authentification
├── backend/
│   ├── app.py              # Factory Flask
│   ├── config.py           # Configuration multi-env
│   ├── extensions.py       # db, jwt, bcrypt, mail
│   ├── init_db.sql         # Script SQL d'initialisation
│   ├── seed_admin.py       # Création du premier admin
│   ├── .env.example        # Variables d'environnement (template)
│   ├── models/
│   │   ├── user.py         # Table users (UUID, bcrypt, TOTP)
│   │   ├── invitation.py   # Table invitations
│   │   ├── csv_upload.py   # Table csv_uploads
│   │   └── audit_log.py    # Table audit_log (JSONB)
│   └── routes/
│       ├── auth.py         # /api/auth/* (login, register, 2FA, invite)
│       └── admin.py        # /api/admin/* (users, CSV, invitations)
└── README.md
```

---

## 🔐 Sécurité

| Mesure                        | Implémentation                                   |
|-------------------------------|--------------------------------------------------|
| Hash mots de passe            | bcrypt, facteur de coût 12                       |
| 2FA TOTP                      | RFC 6238, fenêtre ±1 (pyotp), QR Code           |
| Tokens JWT                    | Access 1h, Refresh 30j, Temp 2FA 5min           |
| Audit log                     | Toutes les actions sensibles loguées             |
| IPs                           | Loguées pour chaque action (IPv4 + IPv6)         |
| Invitations                   | UUID aléatoire, usage unique, expiration 48h     |
| Comptes suspendus             | Rejetés au login (message générique)             |
| Variables d'environnement     | Aucun secret en dur dans le code                 |

---

## 🔌 Endpoints API

### Authentification (`/api/auth`)

| Méthode | Endpoint              | Description                        | Auth      |
|---------|-----------------------|------------------------------------|-----------|
| POST    | `/register`           | Créer un compte                    | Non       |
| POST    | `/login`              | Connexion (email + mdp)            | Non       |
| POST    | `/verify-2fa`         | Valider le code OTP                | Temp JWT  |
| GET     | `/me`                 | Infos utilisateur connecté         | JWT       |
| POST    | `/logout`             | Déconnexion + audit log            | JWT       |
| POST    | `/refresh`            | Renouveler le token d'accès        | Refresh   |
| GET     | `/2fa/qrcode`         | QR code de configuration 2FA       | JWT       |
| POST    | `/2fa/enable`         | Activer la 2FA                     | JWT       |
| POST    | `/2fa/disable`        | Désactiver la 2FA                  | JWT       |
| GET     | `/invite/validate`    | Valider un token d'invitation      | Non       |
| POST    | `/invite/accept`      | Accepter et appliquer l'invitation | JWT       |

### Administration (`/api/admin`) — Admin uniquement

| Méthode | Endpoint                        | Description                   |
|---------|---------------------------------|-------------------------------|
| GET     | `/users`                        | Liste des utilisateurs        |
| PUT     | `/users/<id>/toggle-active`     | Activer/Suspendre un compte   |
| GET     | `/invitations`                  | Liste des invitations         |
| POST    | `/invitations`                  | Envoyer une invitation admin  |
| GET     | `/csv/uploads`                  | Historique des imports CSV    |
| POST    | `/csv/upload`                   | Uploader un fichier CSV       |
| GET     | `/audit`                        | Journal d'audit               |

---

## 🔧 Actions d'audit loguées

`LOGIN` · `LOGOUT` · `LOGIN_FAILED` · `REGISTER` · `MFA_ENABLED` · `MFA_DISABLED`
`UPLOAD_CSV` · `PROMOTE_ADMIN` · `INVITE_SENT` · `ACTIVATE_USER` · `DEACTIVATE_USER`
`SEED_ADMIN_CREATED`
