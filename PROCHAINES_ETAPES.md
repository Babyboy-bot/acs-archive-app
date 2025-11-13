# 🚀 PROCHAINES ÉTAPES - ACS ARCHIVE

## ⚠️ URGENT - À FAIRE MAINTENANT

### 1. Configurer le backend Django
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate        # sous Windows
pip install -r requirements.txt
copy .env.example .env          # puis renseigner DB, SECRET_KEY, JWT
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 2. Configurer le frontend Next.js
```powershell
npm install
copy .env.example .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api" >> .env.local
npm run dev
```

### 3. Vérifier le flux d’authentification
- Aller sur `http://localhost:3000/connexion`
- Se connecter avec le compte Django créé (superuser ou utilisateur existant)
- Confirmer que le token est bien stocké (DevTools → Application → localStorage)

### 4. Exécuter les tests prioritaires
1. Téléversement document (`/documents/nouveau`)
2. Statistiques (`/tableau-de-bord`, composant `StatsTempsReel`)
3. Recherche globale (`Ctrl+K` → onglet Documents)
4. Journal d’activités (`/activite`)

---

## 📋 QUESTIONNAIRES À REMPLIR

### A) POUR LES ARCHIVISTES (Questions simples)

**Copiez ce tableau et remplissez:**

```
UTILISATEURS DE L'APPLICATION
┌────────────────┬──────────────┬────────────┬──────────────┐
│ Nom complet    │ Nom d'util.  │ Rôle (*)   │ Téléphone    │
├────────────────┼──────────────┼────────────┼──────────────┤
│ 1.             │              │            │              │
├────────────────┼──────────────┼────────────┼──────────────┤
│ 2.             │              │            │              │
├────────────────┼──────────────┼────────────┼──────────────┤
│ 3.             │              │            │              │
└────────────────┴──────────────┴────────────┴──────────────┘

(*) A=Admin, G=Gestionnaire, E=Employé, C=Consultant
```

**Questions :**
1. Combien de personnes utilisent l'app actuelle ?
2. Comment cherchez-vous un document actuellement ? (étapes)
3. Qu'est-ce qui est lent/compliqué dans l'app actuelle ?
4. Qu'est-ce que vous aimeriez avoir en PLUS ?
5. Environ combien de clients dans la base ?
6. Les années archivées ? (de... à...)
7. Les types de risques utilisés (Auto, Santé, etc.) sont-ils tous ?
8. Quand voulez-vous commencer à utiliser la nouvelle app ?

---

### B) POUR M. KOUAMÉ (Questions techniques)

**Infrastructure:**
1. Type de base de données actuelle ? (SQL Server, MySQL, Access, Excel ?)
2. Pouvez-vous fournir un export/backup de la BDD ?
3. Où sont stockés les fichiers PDF actuellement ? (chemin réseau ?)
4. Environ combien de documents au total ?
5. Taille totale en Go ?

**Hébergement:**
6. Où sera hébergée la nouvelle app ? (serveur local ACS, cloud, autre ?)
7. Système d'exploitation du serveur ?
8. Les utilisateurs seront en réseau local ou accès distant ?

**Migration:**
9. Date/horaire prévu pour la migration ?
10. Besoin d'un environnement de test avant production ?

**Contact:**
11. Responsable technique côté ACS ?
12. Téléphone et email pour support ?

---

## 🔧 À IMPLÉMENTER APRÈS VOS RÉPONSES

### Phase 1: Finaliser migration Django (EN COURS)
- [x] Remplacer toutes les routes `/api/*` Next.js par l’API Django
- [x] Centraliser la gestion JWT (`lib/api.ts`, `lib/session.ts`)
- [ ] Automatiser le refresh token côté frontend
- [ ] Protéger les routes Next.js (middleware / hooks `useSession`)

### Phase 2: Adaptations pour les archivistes
- [ ] Recherche guidée Client → Année → Risque → Rubrique → Référence
- [ ] Templates automatiques de rubriques (ACS → Client, avenants, factures…)
- [ ] Extension des types de risques (MRP, Voyage, Prévoyance, etc.)
- [ ] Alias de connexion « Nom + Code »

### Phase 3: Migration des données existantes
- [ ] Inventaire BDD actuelle + export
- [ ] Script d’import clients/exercices/risques/documents
- [ ] Migration fichiers PDF
- [ ] Validation et échantillons de contrôle

### Phase 4: Fonctionnalités avancées & production
- [ ] Logs d’activité enrichis (IP, navigateur, actions critiques)
- [ ] Limitation des tentatives de connexion / MFA
- [ ] Notifications / alertes (ex : archivage automatique)
- [ ] Sauvegardes planifiées + procédure de restauration
- [ ] Documentation utilisateur + formation

---

## 📊 ÉTAT D'AVANCEMENT ACTUEL

### ✅ TERMINÉ (~85 %)
- Interface Next.js connectée à l’API Django (clients, utilisateurs, catégories, documents, stats, journal)
- Page Paramètres (profil + mot de passe) reliée au backend
- Composants clés migrés (`StatsTempsReel`, `RechercheGlobale`, upload document, journal)
- Nettoyage des anciennes routes Next.js / Prisma / NextAuth

### ⏳ EN COURS (~10 %)
- Tests de bout-en-bout (upload, stats, recherche, journal) et retours utilisateurs
- Documentation projet (AUTHENTIFICATION, README, guides archivistes)
- Plan d’adaptation métiers (recherche guidée, templates rubriques)

### 📝 À FAIRE (~5 %)
- Migration des données historiques
- Formation du personnel et phase pilote
- Mise en production / plan de support

---

## 🎯 TIMELINE ESTIMÉE

**Semaine 1-2 : Authentification & Admin** ← VOUS ÊTES ICI
- Setup authentification
- Interface admin utilisateurs
- Tests sécurité

**Semaine 3 : Migration données**
- Analyse ancienne BDD
- Script de migration
- Import données de test

**Semaine 4 : Tests & Ajustements**
- Tests avec archivistes
- Corrections bugs
- Optimisations

**Semaine 5 : Formation & Déploiement**
- Formation utilisateurs
- Migration production
- Support post-migration

---

## 📞 CONTACTS & SUPPORT

**Développeur :** [Votre nom]
**Email :** [Votre email]
**Téléphone :** [Votre numéro]

**Pour démarrer :**
1. Lire `AUTHENTIFICATION.md` (flux Django + helpers front)
2. Lire `backend/INSTALLATION.md` pour l’API
3. Lire `README.md` (racine) pour la vue d’ensemble

## ✅ CHECKLIST AVANT DE CONTINUER

- [ ] Backend opérationnel (`python manage.py runserver` → `/api/` accessible)
- [ ] Frontend opérationnel (`npm run dev` → `/connexion`, `/documents`, `/activite`)
- [ ] Tests manuels réalisés (upload, stats, recherche, journal)
- [ ] Constat utilisateur rédigé (questionnaire archivistes, responsable)
- [ ] Documentation mise à jour (AUTHENTIFICATION, README, guides)
- [ ] J'ai testé la connexion
- [ ] J'ai rempli le questionnaire archivistes
- [ ] J'ai rempli le questionnaire technique
- [ ] Je suis prêt pour la suite !

---

**Dernière mise à jour :** 12 novembre 2025  
**Version :** 2.0.0-beta
