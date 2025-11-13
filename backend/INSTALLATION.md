# Guide d'installation du Backend Django

## Étapes d'installation

### 1. Installer Python

Télécharge et installe Python 3.10+ depuis [python.org](https://www.python.org/downloads/)

**Important pour Windows :**
- Coche "Add Python to PATH" pendant l'installation
- Redémarre ton terminal après l'installation

Vérifie l'installation :
```bash
python --version
```

### 2. Créer un environnement virtuel

```bash
cd backend
python -m venv venv
```

### 3. Activer l'environnement virtuel

**Windows (PowerShell) :**
```bash
venv\Scripts\Activate.ps1
```

**Windows (CMD) :**
```bash
venv\Scripts\activate.bat
```

**Linux/Mac :**
```bash
source venv/bin/activate
```

### 4. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 5. Configuration de la base de données

Copie le fichier d'exemple :
```bash
copy .env.example .env
```

Modifie `.env` avec tes paramètres PostgreSQL :
```env
SECRET_KEY=ton-secret-key-unique
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=acs_archive
DB_USER=postgres
DB_PASSWORD=ton-mot-de-passe
DB_HOST=localhost
DB_PORT=5432

JWT_SECRET_KEY=ton-jwt-secret-unique
JWT_ACCESS_TOKEN_LIFETIME=7

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 6. Créer la base de données PostgreSQL

Ouvre pgAdmin ou psql et crée la base :
```sql
CREATE DATABASE acs_archive;
```

### 7. Appliquer les migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 8. Créer un superutilisateur

```bash
python manage.py createsuperuser
```

Remplis les informations demandées :
- Nom d'utilisateur : admin
- Nom : Admin
- Prénom : System
- Email : admin@acs.com
- Mot de passe : (choisis un mot de passe sécurisé)

### 9. Lancer le serveur

```bash
python manage.py runserver
```

Le serveur sera accessible sur `http://localhost:8000/`

### 10. Tester l'API

Accède à :
- Admin Django : `http://localhost:8000/admin/`
- API Root : `http://localhost:8000/api/`

## Endpoints disponibles

### Authentification
- `POST /api/auth/login/` - Connexion
  ```json
  {
    "nom_utilisateur": "admin",
    "mot_de_passe": "votre-mot-de-passe"
  }
  ```

- `POST /api/auth/refresh/` - Rafraîchir le token
  ```json
  {
    "refresh": "votre-refresh-token"
  }
  ```

### Utilisateurs
- `GET /api/utilisateurs/` - Liste des utilisateurs
- `POST /api/utilisateurs/` - Créer un utilisateur
  ```json
  {
    "nom_utilisateur": "john.doe",
    "nom": "Doe",
    "prenom": "John",
    "email": "john@example.com",
    "mot_de_passe": "SecurePass123!",
    "role": "EMPLOYE",
    "est_actif": true
  }
  ```
- `GET /api/utilisateurs/{id}/` - Détails d'un utilisateur
- `PUT /api/utilisateurs/{id}/` - Modifier un utilisateur
- `DELETE /api/utilisateurs/{id}/` - Désactiver un utilisateur

### Autres ressources
- `/api/clients/` - Gestion des clients
- `/api/exercices/` - Gestion des exercices
- `/api/risques/` - Gestion des risques
- `/api/categories/` - Gestion des catégories
- `/api/documents/` - Gestion des documents
- `/api/journal-activites/` - Consultation du journal d'activité

## Tests

Lancer les tests :
```bash
python manage.py test
```

Lancer les tests avec verbosité :
```bash
python manage.py test --verbosity=2
```

## Commandes utiles

### Créer de nouvelles migrations
```bash
python manage.py makemigrations
```

### Appliquer les migrations
```bash
python manage.py migrate
```

### Créer un superutilisateur
```bash
python manage.py createsuperuser
```

### Shell Django interactif
```bash
python manage.py shell
```

### Collecter les fichiers statiques (production)
```bash
python manage.py collectstatic
```

## Dépannage

### Erreur "Python n'est pas reconnu"
- Assure-toi que Python est dans le PATH
- Redémarre ton terminal
- Utilise `py` au lieu de `python` sur Windows

### Erreur de connexion à la base de données
- Vérifie que PostgreSQL est démarré
- Vérifie les paramètres dans `.env`
- Vérifie que la base `acs_archive` existe

### Erreur d'importation de modules
- Assure-toi que l'environnement virtuel est activé
- Réinstalle les dépendances : `pip install -r requirements.txt`

### Port 8000 déjà utilisé
Utilise un autre port :
```bash
python manage.py runserver 8001
```

## Prochaines étapes

1. Configure le frontend React pour pointer vers `http://localhost:8000/api/`
2. Teste les endpoints avec Postman ou curl
3. Implémente l'upload de fichiers pour les documents
4. Configure le déploiement en production
