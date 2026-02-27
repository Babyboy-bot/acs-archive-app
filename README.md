# ACS Archive App

Application de gestion et d'archivage documentaire pour ACS (Assureurs Conseils Service), avec :

- **Dissociation complète** : Application isolée avec son propre sous-domaine et cookies
- Authentification sécurisée multi‑rôles (JWT en cookies **httpOnly** + middleware, rôles admin / archiviste / consultant)
- Gestion des clients, exercices, risques, documents (dont clients groupe / flotte)
- Recherche avancée et recherche rapide des documents (client / exercice / risque / type de courrier, avec normalisation robuste accents/casse)
- Assistant IA conversationnel intégré avec suggestions personnalisées
- Optimisation des performances avec mise en cache des embeddings et TF-IDF
- Gestion avancée des documents PDF avec OCR intégré (Tesseract.js)
- Interface moderne (Next.js, thème clair/sombre, tableaux de bord, etc.)
- Optimisation Nginx pour le chargement rapide des documents
- Monitoring des performances et journalisation avancée

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

## Fonctionnalités récentes

- **Dissociation complète des applications**
  - Sous-domaine dédié : `acs.localhost`
  - Cookies isolés : `acs_access_token`, `acs_refresh_token`
  - Sessions indépendantes : Pas d'interférence avec Notaire Archive
  - Refresh automatique : Tokens JWT renouvelés automatiquement sans déconnexion

- **Optimisations de performances**
  - Mise en cache des embeddings et des résultats de recherche
  - Précuisson du modèle sémantique au démarrage
  - Limitation de la portée des requêtes (top_k et nombre de documents analysés)

- **Améliorations de l'expérience utilisateur**
  - Suggestions de recherche contextuelles améliorées
  - Meilleure gestion des erreurs et timeouts
  - Interface plus réactive avec indicateurs de chargement

- **Sécurité et fiabilité**
  - Configuration optimisée de Nginx pour la sécurité et les performances
  - Cache des documents PDF avec en-têtes appropriés
  - Journalisation détaillée pour le débogage

## Démarrage rapide

### Option A : Docker (recommandé)

La méthode la plus simple pour lancer l'application complète :

```bash
# Lancer tous les services (DB + Backend + Frontend)
docker compose up -d

# Voir les logs
docker compose logs -f

# Arrêter
docker compose down
```

**Accès :**
- **Application** : http://acs.localhost:8080 (via Nginx)
- **Backend API** : http://acs.localhost:8000/api (via Nginx)
- **Health check** : http://acs.localhost:8000/api/health/

> ⚠️ Docker Desktop doit être lancé avant d'exécuter ces commandes.

### Option B : Développement local

#### 1. Backend (Django + PostgreSQL)

```powershell
cd backend

# (1ère fois) créer et activer le venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python manage.py runserver
```

API disponible sur : `http://127.0.0.1:8000/api/`

#### 2. Frontend (Next.js)

```powershell
cd front
npm install
npm run dev
```

Interface web sur : `http://localhost:5000`

> ⚠️ En développement local, vous devez avoir PostgreSQL installé et configuré.

## Fonctionnalités principales

- **Authentification JWT** : Cookies HttpOnly avec refresh automatique, isolation par sous-domaine
- **Gestion des clients**
  - Clients particuliers et entreprises
  - Gestion des groupes / flottes : un client « groupe » peut agréger les exercices/risques de ses membres
- **Exercices & risques**
  - Exercices annuels liés aux clients
  - Risques associés (automobile, santé, habitation, RC, prévoyance, etc.) avec normalisation des libellés
- **Documents**
  - Archivage des courriers et pièces justificatives (PDF, images, …)
  - Métadonnées complètes : client, exercice, type de risque, type de courrier (ACS → Client, ACS → Compagnie, avenant, facture, règlement, sinistre, …)
  - Actions rapides : ouverture via proxy sécurisé, impression, téléchargement (selon la page)
- **Tableaux de bord & navigation**
  - Tableau de bord, pages clients, documents, utilisateurs, paramètres
  - Interface moderne avec animations (Framer Motion), thème et navigation cohérente
- **Assistant IA**
  - Chat conversationnel avec recherche sémantique avancée (FAISS) et fallback TF-IDF
  - Cache des embeddings pour des performances optimales
  - Suggestions de requêtes personnalisées pour les avenants et contrats
  - Gestion des conversations avec historique persistant
  - Timeout configurable côté client (20s par défaut)
  - Optimisation pour la recherche d'avenants et contrats spécifiques
  - Intégration LLM Mistral (API Mistral) sans système de quotas applicatif côté ACS

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

