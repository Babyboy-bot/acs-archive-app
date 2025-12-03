# ACS Archive App

Application d’archivage documentaire moderne avec interface web (Next.js) et backend (Django), intégrant un assistant IA conversationnel, la gestion avancée des thèmes (clair/sombre), un logo personnalisable et une expérience utilisateur optimisée.

## Structure du projet

```
/acs-archive-app/
├── front/          # Frontend Next.js (App Router, TypeScript, TailwindCSS)
│   ├── app/        # Pages (dashboard, documents, assistant, paramètres...)
│   ├── components/ # Composants React réutilisables
│   ├── lib/        # Utilitaires (API, session, thème, etc.)
│   ├── public/     # Fichiers statiques (logo, images)
│   └── ...
└── back/           # Backend Django (API REST)
    ├── backend/
    │   ├── api/    # Vues, serializers, urls, modèles
    │   ├── acs_backend/
    │   └── manage.py
    └── .venv/      # Environnement virtuel Python
```

## Démarrage rapide

### Backend (Django)
```bash
cd back
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py runserver
```

### Frontend (Next.js)
```bash
cd front
npm install
npm run dev
```

## Variables d’environnement

- Dans `front/.env.local` :
  ```bash
  NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
  ASSISTANT_LLM_PROVIDER=openai
  ASSISTANT_LLM_API_KEY=sk-...
  ASSISTANT_LLM_MODEL=gpt-4o-mini
  ASSISTANT_LLM_ENABLED=true
  ```
- Dans `back/backend/.env` (optionnel) :
  ```bash
  DEBUG=True
  SECRET_KEY=...
  DATABASE_URL=sqlite:///db.sqlite3
  ```

## Fonctionnalités principales

- Authentification JWT multi-rôles (admin, archiviste, consultant)
- Gestion complète des documents, clients, exercices, risques
- Assistant IA conversationnel (OpenAI, configurable, historique persistant)
- Recherche sémantique avancée (TF-IDF / FAISS)
- Téléchargement, impression, ouverture de pièces justificatives
- Interface responsive, expérience utilisateur soignée
- Thème clair/sombre personnalisable (avec bouton de bascule, persistance)
- Logo ACS personnalisable dans la navigation
- Persistance du mode d’affichage (grille/liste) pour les documents
- Tableaux de bord avec graphiques (Recharts)

## Technologies utilisées

- **Frontend** : Next.js (App Router), TypeScript, TailwindCSS, Heroicons, Recharts, Framer Motion
- **Backend** : Django REST Framework, SQLite (par défaut)
- **Assistant IA** : OpenAI (gpt-4o-mini, configurable)

## Notes

- Les médias sont servis par Django en développement (`/media/`).
- Le frontend communique avec le backend via `/api/*`.

## Branches

- La branche `fonctionnalite assistant ia` a été fusionnée et peut être supprimée si elle n’est plus utile.
- Utilisez `main` pour toute évolution.
>>>>>>> bd767f74 (Mise à jour README et thème)
