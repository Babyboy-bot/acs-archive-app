import { RoleUtilisateur } from '@/types'

export type PermissionAction = 'voir' | 'creer' | 'modifier' | 'supprimer'
export type PermissionRessource = 'documents' | 'utilisateurs' | 'categories' | 'stats'

export type RolePermissions = Record<PermissionRessource, ReadonlySet<PermissionAction>>

const buildPermissions = (matrix: Partial<Record<PermissionRessource, PermissionAction[]>>): RolePermissions => {
  return {
    documents: new Set(matrix.documents ?? []),
    utilisateurs: new Set(matrix.utilisateurs ?? []),
    categories: new Set(matrix.categories ?? []),
    stats: new Set(matrix.stats ?? []),
  }
}

const ROLE_PERMISSIONS: Record<RoleUtilisateur, RolePermissions> = {
  ADMIN: buildPermissions({
    documents: ['voir', 'creer', 'modifier', 'supprimer'],
    utilisateurs: ['voir', 'creer', 'modifier', 'supprimer'],
    categories: ['voir', 'creer', 'modifier', 'supprimer'],
    stats: ['voir'],
  }),
  ARCHIVISTE: buildPermissions({
    documents: ['voir', 'creer', 'modifier', 'supprimer'],
    utilisateurs: ['voir', 'creer', 'modifier', 'supprimer'],
    categories: ['voir', 'creer', 'modifier', 'supprimer'],
    stats: ['voir'],
  }),
  CONSULTANT: buildPermissions({
    documents: ['voir'],
    categories: ['voir'],
  }),
}

export function hasPermission(
  role: RoleUtilisateur | null | undefined,
  ressource: PermissionRessource,
  action: PermissionAction
): boolean {
  if (!role) {
    return false
  }
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) {
    return false
  }
  return permissions[ressource].has(action)
}

export function getRolePermissions(role: RoleUtilisateur | null | undefined): RolePermissions | null {
  if (!role || !(role in ROLE_PERMISSIONS)) {
    return null
  }
  return ROLE_PERMISSIONS[role]
}

export function canAccessSection(role: RoleUtilisateur | null | undefined, ressource: PermissionRessource): boolean {
  if (!role) {
    return false
  }
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) {
    return false
  }
  return permissions[ressource].size > 0
}
