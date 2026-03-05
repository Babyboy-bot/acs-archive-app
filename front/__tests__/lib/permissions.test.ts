// __tests__/lib/permissions.test.ts
import { hasPermission, getRolePermissions, type RolePermissions } from '../../lib/permissions'
import { RoleUtilisateur } from '../../types'

describe('Permissions System', () => {

  // ============================================================================
  // ROLE PERMISSIONS DEFINITIONS
  // ============================================================================

  describe('Role Permissions Definitions', () => {
    it('should define ADMIN role with full permissions', () => {
      const adminPerms = getRolePermissions(RoleUtilisateur.ADMIN)
      expect(adminPerms).toBeTruthy()
      expect(adminPerms!.documents.has('voir')).toBe(true)
      expect(adminPerms!.documents.has('creer')).toBe(true)
      expect(adminPerms!.documents.has('modifier')).toBe(true)
      expect(adminPerms!.documents.has('supprimer')).toBe(true)
      expect(adminPerms!.utilisateurs.has('voir')).toBe(true)
      expect(adminPerms!.utilisateurs.has('creer')).toBe(true)
      expect(adminPerms!.utilisateurs.has('modifier')).toBe(true)
      expect(adminPerms!.utilisateurs.has('supprimer')).toBe(true)
      expect(adminPerms!.stats.has('voir')).toBe(true)
    })

    it('should define ARCHIVISTE role with document permissions', () => {
      const archivistePerms = getRolePermissions(RoleUtilisateur.ARCHIVISTE)
      expect(archivistePerms).toBeTruthy()
      expect(archivistePerms!.documents.has('voir')).toBe(true)
      expect(archivistePerms!.documents.has('creer')).toBe(true)
      expect(archivistePerms!.documents.has('modifier')).toBe(true)
      expect(archivistePerms!.documents.has('supprimer')).toBe(true)
      expect(archivistePerms!.utilisateurs.has('voir')).toBe(true)
      expect(archivistePerms!.utilisateurs.has('creer')).toBe(false)
      expect(archivistePerms!.stats.has('voir')).toBe(true)
    })

    it('should define CONSULTANT role with limited permissions', () => {
      const consultantPerms = getRolePermissions(RoleUtilisateur.CONSULTANT)
      expect(consultantPerms).toBeTruthy()
      expect(consultantPerms!.documents.has('voir')).toBe(true)
      expect(consultantPerms!.documents.has('creer')).toBe(false)
      expect(consultantPerms!.documents.has('modifier')).toBe(false)
      expect(consultantPerms!.documents.has('supprimer')).toBe(false)
      expect(consultantPerms!.utilisateurs.has('voir')).toBe(false)
      expect(consultantPerms!.stats.has('voir')).toBe(false)
    })
  })

  // ============================================================================
  // HAS PERMISSION FUNCTION
  // ============================================================================

  describe('hasPermission function', () => {
    describe('ADMIN role permissions', () => {
      it('should allow all document operations for ADMIN', () => {
        expect(hasPermission(RoleUtilisateur.ADMIN, 'documents', 'voir')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ADMIN, 'documents', 'creer')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ADMIN, 'documents', 'modifier')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ADMIN, 'documents', 'supprimer')).toBe(true)
      })

      it('should allow all user operations for ADMIN', () => {
        expect(hasPermission(RoleUtilisateur.ADMIN, 'utilisateurs', 'voir')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ADMIN, 'utilisateurs', 'creer')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ADMIN, 'utilisateurs', 'modifier')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ADMIN, 'utilisateurs', 'supprimer')).toBe(true)
      })

      it('should allow stats viewing for ADMIN', () => {
        expect(hasPermission(RoleUtilisateur.ADMIN, 'stats', 'voir')).toBe(true)
      })
    })

    describe('ARCHIVISTE role permissions', () => {
      it('should allow all document operations for ARCHIVISTE', () => {
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'documents', 'voir')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'documents', 'creer')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'documents', 'modifier')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'documents', 'supprimer')).toBe(true)
      })

      it('should allow only viewing users for ARCHIVISTE', () => {
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'utilisateurs', 'voir')).toBe(true)
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'utilisateurs', 'creer')).toBe(false)
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'utilisateurs', 'modifier')).toBe(false)
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'utilisateurs', 'supprimer')).toBe(false)
      })

      it('should allow stats viewing for ARCHIVISTE', () => {
        expect(hasPermission(RoleUtilisateur.ARCHIVISTE, 'stats', 'voir')).toBe(true)
      })
    })

    describe('CONSULTANT role permissions', () => {
      it('should allow only viewing documents for CONSULTANT', () => {
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'documents', 'voir')).toBe(true)
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'documents', 'creer')).toBe(false)
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'documents', 'modifier')).toBe(false)
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'documents', 'supprimer')).toBe(false)
      })

      it('should deny all user operations for CONSULTANT', () => {
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'utilisateurs', 'voir')).toBe(false)
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'utilisateurs', 'creer')).toBe(false)
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'utilisateurs', 'modifier')).toBe(false)
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'utilisateurs', 'supprimer')).toBe(false)
      })

      it('should deny stats access for CONSULTANT', () => {
        expect(hasPermission(RoleUtilisateur.CONSULTANT, 'stats', 'voir')).toBe(false)
      })
    })

    describe('Error handling', () => {
      it('should return false for null role', () => {
        expect(hasPermission(null, 'documents', 'voir')).toBe(false)
      })

      it('should return false for undefined role', () => {
        expect(hasPermission(undefined, 'documents', 'voir')).toBe(false)
      })

      it('should return false for invalid role', () => {
        expect(hasPermission('INVALID_ROLE' as RoleUtilisateur, 'documents', 'voir')).toBe(false)
      })
    })
  })

  // ============================================================================
  // GET ROLE PERMISSIONS FUNCTION
  // ============================================================================

  describe('getRolePermissions function', () => {
    it('should return correct permissions object for ADMIN', () => {
      const perms = getRolePermissions(RoleUtilisateur.ADMIN)
      expect(perms).toBeTruthy()
      expect(perms!.documents).toBeInstanceOf(Set)
      expect(perms!.utilisateurs).toBeInstanceOf(Set)
      expect(perms!.stats).toBeInstanceOf(Set)
    })

    it('should return correct permissions object for ARCHIVISTE', () => {
      const perms = getRolePermissions(RoleUtilisateur.ARCHIVISTE)
      expect(perms).toBeTruthy()
      expect(perms!.documents.size).toBe(4) // voir, creer, modifier, supprimer
      expect(perms!.utilisateurs.size).toBe(1) // voir
      expect(perms!.stats.size).toBe(1) // voir
    })

    it('should return correct permissions object for CONSULTANT', () => {
      const perms = getRolePermissions(RoleUtilisateur.CONSULTANT)
      expect(perms).toBeTruthy()
      expect(perms!.documents.size).toBe(1) // voir
      expect(perms!.utilisateurs.size).toBe(0) // aucun
      expect(perms!.stats.size).toBe(0) // aucun
    })

    it('should return null for null role', () => {
      expect(getRolePermissions(null)).toBeNull()
    })

    it('should return null for undefined role', () => {
      expect(getRolePermissions(undefined)).toBeNull()
    })

    it('should return null for invalid role', () => {
      expect(getRolePermissions('INVALID_ROLE' as RoleUtilisateur)).toBeNull()
    })
  })

  // ============================================================================
  // BUSINESS LOGIC VALIDATION
  // ============================================================================

  describe('Business Logic Validation', () => {
    it('should enforce role hierarchy correctly', () => {
      // ADMIN should have all permissions
      const adminPerms = getRolePermissions(RoleUtilisateur.ADMIN)!
      const archivistePerms = getRolePermissions(RoleUtilisateur.ARCHIVISTE)!
      const consultantPerms = getRolePermissions(RoleUtilisateur.CONSULTANT)!

      // ADMIN should have at least as many permissions as others
      expect(adminPerms.documents.size).toBeGreaterThanOrEqual(archivistePerms.documents.size)
      expect(adminPerms.utilisateurs.size).toBeGreaterThanOrEqual(archivistePerms.utilisateurs.size)
      expect(archivistePerms.documents.size).toBeGreaterThanOrEqual(consultantPerms.documents.size)
    })

    it('should prevent unauthorized operations', () => {
      // Consultant should not be able to modify documents
      expect(hasPermission(RoleUtilisateur.CONSULTANT, 'documents', 'modifier')).toBe(false)
      expect(hasPermission(RoleUtilisateur.CONSULTANT, 'documents', 'supprimer')).toBe(false)

      // Consultant should not access user management
      expect(hasPermission(RoleUtilisateur.CONSULTANT, 'utilisateurs', 'voir')).toBe(false)

      // Consultant should not access stats
      expect(hasPermission(RoleUtilisateur.CONSULTANT, 'stats', 'voir')).toBe(false)
    })

    it('should validate permission combinations', () => {
      // Test various permission combinations
      const testCases = [
        { role: RoleUtilisateur.ADMIN, resource: 'documents', action: 'supprimer', expected: true },
        { role: RoleUtilisateur.ARCHIVISTE, resource: 'documents', action: 'supprimer', expected: true },
        { role: RoleUtilisateur.CONSULTANT, resource: 'documents', action: 'supprimer', expected: false },
        { role: RoleUtilisateur.ADMIN, resource: 'utilisateurs', action: 'creer', expected: true },
        { role: RoleUtilisateur.ARCHIVISTE, resource: 'utilisateurs', action: 'creer', expected: false },
        { role: RoleUtilisateur.CONSULTANT, resource: 'utilisateurs', action: 'creer', expected: false },
      ]

      testCases.forEach(({ role, resource, action, expected }) => {
        expect(hasPermission(role, resource as any, action as any)).toBe(expected)
      })
    })
  })
})
