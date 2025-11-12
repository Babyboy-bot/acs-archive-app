# Configuration Base de Données PostgreSQL

## Option 1 : PostgreSQL Local (Recommandé pour production)

### Installation
1. Télécharger PostgreSQL : https://www.postgresql.org/download/windows/
2. Installer avec les paramètres par défaut
3. Mot de passe : Choisir un mot de passe pour l'utilisateur `postgres`
4. Port : 5432 (par défaut)

### Configuration
```bash
# Après installation, créer la base de données
psql -U postgres

# Dans psql:
CREATE DATABASE acs_archive;
\q
```

### Fichier .env
```env
DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/acs_archive?schema=public"
```

---

## Option 2 : Supabase (Gratuit, Cloud) ⭐ PLUS RAPIDE

### Avantages
- Pas d'installation locale
- Gratuit (500 MB)
- Backups automatiques
- Déjà en ligne

### Étapes
1. Aller sur https://supabase.com
2. Créer un compte (GitHub/Email)
3. Créer un nouveau projet : "acs-archive"
4. Choisir région : Europe West (proche de CI)
5. Choisir un mot de passe fort
6. Attendre 2 minutes (création)
7. Aller dans Settings → Database
8. Copier "Connection string" (URI)

### Fichier .env
Copier l'URL de connexion de Supabase

---

## Option 3 : Neon (Gratuit, Serverless)

Similaire à Supabase : https://neon.tech

---

## Après Configuration

```bash
# Créer le fichier .env
echo "DATABASE_URL=votre_url_ici" > .env

# Générer le client Prisma
npx prisma generate

# Créer les tables
npx prisma db push

# Ouvrir l'interface Prisma Studio
npx prisma studio
```

## Quelle option choisis-tu ?
