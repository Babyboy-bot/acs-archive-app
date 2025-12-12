# ACS Archive App

Application de gestion et d’archivage documentaire pour ACS (Assureurs Conseils Service), avec :

- Authentification sécurisée multi‑rôles (JWT en cookies **httpOnly** + middleware, rôles admin / archiviste / consultant)
- Gestion des clients, exercices, risques, documents (dont clients groupe / flotte)
- Recherche avancée et recherche rapide des documents (client / exercice / risque / type de courrier, avec normalisation robuste accents/casse)
- Assistant IA conversationnel intégré (recherche documentaire TF‑IDF / FAISS; recherche sémantique par embeddings reportée à plus tard)
- Interface moderne (Next.js, thème clair/sombre, tableaux de bord, etc.)

## Structure du projet

```text
/acs-archive-app/
├── backend/       # Backend Django (API REST)
│   ├── acs_backend/
│   ├── api/       # Modèles, vues, serializers, URLs
│   └── manage.py
├── front/         # Frontend Next.js (App Router, TypeScript, TailwindCSS)
│   ├── app/       # Pages (tableau de bord, documents, clients, assistant, etc.)
│   ├── components/# Composants React réutilisables
│   ├── hooks/     # Hooks personnalisés
│   ├── lib/       # API client, session, permissions, impression, thème…
│   ├── public/    # Assets (logo ACS, images…)
│   └── ...
├── experiments/   # POCs, scripts et essais techniques
├── types/         # Types TypeScript globaux (partagés)
└── fichiers de configuration racine (postcss.config.mjs, prisma.config.ts, …)
```

## Démarrage rapide

### 1. Backend (Django + PostgreSQL)

Depuis le dossier racine :

```powershell
cd backend

# (1ère fois uniquement) créer et activer le venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python manage.py runserver
```

Par défaut, l’API est disponible sur : `http://127.0.0.1:8000/api/`.

> ⚠️ Les migrations Django ne sont pas toutes appliquées volontairement pour préserver une base existante. Ne pas lancer `python manage.py migrate` sans avoir vérifié l’impact sur la base PostgreSQL.

### 2. Frontend (Next.js)

Dans un autre terminal, depuis le dossier racine :

```powershell
cd front
npm install
npm run dev
```

L’interface web est disponible sur : `http://localhost:3000`.

## Fonctionnalités principales

- **Gestion des clients**
  - Clients particuliers et entreprises
  - Gestion des groupes / flottes : un client « groupe » peut agréger les exercices/risques de ses membres
- **Exercices & risques**
  - Exercices annuels liés aux clients
  - Risques associés (automobile, santé, habitation, RC, prévoyance, etc.) avec normalisation des libellés
- **Documents**
  - Archivage des courriers et pièces justificatives (PDF, images, …)
  - Métadonnées complètes : client, exercice, type de risque, type de courrier (ACS → Client, ACS → Compagnie, avenant, facture, règlement, sinistre, …)
  - Actions rapides : ouverture via proxy sécurisé, impression, téléchargement (selon la page)
- **Tableaux de bord & navigation**
  - Tableau de bord, pages clients, documents, utilisateurs, paramètres
  - Interface moderne avec animations (Framer Motion), thème et navigation cohérente
- **Assistant IA**
  - Chat conversationnel orienté aide à la recherche documentaire
  - Utilise actuellement une recherche lexicale (TF‑IDF / FAISS) sur les documents indexés

## Rôles & permissions

- **Administrateur**
  - Pour les informaticiens / responsables techniques
  - Accès complet à l’administration, aux utilisateurs, aux droits, aux paramètres
- **Archiviste**
  - Droits de gestion des documents comparables à l’administrateur (création, modification, suppression)
  - Accès étendu aux écrans métier d’archivage
- **Consultant**
  - Accès **lecture seule** aux données métier (clients, exercices, risques, documents)
  - Pas de modification/suppression des documents ou des paramètres

