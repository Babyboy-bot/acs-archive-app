# Documentation de l'API Backend Django - ACS Archive

## Base URL
```
http://localhost:8000/api/
```

## Authentification

Toutes les requêtes (sauf `/auth/login/`) nécessitent un token JWT dans le header :
```
Authorization: Bearer <votre-token-jwt>
```

---

## Endpoints d'Authentification

### POST /api/auth/login/
Connexion utilisateur et obtention du token JWT.

**Requête :**
```json
{
  "nom_utilisateur": "john.doe",
  "mot_de_passe": "SecurePass123!"
}
```

**Réponse (200 OK) :**
```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "utilisateur": {
    "id": "uuid-here",
    "nomUtilisateur": "john.doe",
    "nom": "Doe",
    "prenom": "John",
    "email": "john@example.com",
    "role": "EMPLOYE"
  }
}
```

**Erreurs :**
- `400` : Champs manquants
- `401` : Identifiants incorrects ou utilisateur inactif

---

### POST /api/auth/refresh/
Rafraîchir le token d'accès.

**Requête :**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Réponse (200 OK) :**
```json
{
  "access": "nouveau-token-jwt"
}
```

---

## Endpoints Utilisateurs

### GET /api/utilisateurs/
Liste tous les utilisateurs.

**Paramètres de requête (optionnels) :**
- `role` : Filtrer par rôle (ADMIN, GESTIONNAIRE, EMPLOYE, CONSULTANT)
- `est_actif` : Filtrer par statut (true/false)
- `search` : Recherche dans nom, prénom, nom_utilisateur, email

