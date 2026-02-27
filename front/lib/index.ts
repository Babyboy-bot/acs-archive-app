/**
 * Utilitaires de l'application
 */

// API
export { apiFetch, apiFetchJson, buildApiUrl } from './api'
export type { ApiFetchOptions } from './api'

// Session
export {
  enregistrerSession,
  supprimerSession,
  getToken,
  getUtilisateurActif,
  API_BASE_URL,
  verifierSessionServeur,
} from './session'
export type { SessionUtilisateur } from './session'

export { normalizeMediaUrl } from './media'

// Permissions
export {
  hasPermission,
  getRolePermissions,
  canAccessSection,
} from './permissions'
export type { PermissionAction, PermissionRessource, RolePermissions } from './permissions'

// Formatters
export * from './formatters'

// Export
export { exporterPDF, exporterExcel, exporterCSV } from './export'

// Print
export { printBlob } from './print'
export type { KnownResourceType } from './print'

// Theme
export { getStoredTheme, applyTheme } from './theme'
export type { ThemeMode } from './theme'
