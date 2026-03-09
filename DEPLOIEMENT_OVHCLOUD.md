# Guide de Déploiement — ACS Archive sur OVHcloud VPS

## Prérequis

- VPS-1 OVHcloud : 4 vCores, 8Go RAM, 75Go SSD ✅
- Domaine : `assureursconseilservice.com` (DNS pointant vers l'IP du VPS)
- Accès SSH au VPS
- Clé API Mistral prête

---

## ÉTAPE 1 — Connexion et configuration initiale du VPS

```bash
# Se connecter en SSH
ssh ubuntu@<IP_DU_VPS>

# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker et Docker Compose
sudo apt install -y ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Permettre à votre user de lancer Docker sans sudo
sudo usermod -aG docker $USER
newgrp docker

# Vérifier
docker --version
docker compose version
```

---

## ÉTAPE 2 — Configurer le Firewall

```bash
sudo apt install -y ufw

# Règles de base
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser SSH (IMPORTANT : ne pas oublier sinon vous perdez l'accès !)
sudo ufw allow ssh
sudo ufw allow 22

# Autoriser HTTP et HTTPS uniquement
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activer le firewall
sudo ufw enable

# Vérifier
sudo ufw status
```

> ⚠️ Les ports 8000 (backend) et 5000 (frontend) sont intentionnellement FERMÉS.
> Seul nginx sur 80/443 est accessible depuis l'extérieur.

---

## ÉTAPE 3 — Transférer les fichiers du projet

**Depuis votre machine Windows (PowerShell) :**

```powershell
# Créer une archive du projet (sans node_modules, .next, __pycache__)
# Utiliser git pour cloner directement depuis GitHub (recommandé)
```

**Option A — Via Git (recommandé) :**
```bash
# Sur le VPS
cd /home/ubuntu
git clone <URL_DE_VOTRE_REPO_GIT> acs-archive-app
cd acs-archive-app
```

**Option B — Via SCP depuis Windows :**
```powershell
# Depuis PowerShell sur votre machine
scp -r C:\Users\STAGIAIRE-ACS\CascadeProjects\acs-archive-app ubuntu@<IP_VPS>:/home/ubuntu/
```

---

## ÉTAPE 4 — Créer le fichier .env de production

```bash
cd /home/ubuntu/acs-archive-app

# Copier l'exemple
cp .env.example .env

# Éditer le fichier
nano .env
```

**Remplissez chaque valeur :**

```bash
# Générer une SECRET_KEY sécurisée
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# Générer un JWT_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# Générer un mot de passe PostgreSQL
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Contenu minimal du .env de production :**

```env
DEBUG=False
SECRET_KEY=<coller la clé générée>
ALLOWED_HOSTS=assureursconseilservice.com,www.assureursconseilservice.com,backend

POSTGRES_DB=acs_archive
POSTGRES_USER=acs_user
POSTGRES_PASSWORD=<mot de passe fort>
DB_HOST=db
DB_PORT=5432

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_SECRET_KEY=<coller la clé JWT générée>

CORS_ALLOWED_ORIGINS=https://assureursconseilservice.com,https://www.assureursconseilservice.com

ASSISTANT_LLM_ENABLED=true
ASSISTANT_LLM_PROVIDER=mistral
MISTRAL_API_KEY=<votre clé API Mistral>
MISTRAL_BASE_URL=https://api.mistral.ai/v1
MISTRAL_MODEL_DEFAULT=mistral-medium-latest

OCR_ENABLED=true
TESSERACT_LANG=fra

NEXT_PUBLIC_API_BASE_URL=/api
INTERNAL_API_BASE_URL=http://backend:8000/api
```

```bash
# Sécuriser les permissions du fichier .env
chmod 600 .env
```

---

## ÉTAPE 5 — Obtenir le certificat SSL (Let's Encrypt)

> ⚠️ **Avant cette étape**, votre domaine `assureursconseilservice.com` doit pointer vers l'IP du VPS.
> Vérifiez dans OVHcloud Manager → Zone DNS → Enregistrement A → IP du VPS.

```bash
# Installer certbot
sudo apt install -y certbot

# Démarrer d'abord nginx en HTTP seul pour la vérification
# (nginx.conf est déjà configuré avec le bloc /.well-known/acme-challenge/)

# Lancer docker compose pour le premier démarrage (nginx seulement)
docker compose up -d nginx

# Obtenir le certificat
sudo certbot certonly --webroot \
  -w /var/lib/docker/volumes/acs-archive-app_certbot_www/_data \
  -d assureursconseilservice.com \
  -d www.assureursconseilservice.com \
  --email votre@email.com \
  --agree-tos \
  --no-eff-email

# Vérifier que le certificat a été créé
sudo ls /etc/letsencrypt/live/assureursconseilservice.com/
```

> **Alternative plus simple — Utiliser le volume Docker :**
```bash
docker compose run --rm -v /var/www/certbot:/var/www/certbot \
  certbot certonly --webroot --webroot-path=/var/www/certbot \
  -d assureursconseilservice.com \
  -d www.assureursconseilservice.com \
  --email votre@email.com --agree-tos --no-eff-email
```

---

## ÉTAPE 6 — Build et démarrage de l'application

```bash
cd /home/ubuntu/acs-archive-app

# Builder les images Docker (prend ~5-10 minutes la première fois)
docker compose build

# Démarrer tous les services
docker compose up -d

# Vérifier que tout tourne
docker compose ps

# Voir les logs en temps réel
docker compose logs -f
```

**Résultat attendu (`docker compose ps`) :**
```
NAME            STATUS          PORTS
acs-db          running         5432/tcp
acs-backend     running         8000/tcp
acs-frontend    running         5000/tcp
acs-nginx       running         0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

## ÉTAPE 7 — Vérifications post-déploiement

```bash
# Tester le healthcheck backend
curl -s http://localhost/api/health/

# Tester HTTPS
curl -s https://assureursconseilservice.com/api/health/

# Vérifier les logs backend
docker compose logs backend --tail=50

# Vérifier les logs nginx
docker compose logs nginx --tail=50
```

**Dans le navigateur :**
- ✅ `https://assureursconseilservice.com` → Application
- ✅ Cadenas HTTPS présent
- ✅ `http://` redirige automatiquement vers `https://`
- ❌ `http://<IP_VPS>:8000` → Connection refused (port fermé)

---

## ÉTAPE 8 — Créer le premier administrateur

```bash
# Se connecter au container backend
docker exec -it acs-backend bash

# Créer un superutilisateur
python manage.py shell -c "
from api.models import Utilisateur
u = Utilisateur.objects.create_superuser(
    nom_utilisateur='admin',
    nom='Administrateur',
    prenom='ACS',
    password='MotDePasseAdmin2024!',
    email='admin@assureursconseilservice.com',
    role='ADMIN'
)
print(f'Administrateur créé : {u}')
"
```

---

## ÉTAPE 9 — Renouvellement automatique SSL

```bash
# Tester le renouvellement (dry run)
sudo certbot renew --dry-run

# Créer un cron job pour le renouvellement automatique
sudo crontab -e

# Ajouter cette ligne (renouvelle tous les jours à 3h du matin)
0 3 * * * certbot renew --quiet && docker compose -f /home/ubuntu/acs-archive-app/docker-compose.yml exec nginx nginx -s reload
```

---

## ÉTAPE 10 — Sauvegardes automatiques PostgreSQL

```bash
# Créer le script de backup
sudo mkdir -p /home/ubuntu/backups
cat > /home/ubuntu/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p "$BACKUP_DIR"

# Faire le dump
docker exec acs-db pg_dump -U acs_user acs_archive > "$BACKUP_DIR/acs_archive_$DATE.sql"

# Garder seulement les 30 derniers backups
ls -t "$BACKUP_DIR"/*.sql | tail -n +31 | xargs rm -f 2>/dev/null

echo "Backup créé : acs_archive_$DATE.sql"
EOF

chmod +x /home/ubuntu/backup-db.sh

# Cron job : backup tous les jours à 2h du matin
crontab -e
# Ajouter :
0 2 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
```

---

## Commandes utiles au quotidien

```bash
# Redémarrer un service
docker compose restart backend
docker compose restart nginx

# Voir les logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Mettre à jour l'application
git pull
docker compose build
docker compose up -d

# Arrêter l'application
docker compose down

# Espace disque
df -h
docker system df

# Nettoyer les images inutilisées
docker image prune -f
```

---

## En cas de problème

### L'application ne démarre pas
```bash
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
```

### Erreur de base de données
```bash
docker exec -it acs-db psql -U acs_user -d acs_archive
\dt  # Lister les tables
\q   # Quitter
```

### Certificat SSL expiré
```bash
sudo certbot renew --force-renewal
docker compose exec nginx nginx -s reload
```

### Restaurer depuis un backup
```bash
docker exec -i acs-db psql -U acs_user -d acs_archive < /home/ubuntu/backups/acs_archive_XXXXX.sql
```
