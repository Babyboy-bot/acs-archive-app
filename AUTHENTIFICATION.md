# 🔐 SYSTÈME D'AUTHENTIFICATION ET PERMISSIONS

## ✅ CE QUI A ÉTÉ IMPLÉMENTÉ

### 1. Schéma Base de Données
- ✅ Ajout champ `nomUtilisateur` (unique) pour connexion
- ✅ Ajout champ `derniereConnexion` pour tracking
- ✅ Email devient optionnel
- ✅ 4 rôles : ADMIN, GESTIONNAIRE, EMPLOYE, CONSULTANT

### 2. Système d'authentification
- ✅ Connexion par **nom d'utilisateur** (pas email)
- ✅ Hash de mot de passe avec bcrypt
- ✅ Tokens JWT sécurisés (7 jours)
- ✅ Cookies HttpOnly
- ✅ API `/api/auth/login`

### 3. Système de permissions
- ✅ Fonction `aLaPermission(role, action, ressource)`
- ✅ Matrice complète des permissions par rôle

---

## 🔧 PROCHAINES ÉTAPES OBLIGATOIRES

### Étape 1: Mettre à jour la base de données
```powershell
# Arrêter le serveur dev (Ctrl+C)
# Fermer VS Code
# Rouvrir VS Code
npx prisma generate
npx prisma db push
```

### Étape 2: Créer un utilisateur admin
```powershell
# Script à créer: scripts/creer-admin.ts
npm run create-admin
```

### Étape 3: Tester la connexion
```powershell
npm run dev
# Aller sur http://localhost:3000/connexion
# Se connecter avec le compte admin
```

---

## 👥 MATRICE DES PERMISSIONS

| Fonctionnalité | ADMIN | GESTIONNAIRE | EMPLOYE | CONSULTANT |
|----------------|-------|--------------|---------|------------|
| **Documents** |
| Voir documents | ✅ | ✅ | ✅ | ✅ |
| Créer document | ✅ | ✅ | ✅ | ❌ |
| Modifier document | ✅ | ✅ | ✅ (siens) | ❌ |
| Supprimer document | ✅ | ✅ | ❌ | ❌ |
| Exporter | ✅ | ✅ | ✅ | ❌ |
| **Utilisateurs** |
| Voir utilisateurs | ✅ | ✅ | ❌ | ❌ |
| Créer utilisateur | ✅ | ✅ | ❌ | ❌ |
| Modifier utilisateur | ✅ | ✅ (non-admin) | ❌ | ❌ |
| Supprimer utilisateur | ✅ | ❌ | ❌ | ❌ |
| **Catégories** |
| Voir catégories | ✅ | ✅ | ✅ | ✅ |
| Gérer catégories | ✅ | ✅ | ❌ | ❌ |
| **Statistiques** |
| Voir stats | ✅ | ✅ | ✅ | ❌ |

---

## 📝 FORMAT NOMS D'UTILISATEUR

**Recommandations :**
- `prenom.nom` → `elie.kassi`
- `prenomnom` → `eliekassi`
- `code` → `EKA001`

**Exemples :**
```
Elie Kassi → elie.kassi
Rodrigue Assinyo → rodrigue.assinyo
Admin → admin
```

---

## 🔒 SÉCURITÉ

### Mots de passe
- ✅ Hash avec bcrypt (coût 10)
- ✅ Pas de stockage en clair
- ✅ Validation côté serveur

### Tokens JWT
- ✅ Durée de vie : 7 jours
- ✅ Secret dans `.env` (JWT_SECRET)
- ✅ HttpOnly cookies

### À ajouter dans `.env`
```env
JWT_SECRET=votre-secret-ultra-securise-changez-moi-en-production
```

---

## 📋 À IMPLÉMENTER ENSUITE

1. ⏳ Middleware de protection des routes
2. ⏳ Interface admin de gestion utilisateurs
3. ⏳ Script de migration depuis ancienne BDD
4. ⏳ Réinitialisation mot de passe
5. ⏳ Logs d'activité sécurisés
6. ⏳ Limitation tentatives de connexion

---

## 🎯 UTILISATION DANS LE CODE

### Vérifier les permissions (API)
```typescript
import { aLaPermission } from '@/lib/auth'

// Dans une route API
if (!aLaPermission(utilisateur.role, 'supprimer', 'documents')) {
  return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })
}
```

### Protéger un composant (Frontend)
```typescript
// À créer: hooks/useAuth.ts
const { utilisateur } = useAuth()

if (utilisateur.role !== 'ADMIN') {
  return <div>Accès refusé</div>
}
```

---

## 🐛 PROBLÈMES CONNUS

1. **Erreur Prisma generate** : Fermer VS Code et relancer
2. **TypeScript errors** : Disparaissent après `npx prisma generate`
3. **Cookie non envoyé** : Vérifier que le serveur tourne en HTTPS en prod

---

## ✅ CHECKLIST AVANT PROD

- [ ] Changer JWT_SECRET en production
- [ ] Activer HTTPS
- [ ] Configurer CORS
- [ ] Ajouter rate limiting
- [ ] Activer logs
- [ ] Backup BDD réguliers
- [ ] Tester tous les rôles
- [ ] Documentation utilisateurs

---

**Créé le:** 12 novembre 2025  
**Dernière mise à jour:** 12 novembre 2025