La gestion fine des permissions côté frontend repose sur des helpers comme `hasPermission` et des hooks de garde (`useEnforceNonConsultant`, etc.).

## Authentification & sécurité

- **JWT en cookies httpOnly**
  - Les tokens d’accès / rafraîchissement sont stockés dans des cookies **httpOnly** côté backend
  - Un middleware Django injecte l’en‑tête `Authorization: Bearer <token>` à partir des cookies pour les vues DRF
  - Le frontend Next.js appelle l’API avec `credentials: 'include'` pour que les cookies soient envoyés automatiquement
- **Protection des routes frontend**
  - Hooks de session (`useUtilisateurCourant`) et de redirection contrôlent l’accès aux pages (connexion obligatoire, rôle consultant vs non-consultant, etc.)
- **CORS / HTTPS**
  - Paramétrage Django prévu pour fonctionner en environnement sécurisé (HTTPS)
  - La configuration de développement reste stricte pour se rapprocher d’un contexte production

## Variables d’environnement

### Frontend (`front/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
ASSISTANT_LLM_PROVIDER=openai
ASSISTANT_LLM_API_KEY=sk-...
ASSISTANT_LLM_MODEL=gpt-4o-mini
ASSISTANT_LLM_ENABLED=true
```

### Backend (`backend/.env`, optionnel)

```env
DEBUG=True
SECRET_KEY=change-me
DATABASE_URL=postgresql://user:password@localhost:5432/acs_archive
```

## Technologies principales

- **Frontend** : Next.js (App Router), React, TypeScript, TailwindCSS, Recharts, Framer Motion, React PDF, jsPDF…
- **Backend** : Django 5, Django REST Framework, JWT (djangorestframework-simplejwt), PostgreSQL, psycopg2-binary
- **IA / recherche** : scikit-learn, faiss-cpu (recherche lexicale/TF‑IDF pour l’assistant IA et l’API de recherche rapide)

## Recherche documentaire & assistant IA

- **Recherche avancée** : page dédiée permettant de filtrer les documents par client, exercice, type de risque et type de courrier. Les libellés de risques sont normalisés (accents, variantes d’orthographe) pour garantir des résultats fiables.
- **Recherche rapide** : barre globale (Ctrl+K) qui interroge l’endpoint `/documents/search/` et combine client / exercice / risque / type de courrier / titre / référence via une normalisation texte robuste (accents, casse, ponctuation).
- **Assistant IA** : utilise aujourd’hui une recherche lexicale (TF‑IDF / FAISS) sur les documents. La recherche sémantique basée sur `torch` / `sentence-transformers` est volontairement désactivée dans l’environnement Windows local et sera réactivée plus tard sur une infrastructure adaptée (Linux/Cloud).

## Environnements & base de données

- **Développement local**
  - Backend Django + PostgreSQL local (voir `backend/.env`)
  - Frontend Next.js sur `http://localhost:3000` pointant vers `http://127.0.0.1:8000/api`
- **Base de données**
  - Base principale PostgreSQL, migrations Django gérées par les fichiers `backend/api/migrations/`
  - Des scripts et backups sont prévus dans `backend/backups/` et `backend/scripts/` (non versionnés dans git) pour faciliter les sauvegardes/restaurations
- **Production / recette**
  - L’application est conçue pour tourner sur une base PostgreSQL dédiée par environnement (pas de partage direct de la base de production avec les développeurs)
  - Les sauvegardes doivent être réalisées via les outils PostgreSQL (`pg_dump`, `pg_restore`, etc.) ou via l’outil d’administration de la plateforme utilisée

## Notes

- Les médias sont servis par Django en développement via `/media/`.
- Le frontend communique avec le backend via le préfixe `/api/*`.
- La branche principale du projet est `main`.
- La page "mot de passe oublié" ne déclenche pas de réinitialisation automatique : elle indique à l’utilisateur de contacter l’administrateur ACS (aucune adresse e‑mail n’est affichée dans l’UI).
