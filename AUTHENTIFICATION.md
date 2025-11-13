# 🔐 Authentification & Permissions – Architecture actuelle

Depuis la migration vers Django REST Framework, tout l’authentification repose sur **Simple JWT** côté backend et sur des helpers TypeScript côté frontend. Cette page résume le fonctionnement mis en place, la configuration minimale et les bonnes pratiques à suivre.

---

## 1. Vue d’ensemble

| Couche | Description |
|--------|-------------|
| **Backend** | Django 5 + DRF + `rest_framework_simplejwt`. Endpoints principaux : `POST /api/auth/login/`, `POST /api/auth/refresh/`, `POST /api/utilisateurs/{id}/change-password/`. |
| **Frontend** | Next.js 14 (App Router). Les appels API passent obligatoirement par `lib/api.ts` (`apiFetch` / `apiFetchJson`) qui ajoutent le header `Authorization: Bearer ...`. |
| **Stockage session** | `lib/session.ts` conserve `authToken`, `refreshToken`, `utilisateurActif` dans `localStorage` (navigateur) et fournit des helpers (`getToken`, `getUtilisateurActif`, etc.). |
| **Permissions** | Classes DRF : `IsAuthenticated` + `RoleBasedPermission`. Les rôles (ADMIN, GESTIONNAIRE, EMPLOYE, CONSULTANT) sont portés par le modèle `Utilisateur`. |

---

## 2. Flux de connexion

1. L’utilisateur saisit `nom_utilisateur` + `mot_de_passe` sur `/connexion`.
2. Le composant appelle `apiFetchJson('/auth/login/')` → backend Django.
3. Django vérifie l’utilisateur (hash BCrypt géré par Django, pas de Prisma). En cas de succès :
   - Retour du `token` (JWT d’accès), `refresh`, et des métadonnées utilisateur.
4. Le frontend stocke cette session via `enregistrerSession` (`lib/session.ts`).
5. Tous les fetchs ultérieurs utilisent `apiFetch` qui lit le token et le met dans le header `Authorization`.
6. En cas de 401, une stratégie de refresh peut être ajoutée (voir backlog).

---

## 3. Configuration minimale

### Backend (Django)
```env
# backend/.env
SECRET_KEY=...
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DATABASE_URL=postgres://...

# Tokens (simplejwt)
ACCESS_TOKEN_LIFETIME=15  # minutes
REFRESH_TOKEN_LIFETIME=1440  # minutes (1 jour)
```

Étapes :
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend (Next.js)
```bash
cp .env.example .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api" >> .env.local
npm install
npm run dev
```

---

## 4. Matrice des permissions (backend)

| Ressource / action | ADMIN | GESTIONNAIRE | EMPLOYE | CONSULTANT |
|--------------------|:-----:|:------------:|:-------:|:----------:|
| Documents – lire   | ✅    | ✅           | ✅      | ✅         |
| Documents – créer  | ✅    | ✅           | ✅      | ❌         |
| Documents – éditer | ✅    | ✅           | ✅ (portés) | ❌      |
| Documents – supprimer | ✅ | ✅           | ❌      | ❌         |
| Utilisateurs – lire | ✅   | ✅           | ❌      | ❌         |
| Utilisateurs – créer/modifier | ✅ | ✅ (hors ADMIN) | ❌ | ❌ |
| Catégories – gérer | ✅    | ✅           | ❌      | ❌         |
| Stats / journal – lire | ✅ | ✅          | ✅      | ❌         |

Ces règles sont définies dans `backend/api/permissions.py` (classe `RoleBasedPermission`). Toute nouvelle vue doit définir l’attribut `ressource` pour appliquer la matrice.

---

## 5. Helpers frontend disponibles

```typescript
// lib/session.ts
enregistrerSession({ token, refresh, utilisateur })
getToken()
getRefreshToken()
getUtilisateurActif()

// lib/api.ts
apiFetch(path, options?)
apiFetchJson(path, options?)
```

> ⚠️ Ne jamais effectuer de `fetch` direct vers l’API : passer par ces helpers garantit l’ajout du JWT et la gestion d’erreurs homogène.

---

## 6. Sécurité & bonnes pratiques

- **Stockage JWT** : localStorage (côté client) → prévoir un refresh automatique et un bouton de déconnexion.
- **HTTPS** : obligatoire en production pour éviter l’interception des tokens.
- **Rotation des mots de passe** : Django gère le hashing via `PBKDF2` (pas de code custom).
- **Logs d’activité** : le backend journalise créations/updates (voir `log_activity`).
- **CORS** : configuré dans `backend/acs_backend/settings.py` (`CORS_ALLOWED_ORIGINS`).
- **Réinitialisation de mot de passe** : endpoint `change-password` disponible côté utilisateur ; prévoir un flux “mot de passe oublié” séparé.

---

## 7. Points encore à améliorer

1. **Refresh token automatique** : implémenter un interceptateur côté `lib/api.ts` pour tenter `/auth/refresh/` avant de déconnecter l’utilisateur.
2. **Protection des routes frontend** : créer un hook `useSession` / `useAuth` pour rediriger vers `/connexion` si pas de token.
3. **Audit de rôles** : exposer dans l’UI les permissions effectives (ex : masquer les boutons “Supprimer” aux rôles non autorisés).
4. **Journalisation avancée** : ajouter IP + navigateur côté frontend pour les actions sensibles.
5. **Gestion des identifiants historiques** : prévoir un alias `code` → `nom_utilisateur` si nécessaire.

---

## 8. Checklist rapide

- [ ] Backend : `.env` configuré, migrations appliquées, superuser créé.
- [ ] Frontend : `.env.local` avec `NEXT_PUBLIC_API_BASE_URL`, dépendances installées.
- [ ] Connexion testée sur `/connexion` avec un compte Django.
- [ ] Appels API front passent par `lib/api.ts` (vérifier via DevTools).
- [ ] Pages sensibles vérifient les rôles avant d’afficher des actions.

---

**Dernière mise à jour** : 13 novembre 2025 – Migration complète vers Django REST Framework.
