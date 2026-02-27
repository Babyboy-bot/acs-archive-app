# 🏢 GUIDE DE DÉPLOIEMENT ON-PREMISE ACS ARCHIVE

## 📋 PRÉREQUIS TECHNIQUES MINIMAUX

### 💻 **Configuration serveur requise**
- **RAM** : 4GB minimum (6GB recommandé pour ML)
- **CPU** : 2 cœurs minimum (4 recommandés)
- **Stockage** : 50GB SSD (100GB recommandé)
- **Réseau** : Accès internet sortant (API Mistral)
- **OS** : Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+

### 🔧 **Logiciels nécessaires**
- **Docker & Docker Compose** (Recommandé)
- **PostgreSQL 12+** (ou base existante)
- **Node.js 18+** (si déploiement natif)
- **Python 3.9+** (si déploiement natif)
- **Nginx** (reverse proxy)

---

## 🚀 PLAN DE DÉPLOIEMENT

### 📦 **ÉTAPE 1 : Préparation environnement (1-2 jours)**

#### **Option A : Avec Docker (Recommandée)**
```bash
# 1. Installation Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 2. Installation Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Création répertoire projet
sudo mkdir -p /opt/acs-archive
sudo chown $USER:$USER /opt/acs-archive
cd /opt/acs-archive
```

#### **Option B : Installation native**
```bash
# 1. Backend Python
sudo apt-get update
sudo apt-get install python3-pip python3-venv python3-dev
sudo apt-get install postgresql postgresql-contrib nginx
sudo apt-get install tesseract-ocr tesseract-ocr-fra libtesseract-dev

# 2. Frontend Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pm2

# 3. Environnement Python
sudo mkdir -p /opt/acs-archive
cd /opt/acs-archive
python3 -m venv venv
source venv/bin/activate
```

### 🗄️ **ÉTAPE 2 : Configuration base de données (1 jour)**

#### **PostgreSQL local**
```bash
# 1. Configuration PostgreSQL
sudo -u postgres createdb acs_archive
sudo -u postgres createuser acs_user
sudo -u postgres psql -c "ALTER USER acs_user PASSWORD 'mot_de_passe_securise';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE acs_archive TO acs_user;"

# 2. Test connexion
psql -h localhost -U acs_user -d acs_archive -W
```

#### **Base de données existante**
```sql
-- À exécuter sur votre base existante
CREATE DATABASE acs_archive;
CREATE USER acs_user WITH PASSWORD 'mot_de_passe_securise';
GRANT ALL PRIVILEGES ON DATABASE acs_archive TO acs_user;
```

### 🚀 **ÉTAPE 3 : Déploiement application (1 jour)**

#### **Avec Docker (Simple)**
```bash
# 1. Transférer les fichiers
scp -r acs-archive-app/ user@serveur:/opt/acs-archive/

# 2. Configuration environnement
cd /opt/acs-archive/acs-archive-app
cp .env.example .env
# Éditer .env avec vos valeurs

# 3. Lancement
docker compose up -d

# 4. Vérification
docker compose logs -f
```

#### **Installation native**
```bash
# 1. Backend
cd /opt/acs-archive/backend
source ../venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser

# 2. Démarrage backend (avec PM2)
pm2 start gunicorn --name acs-backend -- \
  --bind 127.0.0.1:8000 \
  --workers 2 \
  --timeout 180 \
  acs_backend.wsgi:application

# 3. Frontend
cd /opt/acs-archive/front
npm install
npm run build
pm2 start npm --name acs-frontend -- start

# 4. Configuration PM2
pm2 save
pm2 startup
```

### 🌐 **ÉTAPE 4 : Configuration Nginx (1 jour)**

```nginx
# /etc/nginx/sites-available/acs-archive
server {
    listen 80;
    server_name acs.votre-entreprise.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fichiers statiques
    location /static/ {
        alias /opt/acs-archive/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Documents uploadés
    location /media/ {
        alias /opt/acs-archive/backend/media/;
        expires 1y;
        add_header Cache-Control "public";
    }
}
```

