# Architecture - ACS Archive

## 🎯 Vue d'Ensemble

ACS Archive est une application de gestion documentaire pour courtiers en assurance, composée de :

```
┌─────────────────────────────────────────────────────────────────┐
│                        UTILISATEURS                              │
│                   (Navigateur Web)                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 16)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pages     │  │ Composants  │  │   API Routes            │  │
│  │  (App       │  │   React     │  │  /api/assistant-demo    │  │
│  │   Router)   │  │             │  │  (Assistant IA)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                           Port 3000                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/REST
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Django 5 + DRF)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Views     │  │  Modèles    │  │   Serializers           │  │
│  │  (API       │  │  (ORM)      │  │                         │  │
│  │   REST)     │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                           Port 8000                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ SQL
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BASE DE DONNÉES                              │
│                     PostgreSQL 15                                │
│                           Port 5432                              │
└─────────────────────────────────────────────────────────────────┘
```

## 🗂️ Modèles de Données

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Utilisateur │       │    Client    │       │   Exercice   │
│──────────────│       │──────────────│       │──────────────│
│ email        │       │ nom          │       │ annee        │
│ role         │◄──────│ code         │◄──────│ client_id    │
│ nom/prenom   │       │ type         │       │ statut       │
└──────────────┘       └──────────────┘       └──────┬───────┘
                                                     │
                                                     ▼
                       ┌──────────────┐       ┌──────────────┐
                       │    Risque    │       │   Document   │
                       │──────────────│       │──────────────│
                       │ type         │◄──────│ titre        │
                       │ exercice_id  │       │ fichier      │
                       │ numero       │       │ risque_id    │
                       └──────────────┘       │ categorie    │
                                              └──────────────┘
```

### Hiérarchie
```
Client → Exercice (année) → Risque (type) → Document
```

## 🔐 Authentification

- **JWT** stocké dans cookies httpOnly (sécurisé)
- Tokens gérés par `djangorestframework-simplejwt`
- Middleware custom pour extraction depuis cookies

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  JWT Token  │────▶│   Cookie    │
│   Form      │     │  (Backend)  │     │  httpOnly   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 🤖 Assistant IA

L'assistant utilise une architecture modulaire :

```
front/app/api/assistant-demo/
├── route.ts          # Point d'entrée principal
├── classification.ts # Classification des messages
├── context.ts        # Résolution du contexte conversationnel
├── filtering.ts      # Filtrage multi-critères des documents
├── learning.ts       # Apprentissage et patterns
├── llm.ts            # Intégration LLM (Mistral/Claude)
├── narration.ts      # Génération de réponses narratives
├── search.ts         # Recherche documentaire
├── security.ts       # Rate limiting, validation
├── tones.ts          # Tons de réponse (amical, formel...)
└── types.ts          # Types TypeScript
```

### Flux de traitement
```
Question → Classification → Recherche → Filtrage → Narration → Réponse
              │                │            │           │
              ▼                ▼            ▼           ▼
         Type de msg      Backend API   Multi-critères  LLM ou
         (doc/stats/      (Django)      (client,        heuristique
          salutation)                    année...)
```

## 📊 Endpoints API Principaux

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login/` | Connexion |
| POST | `/api/auth/logout/` | Déconnexion |

### CRUD
| Ressource | Endpoint | Opérations |
|-----------|----------|------------|
| Clients | `/api/clients/` | CRUD complet |
| Exercices | `/api/exercices/` | CRUD complet |
| Risques | `/api/risques/` | CRUD complet |
| Documents | `/api/documents/` | CRUD + upload |

### Assistant IA
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/assistant/search/` | Recherche documentaire |
| GET | `/api/assistant/stats/` | Statistiques |
| POST | `/api/assistant/feedback/` | Feedback utilisateur |

### Monitoring
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health/` | Liveness probe |
| GET | `/api/ready/` | Readiness probe |
| GET | `/api/version/` | Info version |

## 🐳 Déploiement Docker

```yaml
services:
  db:        # PostgreSQL
  backend:   # Django + Gunicorn
  frontend:  # Next.js
  nginx:     # Reverse proxy (production)
```

## 🔄 CI/CD

GitHub Actions workflow :
1. **Lint** - ESLint, Flake8
2. **Build** - Next.js, Django collectstatic
3. **Test** - Pytest, Playwright
4. **Security** - npm audit, safety

## 📁 Fichiers Clés

| Fichier | Description |
|---------|-------------|
| `backend/api/models.py` | Tous les modèles Django |
| `backend/api/views.py` | Tous les endpoints API |
| `front/app/api/assistant-demo/route.ts` | Logique assistant IA |
| `docker-compose.yml` | Configuration Docker |
| `.github/workflows/ci.yml` | Pipeline CI/CD |