**Réponse (200 OK) :**
```json
{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid-here",
      "nom_utilisateur": "john.doe",
      "nom": "Doe",
      "prenom": "John",
      "email": "john@example.com",
      "role": "EMPLOYE",
      "est_actif": true,
      "derniere_connexion": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /api/utilisateurs/
Créer un nouvel utilisateur.

**Permissions requises :** ADMIN ou GESTIONNAIRE

**Requête :**
```json
{
  "nom_utilisateur": "jane.smith",
  "nom": "Smith",
  "prenom": "Jane",
  "email": "jane@example.com",
  "mot_de_passe": "SecurePass123!",
  "role": "EMPLOYE",
  "est_actif": true
}
```

**Validations :**
- `nom`, `prenom`, `nom_utilisateur`, `mot_de_passe` : obligatoires
- `mot_de_passe` : minimum 8 caractères
- `nom_utilisateur` : unique
- `email` : unique (si fourni), format valide
- `role` : ADMIN, GESTIONNAIRE, EMPLOYE, ou CONSULTANT

**Réponse (201 Created) :**
```json
{
  "success": true,
  "message": "Utilisateur créé avec succès",
  "utilisateur": {
    "id": "uuid-here",
    "nom_utilisateur": "jane.smith",
    "nom": "Smith",
    "prenom": "Jane",
    "email": "jane@example.com",
    "role": "EMPLOYE",
    "est_actif": true,
    "derniere_connexion": null
  }
}
```

**Erreurs :**
- `400` : Données invalides
- `409` : Nom d'utilisateur ou email déjà utilisé

---

### GET /api/utilisateurs/{id}/
Récupérer les détails d'un utilisateur.

**Réponse (200 OK) :**
```json
{
  "id": "uuid-here",
  "nom_utilisateur": "john.doe",
  "nom": "Doe",
  "prenom": "John",
  "email": "john@example.com",
  "role": "EMPLOYE",
  "est_actif": true,
  "date_creation": "2024-01-01T00:00:00Z",
  "date_modification": "2025-01-15T10:30:00Z",
  "derniere_connexion": "2025-01-15T10:30:00Z"
}
```

---

### PUT /api/utilisateurs/{id}/
Modifier un utilisateur.

**Permissions requises :** ADMIN ou GESTIONNAIRE

**Requête (tous les champs optionnels sauf pour une modification complète) :**
```json
{
  "nom": "Doe",
  "prenom": "John",
  "email": "newemail@example.com",
  "role": "GESTIONNAIRE",
  "est_actif": true
}
```

**Réponse (200 OK) :**
```json
{
  "success": true,
  "message": "Profil mis à jour avec succès",
  "utilisateur": { ... }
}
```

---

### PATCH /api/utilisateurs/{id}/
Modification partielle d'un utilisateur (même fonctionnement que PUT).

---

### DELETE /api/utilisateurs/{id}/
Désactiver un utilisateur (soft delete).

**Permissions requises :** ADMIN

**Réponse (200 OK) :**
```json
{
  "success": true,
  "message": "Utilisateur désactivé avec succès"
}
```

**Note :** L'utilisateur n'est pas supprimé, mais `est_actif` est mis à `false`.

---

## Endpoints Clients

### GET /api/clients/
Liste tous les clients.

### POST /api/clients/
Créer un nouveau client.

**Requête :**
```json
{
  "nom": "Entreprise ABC",
  "numero_client": "CLI-001",
  "type": "ENTREPRISE",
  "email": "contact@abc.com",
  "telephone": "+225 01 02 03 04",
  "adresse": "Abidjan, Cocody"
}
```

### GET /api/clients/{id}/
Détails d'un client.

### PUT /api/clients/{id}/
Modifier un client.

### DELETE /api/clients/{id}/
Supprimer un client.

---

## Endpoints Exercices

### GET /api/exercices/
Liste tous les exercices.

### POST /api/exercices/
Créer un nouvel exercice.

**Requête :**
```json
{
  "annee": 2025,
  "client": "uuid-client",
  "statut": "ACTIF"
}
```

**Statuts possibles :** ACTIF, ARCHIVE, CLOTURE

---

## Endpoints Risques

### GET /api/risques/
Liste tous les risques.

### POST /api/risques/
Créer un nouveau risque.

**Requête :**
```json
{
  "type": "AUTOMOBILE",
  "numero_police": "POL-2025-001",
  "exercice": "uuid-exercice"
}
```

**Types possibles :** AUTOMOBILE, SANTE, HABITATION, VIE, RESPONSABILITE_CIVILE, AUTRE

---

## Endpoints Catégories

### GET /api/categories/
Liste toutes les catégories.

### POST /api/categories/
Créer une nouvelle catégorie.

**Requête :**
```json
{
  "nom": "Contrats",
  "description": "Documents contractuels",
  "couleur": "#D32027"
}
```

---

## Endpoints Documents

### GET /api/documents/
Liste tous les documents.

**Paramètres de requête (optionnels) :**
- `risque` : Filtrer par ID de risque
- `categorie` : Filtrer par ID de catégorie
- `auteur` : Filtrer par ID d'auteur
- `est_archive` : Filtrer par statut archivé (true/false)

### POST /api/documents/
Créer un nouveau document.

**Requête :**
```json
{
  "titre": "Contrat Automobile 2025",
  "description": "Contrat d'assurance automobile",
  "chemin_fichier": "/uploads/documents/contrat-2025.pdf",
  "type_fichier": "application/pdf",
  "taille_fichier": 245678,
  "type_courrier": "ACS_VERS_CLIENT",
  "risque": "uuid-risque",
  "auteur": "uuid-auteur",
  "categorie": "uuid-categorie",
  "date_document": "2025-01-15T00:00:00Z",
  "reference": "REF-2025-001"
}
```

**Types de courrier :** ACS_VERS_CLIENT, ACS_VERS_COMPAGNIE

---

## Endpoints Journal d'Activité

### GET /api/journal-activites/
Consulter le journal d'activité (lecture seule).

**Paramètres de requête (optionnels) :**
- `utilisateur` : Filtrer par ID d'utilisateur
- `document` : Filtrer par ID de document
- `action` : Filtrer par type d'action

**Actions possibles :** CREATION, MODIFICATION, SUPPRESSION, CONSULTATION, TELECHARGEMENT, EXPORT, ARCHIVAGE_AUTO, RESTAURATION

**Réponse (200 OK) :**
```json
{
  "count": 50,
  "next": "http://localhost:8000/api/journal-activites/?page=2",
  "previous": null,
  "results": [
    {
      "id": "uuid-here",
      "action": "CREATION",
      "details": "Document 'Contrat 2025' créé",
      "adresse_ip": "127.0.0.1",
      "date_action": "2025-01-15T10:30:00Z",
      "utilisateur": "uuid-utilisateur",
      "utilisateur_nom": "John Doe",
      "document": "uuid-document",
      "document_titre": "Contrat 2025"
    }
  ]
}
```

---

## Permissions par Rôle

| Ressource      | ADMIN | GESTIONNAIRE | EMPLOYE | CONSULTANT |
|----------------|-------|--------------|---------|------------|
| Documents      | CRUD  | CRUD         | CRU     | R          |
| Utilisateurs   | CRUD  | CRU          | -       | -          |
| Catégories     | CRUD  | CRU          | R       | R          |
| Stats/Journal  | R     | R            | R       | -          |

**Légende :**
- C : Create (Créer)
- R : Read (Lire)
- U : Update (Modifier)
- D : Delete (Supprimer)

---

## Codes de Statut HTTP

- `200 OK` : Requête réussie
- `201 Created` : Ressource créée avec succès
- `400 Bad Request` : Données invalides
- `401 Unauthorized` : Non authentifié ou token invalide
- `403 Forbidden` : Permissions insuffisantes
- `404 Not Found` : Ressource introuvable
- `409 Conflict` : Conflit (ex: nom d'utilisateur déjà utilisé)
- `500 Internal Server Error` : Erreur serveur

---

## Exemples avec curl

### Connexion
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"nom_utilisateur":"admin","mot_de_passe":"password"}'
```

### Liste des utilisateurs
```bash
curl -X GET http://localhost:8000/api/utilisateurs/ \
  -H "Authorization: Bearer <votre-token>"
```

### Créer un utilisateur
```bash
curl -X POST http://localhost:8000/api/utilisateurs/ \
  -H "Authorization: Bearer <votre-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nom_utilisateur":"new.user",
    "nom":"User",
    "prenom":"New",
    "email":"new@example.com",
    "mot_de_passe":"SecurePass123!",
    "role":"EMPLOYE"
  }'
```