- **JWT en cookies httpOnly avec isolation**
  - Les tokens d’accès / rafraîchissement sont stockés dans des cookies **httpOnly** dédiés au sous-domaine `acs.localhost`
  - Un middleware Django injecte l’en‑tête `Authorization: Bearer <token>` à partir des cookies pour les vues DRF
  - Le frontend Next.js appelle l’API avec `credentials: 'include'` pour que les cookies soient envoyés automatiquement
  - **Refresh automatique** : Tokens renouvelés automatiquement sans déconnexion
- **Protection des routes frontend**
  - Hooks de session (`useUtilisateurCourant`) et de redirection contrôlent l’accès aux pages (connexion obligatoire, rôle consultant vs non-consultant, etc.)
- **CORS / HTTPS**
  - Paramétrage Django prévu pour fonctionner en environnement sécurisé (HTTPS)
  - La configuration de développement reste stricte pour se rapprocher d’un contexte production

## Variables d’environnement

### Frontend (`front/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=/api

# Configuration LLM (Mistral uniquement)
MISTRAL_API_KEY=...
MISTRAL_BASE_URL=https://api.mistral.ai/v1
ASSISTANT_LLM_ENABLED=true
```

### Backend (`backend/.env`, optionnel)

```env
DEBUG=True
SECRET_KEY=change-me
DATABASE_URL=postgresql://user:password@localhost:5432/acs_archive
ALLOWED_HOSTS=localhost,127.0.0.1,backend,acs.localhost
CORS_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://acs.localhost:8080
ASSISTANT_LLM_QUOTA_DISABLED=true  # quotas LLM applicatifs désactivés (valeur par défaut dans settings.py)
```

## Technologies principales

- **Frontend** : Next.js (App Router), React, TypeScript, TailwindCSS, Recharts, Framer Motion, React PDF, jsPDF…
- **Backend** : Django 5, Django REST Framework, JWT (djangorestframework-simplejwt), PostgreSQL, psycopg2-binary
- **IA / recherche** : scikit-learn, faiss-cpu (recherche lexicale/TF‑IDF pour l’assistant IA et l’API de recherche rapide)

## Recherche documentaire & assistant IA

- **Recherche avancée** : page dédiée permettant de filtrer les documents par client, exercice, type de risque et type de courrier. Les libellés de risques sont normalisés (accents, variantes d’orthographe) pour garantir des résultats fiables.
- **Recherche rapide** : barre globale (Ctrl+K) qui interroge l’endpoint `/documents/search/` et combine client / exercice / risque / type de courrier / titre / référence via une normalisation texte robuste (accents, casse, ponctuation).
- **Assistant IA** : utilise aujourd’hui une recherche lexicale (TF‑IDF / FAISS) sur les documents. La recherche sémantique basée sur `torch` / `sentence-transformers` est volontairement désactivée dans l’environnement Windows local et sera réactivée plus tard sur une infrastructure adaptée (Linux/Cloud).

## 🔧 Isolation des applications
- **Sous-domaine dédié** : `acs.localhost`
- **Cookies isolés** : `acs_access_token`, `acs_refresh_token`
- **Sessions indépendantes** : Pas d'interférence avec Notaire Archive
- **Refresh automatique** : Tokens JWT renouvelés automatiquement sans déconnexion

## Environnements & base de données

- **Développement local**
  - Backend Django + PostgreSQL local (voir `backend/.env`)
  - Frontend Next.js sur `http://localhost:5000` pointant vers `http://127.0.0.1:8000/api`
- **Base de données**
  - Base principale PostgreSQL, migrations Django gérées par les fichiers `backend/api/migrations/`
  - Des scripts et backups sont prévus dans `backend/backups/` et `backend/scripts/` (non versionnés dans git) pour faciliter les sauvegardes/restaurations
- **Production / recette**
  - L’application est conçue pour tourner sur une base PostgreSQL dédiée par environnement (pas de partage direct de la base de production avec les développeurs)
  - Les sauvegardes doivent être réalisées via les outils PostgreSQL (`pg_dump`, `pg_restore`, etc.) ou via l’outil d’administration de la plateforme utilisée

## 🐛 Dépannage rapide
- **Ports** : 8080 (Nginx), 8000 (API), 5432 (Postgres host). Vérifier : `netstat -ano | findstr :8080`.
- **Sous-domaine** : Assurez-vous que `acs.localhost` est dans votre fichier hosts
- **Volumes corrompus** : `docker compose down -v && docker compose up -d`.
- **Logs ciblés** : `docker compose logs backend` (ou frontend/db).

## Notes

- Les médias sont servis par Django en développement via `/media/`.
- Le frontend communique avec le backend via le préfixe `/api/*`.
- La branche principale du projet est `main`.
- La page "mot de passe oublié" ne déclenche pas de réinitialisation automatique : elle indique à l'utilisateur de contacter l'administrateur ACS (aucune adresse e‑mail n'est affichée dans l'UI).
