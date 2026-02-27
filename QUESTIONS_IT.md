# 📋 QUESTIONS POUR L'IT - DÉPLOIEMENT ACS ARCHIVE

## 🎯 **Contexte du projet**
Bonjour,

Je dois déployer l'application ACS Archive (gestion documentaire) sur votre serveur cloud existant. 
C'est une application web Django + Next.js avec base de données PostgreSQL.

Voici les informations techniques nécessaires pour le déploiement :

---

## 🔍 **QUESTIONS TECHNIQUES**

### 📦 **Infrastructure existante**
1. **Quel provider cloud utilisez-vous ?** (AWS, Azure, GCP, OVH, etc.)
2. **Type de serveur disponible ?** (EC2, VM, App Service, etc.)
3. **Configuration actuelle du serveur ?**
   - RAM disponible ?
   - CPU cœurs ?
   - Stockage disponible ?
   - Système d'exploitation ?

### 🗄️ **Base de données**
4. **Avez-vous PostgreSQL déjà installé ?**
5. **Puis-je créer une nouvelle base de données `acs_archive` ?**
6. **Y a-t-il un quota sur la taille des bases de données ?**

### 🐳 **Docker et environnement**
7. **Docker est-il installé sur le serveur ?**
8. **Puis-je utiliser Docker Compose ?**
9. **Y a-t-il des restrictions sur les ports ?** (besoin 80/443)

### 🌐 **Accès réseau**
10. **Comment accéder au serveur ?** (SSH, RDP, panel web)
11. **Faut-il un domaine spécifique ?** (ex: acs.entreprise.com)
12. **Y a-t-il un certificat SSL déjà configuré ?**

### 🔐 **Sécurité**
13. **Y a-t-il des politiques de sécurité spécifiques ?**
14. **Puis-je installer des dépendances système ?** (Tesseract OCR)
15. **Les logs sont-ils centralisés ?**

### 📊 **Monitoring**
16. **Avez-vous un système de monitoring ?** (Prometheus, Datadog, etc.)
17. **Les sauvegardes sont-elles automatiques ?**
18. **Y a-t-il des alertes configurées ?**

---

## 📦 **CE QUE JE DOIS FOURNIR**

### 🎯 **Informations à donner à l'IT**
- **Code source** : Repository Git avec Docker Compose
- **Configuration** : Variables d'environnement requises
- **Ressources** : RAM 4GB minimum, stockage 50GB
- **Dépendances** : PostgreSQL, Docker, Tesseract OCR

### 🚀 **Processus de déploiement**
1. **Transfert du code** sur le serveur
2. **Configuration environnement** (variables .env)
3. **Lancement Docker Compose**
4. **Configuration reverse proxy** (Nginx/Apache)
5. **Tests et validation**

---

## ⏱️ **DÉLAIS PRÉVUS**

- **Configuration IT** : 1-2 jours (selon disponibilité)
- **Déploiement technique** : 1 jour
- **Tests et validation** : 1 jour
- **Formation équipe** : 2 jours

**Total estimé : 5-6 jours**

---

## 📞 **CONTACT**

Pour toute question technique sur l'application :
- **Documentation** : Guide déploiement on-premise joint
- **Support** : Disponible pendant tout le déploiement
- **Tests** : Je peux assister aux tests de validation

Merci de votre aide pour ce déploiement !

Cordialement,
[Votre Nom]
Projet ACS Archive
