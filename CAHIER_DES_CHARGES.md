# Cahier des Charges - Application d'Archivage ACS

**Client** : ACS - Assureurs Conseils Service  
**Date** : 12 Novembre 2025  
**Équipe** : [KASSI ELIE EMMANUEL ET ASSINYO RODRIGUE]  
**Version** : 1.0

---

## 1. Contexte et Objectifs

### 1.1 Contexte
- Société de courtage d'assurances en Côte d'Ivoire
- Besoin de digitaliser et centraliser les archives
- Remplacement d'une application incomplète (code source perdu)

### 1.2 Objectifs
- [ ] Centraliser tous les documents de l'entreprise
- [ ] Faciliter la recherche et l'accès aux documents
- [ ] Sécuriser les données sensibles
- [ ] Traçabilité des actions sur les documents
- [ ] Déploiement public (accessible en ligne)

---

## 2. Périmètre Fonctionnel

### 2.1 Gestion des Utilisateurs
- [ ] Inscription/Connexion sécurisée
- [ ] Rôles : Admin, Gestionnaire, Employé, Consultant (à définir)
- [ ] Gestion des permissions par rôle
- [ ] Profil utilisateur

### 2.2 Gestion des Documents

#### Upload
- [ ] Types de fichiers acceptés : ___________ (PDF, Word, Excel, Images, etc.)
- [ ] Taille maximale par fichier : ___________ MB
- [ ] Upload multiple : Oui / Non
- [ ] Scan de documents : Oui / Non

#### Métadonnées
- [ ] Titre du document
- [ ] Type de document (Contrat, Police, Sinistre, Facture, etc.)
- [ ] Catégorie/Département
- [ ] Client associé
- [ ] Date du document
- [ ] Numéro de référence
- [ ] Tags personnalisés
- [ ] Autres : ___________

### 2.3 Organisation et Classification
- [ ] Arborescence de dossiers : Oui / Non
- [ ] Structure : ___________ (par client, par type, par année, etc.)
- [ ] Catégories principales : ___________
- [ ] Sous-catégories : ___________

### 2.4 Recherche et Filtrage
- [ ] Recherche par nom de fichier
- [ ] Recherche par métadonnées
- [ ] Recherche en texte intégral (OCR) : Oui / Non
- [ ] Filtres : date, type, catégorie, client, etc.
- [ ] Recherche avancée/combinée

### 2.5 Consultation et Téléchargement
- [ ] Prévisualisation des documents (PDF, images)
- [ ] Téléchargement individuel
- [ ] Téléchargement en masse (ZIP)
- [ ] Historique de consultation
- [ ] Watermark sur les documents : Oui / Non

### 2.6 Sécurité et Droits d'Accès
- [ ] Authentification obligatoire
- [ ] Permissions par rôle
- [ ] Permissions par document/dossier
- [ ] Chiffrement des fichiers : Oui / Non
- [ ] Audit trail (traçabilité)
- [ ] Expiration de session après inactivité

### 2.7 Notifications (optionnel)
- [ ] Notification d'upload
- [ ] Notification de modification
- [ ] Rappels (documents expirant)
- [ ] Par email / In-app

### 2.8 Rapports et Statistiques (optionnel)
- [ ] Nombre de documents par catégorie
- [ ] Activité utilisateur
- [ ] Espace de stockage utilisé
- [ ] Documents les plus consultés
- [ ] Export des rapports (PDF, Excel)

---

## 3. Spécifications Techniques

### 3.1 Stack Technique
- **Frontend** : React + Next.js 14, TypeScript, TailwindCSS, shadcn/ui
- **Backend** : Node.js + Express / Next.js API Routes
- **Base de données** : PostgreSQL
- **ORM** : Prisma
- **Stockage fichiers** : AWS S3 / Cloudinary / ___________
- **Authentification** : JWT / NextAuth
- **Hébergement** : Vercel + Railway / AWS / ___________

### 3.2 Contraintes Techniques
- [ ] Responsive (mobile, tablette, desktop)
- [ ] Compatible navigateurs : Chrome, Firefox, Safari, Edge
- [ ] Temps de chargement < 3 secondes
- [ ] Disponibilité : 99% (SLA)
- [ ] Backup quotidien : Oui / Non
- [ ] Support hors ligne : Oui / Non

### 3.3 Volumétrie Estimée
- Nombre d'utilisateurs estimé : ___________
- Nombre de documents à archiver : ___________
- Volume de stockage nécessaire : ___________ GB
- Nombre d'uploads par jour : ___________

---

## 4. Interface Utilisateur

### 4.1 Pages Principales
- [ ] Page de connexion
- [ ] Dashboard (vue d'ensemble)
- [ ] Liste des documents
- [ ] Vue détaillée d'un document
- [ ] Upload de documents
- [ ] Gestion des utilisateurs (admin)
- [ ] Recherche avancée
- [ ] Profil utilisateur
- [ ] Paramètres

### 4.2 Charte Graphique
- Couleurs : ___________ (logo ACS ?)
- Police : ___________
- Style : Moderne, professionnel, épuré

---

## 5. Données Existantes

### 5.1 Migration
- [ ] Récupération de l'ancienne application : Possible / Impossible
- [ ] Documents existants à migrer : ___________ documents
- [ ] Format des données existantes : ___________
- [ ] Structure actuelle : ___________

---

## 6. Livrables

- [ ] Code source (GitHub)
- [ ] Documentation technique
- [ ] Guide utilisateur
- [ ] Documentation d'installation
- [ ] Application déployée en production
- [ ] Formation des utilisateurs (optionnel)

---

## 7. Planning Prévisionnel

| Phase | Durée | Date début | Date fin |
|-------|-------|------------|----------|
| Analyse et conception | ___ jours | ___/___ | ___/___ |
| Développement backend | ___ jours | ___/___ | ___/___ |
| Développement frontend | ___ jours | ___/___ | ___/___ |
| Intégration | ___ jours | ___/___ | ___/___ |
| Tests | ___ jours | ___/___ | ___/___ |
| Déploiement | ___ jours | ___/___ | ___/___ |
| Formation | ___ jours | ___/___ | ___/___ |
| **Total** | **___ jours** | | |

---

## 8. Critères de Validation

- [ ] Tous les types d'utilisateurs peuvent se connecter
- [ ] Upload de documents fonctionnel
- [ ] Recherche rapide et pertinente
- [ ] Permissions respectées
- [ ] Application accessible publiquement
- [ ] Responsive sur tous supports
- [ ] Performance acceptable (< 3s)
- [ ] Tests de sécurité passés
- [ ] Validation par le client

---

## 9. Risques et Contraintes

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Perte de données | Élevé | Faible | Backups automatiques quotidiens |
| Problèmes de performance | Moyen | Moyen | Optimisation + CDN + pagination |
| Sécurité (données sensibles) | Élevé | Moyen | Chiffrement + authentification forte |
| Budget stockage | Moyen | Moyen | Compression + nettoyage automatique |
| ___________ | ___ | ___ | ___ |

---

## 10. Notes de la Réunion d'Archivage

**Date de la réunion** : ___/___/2025

### Points importants
- 
- 
- 

### Fonctionnalités prioritaires
1. 
2. 
3. 

### Points à clarifier
- 
- 

---

## Signatures

**Client (ACS)** : ________________  Date : ___/___/2025

**Équipe Dev** : ________________  Date : ___/___/2025
