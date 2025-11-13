# ACS Archive – Application de gestion documentaire

Application web destinée à **ACS – Assureurs Conseils Service** pour gérer les documents clients, les activités et les statistiques métiers. L’interface est réalisée avec Next.js, tandis que l’API repose désormais sur **Django REST Framework** et une base PostgreSQL.

## 🚀 Stack technique

- **Frontend** : Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS
- **Backend** : Django 5 · Django REST Framework · Simple JWT
- **Base de données** : PostgreSQL
- **Stockage fichiers** : système de fichiers local (développement) – support S3 à prévoir

## 🗂 Structure du dépôt

```
acs-archive-app/
├── app/                 # Pages Next.js (App Router)
├── components/          # Composants réutilisables
├── lib/                 # Helpers (API, session, etc.)
├── backend/             # Projet Django (acs_backend)
│   ├── api/             # App REST (vues, serializers, tests…)
│   ├── acs_backend/     # Paramétrage du projet Django
│   └── INSTALLATION.md  # Guide détaillé d’installation backend
└── README.md            # Ce fichier
```

## ⚙️ Installation & démarrage

### 1. Backend Django

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate sous Windows
pip install -r requirements.txt

# Variables d’environnement
cp .env.example .env  # puis renseigner SECRET_KEY, DB_*, JWT_*

python manage.py migrate
python manage.py createsuperuser  # si nécessaire
python manage.py runserver
```

Par défaut, l’API est servie sur `http://127.0.0.1:8000/api/`.

### 2. Frontend Next.js

```bash
npm install

# Config front
cp .env.example .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api" >> .env.local

npm run dev
# Ouvrir http://localhost:3000
```

## 🔑 Points d’intégration principaux

- Authentification : `/auth/login/` (JWT), stocké dans `lib/session.ts`
- Gestion utilisateurs : `/utilisateurs/`
- Documents : `/documents/`, `/documents/upload/`, `/documents/{id}/`
- Statistiques : `/stats/`

Toute requête frontend doit passer par `lib/api.ts` (`apiFetch` / `apiFetchJson`) afin d’injecter automatiquement le token JWT.

## ✅ Fonctionnalités actuelles

- Connexion / stockage JWT navigateur
- Paramètres utilisateur (profil + changement mot de passe)
- CRUD utilisateurs, clients, catégories, documents (via API Django)
- Téléversement de documents multi-fichiers
- Timeline des activités + statistiques temps réel
- Recherche rapide de documents

## 🔧 Scripts utiles

- `npm run dev` : lancer le frontend Next.js
- `npm run build` / `npm run start`
- `npm run lint`
- `python manage.py runserver` : lancer l’API Django
- `python manage.py test` : exécuter les tests backend

## 📚 Documentation complémentaire

- [backend/INSTALLATION.md](./backend/INSTALLATION.md) – procédure détaillée backend
- [backend/API_DOCUMENTATION.md](./backend/API_DOCUMENTATION.md) – endpoints REST & exemples

---

**ACS – Assureurs Conseils Service** © 2025
