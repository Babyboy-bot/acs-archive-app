# Backend Django - ACS Archive

Backend API Django REST Framework pour l'application ACS Archive.

## Prérequis

- Python 3.10 ou supérieur
- PostgreSQL 14 ou supérieur
- pip (gestionnaire de paquets Python)

## Installation

### 1. Installer Python
Télécharge et installe Python depuis [python.org](https://www.python.org/downloads/)

### 2. Créer un environnement virtuel
```bash
cd backend
python -m venv venv
```

### 3. Activer l'environnement virtuel
**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 4. Installer les dépendances
```bash
pip install -r requirements.txt
```

### 5. Configuration
Copie `.env.example` vers `.env` et configure tes variables:
```bash
copy .env.example .env
```

Modifie `.env` avec tes paramètres de base de données PostgreSQL.

### 6. Migrations de base de données
```bash
python manage.py makemigrations
python manage.py migrate
```

### 7. Créer un superutilisateur (optionnel)
```bash
python manage.py createsuperuser
```

### 8. Lancer le serveur
```bash
python manage.py runserver
```

L'API sera accessible sur `http://localhost:8000/api/`

## Endpoints API

### Authentification
- `POST /api/auth/login/` - Connexion utilisateur
- `POST /api/auth/refresh/` - Rafraîchir le token JWT

### Utilisateurs
- `GET /api/utilisateurs/` - Liste des utilisateurs
- `POST /api/utilisateurs/` - Créer un utilisateur
- `GET /api/utilisateurs/{id}/` - Détails d'un utilisateur
- `PUT /api/utilisateurs/{id}/` - Modifier un utilisateur
- `DELETE /api/utilisateurs/{id}/` - Supprimer un utilisateur

### Documents (à venir)
- `GET /api/documents/` - Liste des documents
- `POST /api/documents/` - Créer un document
- etc.

## Structure du projet

```
backend/
├── acs_backend/          # Configuration Django
│   ├── settings.py       # Paramètres
│   ├── urls.py          # Routes principales
│   └── wsgi.py          # WSGI
├── api/                 # Application API
│   ├── models.py        # Modèles de données
│   ├── serializers.py   # Serializers DRF
│   ├── views.py         # Vues/ViewSets
│   └── urls.py          # Routes API
├── manage.py            # Script de gestion Django
└── requirements.txt     # Dépendances Python
```

## Développement

### Tests
```bash
python manage.py test
```

### Créer une nouvelle migration
```bash
python manage.py makemigrations
python manage.py migrate
```

### Shell Django
```bash
python manage.py shell
```

## Intégration avec le frontend React

Le frontend React doit pointer vers `http://localhost:8000/api/` pour les appels API.

Exemple de configuration fetch:
```javascript
const response = await fetch('http://localhost:8000/api/auth/login/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ nomUtilisateur, motDePasse }),
})
```

## Production

Pour le déploiement en production:
1. Désactive `DEBUG=False` dans `.env`
2. Configure `ALLOWED_HOSTS` avec ton domaine
3. Configure un serveur WSGI (Gunicorn, uWSGI)
4. Configure un reverse proxy (Nginx, Apache)
5. Configure les fichiers statiques avec `collectstatic`