```bash
# Activation site
sudo ln -s /etc/nginx/sites-available/acs-archive /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 🔐 **ÉTAPE 5 : Sécurité SSL (1 jour)**

```bash
# Installation Certbot
sudo apt-get install certbot python3-certbot-nginx

# Génération certificat
sudo certbot --nginx -d acs.votre-entreprise.com

# Renouvellement automatique
sudo crontab -e
# Ajouter : 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🔧 CONFIGURATION SPÉCIFIQUE

### 📝 **Variables d'environnement (.env)**
```env
# Production
DEBUG=False
SECRET_KEY=votre_clé_secrète_très_longue_et_complexe
ALLOWED_HOSTS=acs.votre-entreprise.com,localhost

# Base de données
DB_HOST=localhost
DB_NAME=acs_archive
DB_USER=acs_user
DB_PASSWORD=mot_de_passe_securise

# API Mistral
MISTRAL_API_KEY=votre_clé_mistral
ASSISTANT_LLM_ENABLED=true

# Sécurité
CORS_ALLOWED_ORIGINS=https://acs.votre-entreprise.com
```

### 🗂️ **Structure des répertoires**
```
/opt/acs-archive/
├── backend/              # Code Django
├── front/               # Code Next.js
├── media/               # Documents uploadés
├── staticfiles/         # Fichiers statiques
├── backups/             # Sauvegardes DB
├── logs/                # Logs applicatifs
└── docker-compose.yml   # Configuration Docker
```

---

## 🛡️ SÉCURITÉ ET MAINTENANCE

### 🔒 **Configuration sécurité**
```bash
# 1. Firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# 2. Permissions
sudo chown -R www-data:www-data /opt/acs-archive/media/
sudo chmod -R 755 /opt/acs-archive/

# 3. Logs rotation
sudo nano /etc/logrotate.d/acs-archive
```

### 💾 **Sauvegardes automatiques**
```bash
#!/bin/bash
# /opt/acs-archive/scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/acs-archive/backups"

# Backup base de données
pg_dump -h localhost -U acs_user acs_archive > $BACKUP_DIR/db_$DATE.sql

# Backup fichiers
tar -czf $BACKUP_DIR/files_$DATE.tar.gz media/

# Nettoyage anciens backups (>30 jours)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

# Cron quotidien : 0 2 * * * /opt/acs-archive/scripts/backup.sh
```

### 📊 **Monitoring**
```bash
# Installation monitoring basique
sudo apt-get install htop iotop

# Scripts santé
#!/bin/bash
# /opt/acs-archive/scripts/health_check.sh
curl -f http://localhost:8000/api/health/ || echo "Backend DOWN"
curl -f http://localhost:3000/ || echo "Frontend DOWN"
pg_isready -h localhost -U acs_user || echo "PostgreSQL DOWN"
```

---

## 🚨 DÉPANNAGE RAPIDE

### 🔍 **Problèmes courants**
```bash
# Vérifier services Docker
docker ps
docker compose logs backend

# Vérifier services natifs
pm2 status
pm2 logs
systemctl status nginx
systemctl status postgresql

# Ports utilisés
netstat -tlnp | grep :80
netstat -tlnp | grep :443
```

### 📞 **Support technique**
- **Logs** : `/opt/acs-archive/logs/`
- **Backup** : `/opt/acs-archive/backups/`
- **Configuration** : `/opt/acs-archive/.env`

---

## 📋 CHECKLIST FINAL

- [ ] Serveur prêt (RAM/CPU/Stockage)
- [ ] Docker installé OU environnement natif configuré
- [ ] PostgreSQL créé et accessible
- [ ] Code source déployé
- [ ] Variables d'environnement configurées
- [ ] Base de données migrée
- [ ] Nginx configuré
- [ ] SSL installé
- [ ] Sauvegardes automatisées
- [ ] Monitoring en place
- [ ] Documentation remise à l'équipe IT

---

*Durée totale estimée : 3-5 jours pour déploiement complet*
