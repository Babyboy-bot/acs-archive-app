# ACS Archive

Application de gestion et d'archivage documentaire développée pour ACS (Assureurs Conseils Service). Elle centralise les documents clients, les bordereaux de compagnie et les pièces justificatives liées aux exercices et risques, avec un assistant IA pour faciliter la recherche.

## Structure du projet

```
acs-archive-app/
├── backend/
│   ├── acs_backend/          # Configuration Django, Celery, URLs racine
│   ├── api/
│   │   ├── models.py         # Modèles (Client, Exercice, Risque, Document, Bordereau...)
│   │   ├── serializers.py
│   │   ├── views_main.py     # Vues principales (documents, assistant, stats...)
│   │   ├── views_bordereaux.py  # Vues bordereaux + corbeille bordereaux
│   │   ├── views/            # Package réexportant les vues (rétrocompatibilité)
│   │   ├── urls.py
│   │   ├── migrations/       # Migrations Django (0001 à 0029)
│   │   └── tests/            # Tests pytest
│   └── requirements*.txt
└── front/
    ├── app/
    │   ├── bordereaux/       # Liste et dépôt de bordereaux
    │   ├── clients/
    │   ├── corbeille/        # Corbeille documents et bordereaux
    │   ├── documents/
    │   ├── utilisateurs/
    │   └── ...
    ├── components/           # Sidebar, AppLayout, Icon, modals...
    ├── hooks/                # Hooks auth, permissions, session
    └── lib/                  # Client API, helpers
```

## Fonctionnalités

### Documents

Chaque document est rattaché à un client, un exercice annuel et un risque. Il porte un type de courrier (ACS vers client, ACS vers compagnie, avenant, facture, règlement, sinistre...), une date, une référence et la taille du fichier. Les fichiers sont stockés côté serveur et servis via un proxy Django qui vérifie les droits avant de renvoyer le contenu.

La recherche filtre par client, exercice, type de risque et type de courrier. Une barre globale (Ctrl+K) couvre en plus le titre et la référence, avec normalisation des accents et de la casse.

La suppression est logique (soft delete) : les documents retirés passent en corbeille et peuvent être restaurés ou purgés définitivement par un administrateur.

### Bordereaux

Les bordereaux sont des fichiers transmis par les compagnies d'assurance. L'application permet de les déposer (upload), consulter, modifier et supprimer. Les compagnies correspondent aux clients de type Entreprise dans la base de données.

Chaque bordereau porte un titre, une référence, une année et un lien vers la compagnie concernée. La liste est paginée (20 par page) avec des filtres par compagnie, année et recherche textuelle à déclenchement automatique (debounce 400 ms). Les bordereaux supprimés rejoignent la corbeille séparément des documents, avec les mêmes options de restauration et purge.

### Corbeille

La page corbeille est réservée aux administrateurs. Elle affiche deux onglets : un pour les documents supprimés et un pour les bordereaux supprimés. Pour chaque élément il est possible de le restaurer (remet l'enregistrement en actif) ou de le purger définitivement (supprime le fichier du serveur).

### Assistant IA

L'assistant permet d'interroger les documents en langage naturel via un chat. La recherche s'appuie sur TF-IDF (scikit-learn) sur les contenus indexés, combinée au LLM Mistral pour formuler les réponses. Les conversations sont persistées et consultables par l'utilisateur. Un suivi de l'usage LLM est disponible pour les administrateurs dans la section "Stats LLM".

La recherche sémantique basée sur des embeddings (torch / sentence-transformers) a été retirée du projet pour des raisons de compatibilité d'infrastructure. La recherche TF-IDF couvre les besoins actuels.

### Rôles et permissions

- **Administrateur** : accès complet (utilisateurs, corbeille, stats LLM, paramètres système).
- **Archiviste** : mêmes droits que l'administrateur sur les données métier (création, modification, suppression de documents et bordereaux), sans accès aux réglages système.
- **Consultant** : lecture seule. Ne peut pas créer, modifier ni supprimer.

Les permissions sont vérifiées côté backend (rôle contrôlé dans chaque vue) et côté frontend (hooks de garde, boutons désactivés selon le rôle).

## Démarrage

### Avec Docker

```bash
docker compose up -d
```

- Application : http://acs.localhost:8080
- API : http://acs.localhost:8000/api/
- Health check : http://acs.localhost:8000/api/health/

Docker Desktop doit être démarré avant de lancer la commande.

```bash
# Logs
docker compose logs -f

# Arrêter
docker compose down
```

### En local sans Docker

**Backend :**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API disponible sur http://127.0.0.1:8000/api/. PostgreSQL doit être disponible localement.

**Frontend :**

```powershell
cd front
npm install
npm run dev
```

Interface sur http://localhost:3000.

## Variables d'environnement

### front/.env.local

```env
NEXT_PUBLIC_API_BASE_URL=/api
MISTRAL_API_KEY=votre-cle-api-mistral
MISTRAL_BASE_URL=https://api.mistral.ai/v1
ASSISTANT_LLM_ENABLED=true
```

### backend/.env

```env
DEBUG=True
SECRET_KEY=changez-cette-valeur
DATABASE_URL=postgresql://utilisateur:motdepasse@localhost:5432/acs_archive
ALLOWED_HOSTS=localhost,127.0.0.1,backend,acs.localhost
CORS_ALLOWED_ORIGINS=http://localhost:8080,http://acs.localhost:8080
```

## Authentification

Les tokens JWT sont stockés dans des cookies httpOnly, ce qui les rend inaccessibles en JavaScript. Un middleware Django lit les cookies à chaque requête et injecte l'en-tête Authorization pour les vues DRF. Le frontend envoie toutes les requêtes avec credentials: include.

Le refresh est automatique : si le token d'accès a expiré, le frontend tente de le renouveler avant de rediriger vers la connexion.

La page "mot de passe oublié" n'envoie pas d'email. Elle indique à l'utilisateur de contacter l'administrateur ACS.

## Technologies

**Backend :** Django 5, Django REST Framework, PostgreSQL, Celery + Redis, scikit-learn, PyPDF2, Pillow, Sentry, Gunicorn

**Frontend :** Next.js 14 (App Router), React, TypeScript, TailwindCSS, Framer Motion, Recharts, Lucide

**Infrastructure :** Docker Compose, Nginx, GitHub Actions

## Intégration continue

Un pipeline GitHub Actions s'exécute sur chaque push vers main ou develop. Il couvre :

- Build Next.js et vérification TypeScript
- Checks Django (manage.py check) et application des migrations
- Tests pytest avec rapport de couverture (seuil minimum 30 %, actuellement environ 40 %)
- Audit de sécurité des dépendances npm et pip

## Dépannage

- **Sous-domaine non résolu** : ajouter `127.0.0.1 acs.localhost` dans le fichier hosts du système (C:\Windows\System32\drivers\etc\hosts sur Windows).
- **Port occupé** : vérifier avec `netstat -ano | findstr :8080` (ou :8000, :5432).
- **Volumes Docker corrompus** : `docker compose down -v` puis `docker compose up -d`.
- **Logs ciblés** : `docker compose logs backend` ou `docker compose logs frontend`.

## Notes

- Les fichiers médias sont servis par Django en développement via /media/.
- La branche principale est main.
- Les sauvegardes de base se font avec pg_dump / pg_restore. Aucun mécanisme de backup automatique n'est intégré à l'application elle-même.
