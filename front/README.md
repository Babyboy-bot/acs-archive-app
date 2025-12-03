# Frontend Next.js (ACS Archive App)

Ce dossier contient le frontend Next.js de l’application d’archivage ACS, avec assistant IA intégré, thème clair/sombre, logo personnalisable et expérience utilisateur avancée.

Ce dossier contient le frontend Next.js de l’application d’archivage.

## Démarrage

```bash
cd front
npm install
npm run dev
```

L’interface est accessible sur http://localhost:3000

## Structure

```
front/
├── app/               # Pages Next.js (App Router)
│   ├── (auth)/       # Pages d’authentification
│   ├── (dashboard)/  # Tableaux de bord
│   └── api/          # API routes Next.js (ex: assistant-demo)
├── components/        # Composants React réutilisables
├── lib/              # Utilitaires (API, session, types)
├── types/            # Types TypeScript
├── hooks/            # Hooks React personnalisés
├── public/           # Fichiers statiques
└── scripts/          # Scripts utilitaires
```

## Variables d’environnement

Créer `.env.local` à la racine de `front/` :

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
ASSISTANT_LLM_PROVIDER=openai
ASSISTANT_LLM_API_KEY=sk-...
ASSISTANT_LLM_MODEL=gpt-4o-mini
ASSISTANT_LLM_ENABLED=true
```

## Pages principales

- `/connexion` : login
- `/admin` : tableau de bord admin
- `/archiviste` : tableau de bord archiviste
- `/consultant` : chat assistant IA
- `/assistant-demo` : page de démonstration de l’assistant

## Fonctionnalités

- Authentification JWT (tokens stockés côté client)
- Tableaux de bord avec graphiques (Recharts)
- Assistant IA avec historique persistant
- Téléchargement / impression / ouverture des pièces justificatives
- Upload de documents (drag & drop)

## Dépendances clés

- Next.js (App Router)
- TypeScript
- TailwindCSS
- Heroicons
- Recharts
- Framer Motion
- React PDF
- jsPDF
