/**
 * Constantes centralisées de l'application ACS Archive
 */

// ============================================================================
// TYPES DE RISQUE
// ============================================================================

export const RISQUE_TYPES = [
  'AUTOMOBILE',
  'SANTE',
  'HABITATION',
  'VIE',
  'RESPONSABILITE_CIVILE',
  'MULTIRISQUE_PROFESSIONNELLE',
  'PREVOYANCE_DECES',
  'INDIVIDUELLE_ACCIDENTS',
  'MRP',
  'TRANSPORT',
  'TRANSPORT_FACULTES',
  'CAUTION',
  'TOUS_RISQUES_CHANTIER',
  'AUTRE',
] as const

export type RisqueType = (typeof RISQUE_TYPES)[number]

export const RISQUE_LABELS: Record<string, string> = {
  AUTOMOBILE: 'Automobile',
  SANTE: 'Santé',
  HABITATION: 'Habitation',
  VIE: 'Vie',
  RESPONSABILITE_CIVILE: 'Responsabilité Civile',
  MULTIRISQUE_PROFESSIONNELLE: 'Multirisque Professionnelle',
  PREVOYANCE_DECES: 'Prévoyance Décès',
  INDIVIDUELLE_ACCIDENTS: 'Individuelle Accidents',
  MRP: 'MRP',
  TRANSPORT: 'Transport',
  TRANSPORT_FACULTES: 'Transport Facultés',
  CAUTION: 'Caution',
  TOUS_RISQUES_CHANTIER: 'Tous Risques Chantier',
  AUTRE: 'Autre',
}

export const RISQUE_COLORS: Record<string, string> = {
  AUTOMOBILE: '#3B82F6',
  SANTE: '#10B981',
  HABITATION: '#8B5CF6',
  VIE: '#EC4899',
  RESPONSABILITE_CIVILE: '#F59E0B',
  MULTIRISQUE_PROFESSIONNELLE: '#6366F1',
  PREVOYANCE_DECES: '#F59E0B',
  INDIVIDUELLE_ACCIDENTS: '#DC2626',
  MRP: '#7C3AED',
  TRANSPORT: '#0284C7',
  TRANSPORT_FACULTES: '#0891B2',
  CAUTION: '#EA580C',
  TOUS_RISQUES_CHANTIER: '#F97316',
  AUTRE: '#4B5563',
}

// ============================================================================
// TYPES DE COURRIER
// ============================================================================

export const COURRIER_TYPES = [
  'ACS_VERS_CLIENT',
  'ACS_VERS_COMPAGNIE',
  'AVENANT',
  'FACTURE',
  'REGLEMENT',
  'DIVERS',
  'SINISTRE',
] as const

export type CourrierType = (typeof COURRIER_TYPES)[number]

export const COURRIER_LABELS: Record<CourrierType, string> = {
  ACS_VERS_CLIENT: 'ACS → Client',
  ACS_VERS_COMPAGNIE: 'ACS → Compagnie',
  AVENANT: 'Avenant',
  FACTURE: 'Facture',
  REGLEMENT: 'Règlement',
  DIVERS: 'Divers',
  SINISTRE: 'Sinistre',
}

export const COURRIER_THEMES: Record<CourrierType, {
  buttonBg: string
  buttonText: string
  buttonBorder: string
  badgeBg: string
  badgeText: string
}> = {
  ACS_VERS_CLIENT: {
    buttonBg: '#DBEAFE',
    buttonText: '#1E3A8A',
    buttonBorder: '#BFDBFE',
    badgeBg: '#1D4ED8',
    badgeText: '#FFFFFF',
  },
  ACS_VERS_COMPAGNIE: {
    buttonBg: '#E0E7FF',
    buttonText: '#3730A3',
    buttonBorder: '#C7D2FE',
    badgeBg: '#4338CA',
    badgeText: '#FFFFFF',
  },
  AVENANT: {
    buttonBg: '#FEF3C7',
    buttonText: '#92400E',
    buttonBorder: '#FCD34D',
    badgeBg: '#D97706',
    badgeText: '#FFFFFF',
  },
  FACTURE: {
    buttonBg: '#F5D0FE',
    buttonText: '#86198F',
    buttonBorder: '#F0ABFC',
    badgeBg: '#A21CAF',
    badgeText: '#FFFFFF',
  },
  REGLEMENT: {
    buttonBg: '#D1FAE5',
    buttonText: '#065F46',
    buttonBorder: '#34D399',
    badgeBg: '#047857',
    badgeText: '#FFFFFF',
  },
  DIVERS: {
    buttonBg: '#E5E7EB',
    buttonText: '#374151',
    buttonBorder: '#D1D5DB',
    badgeBg: '#6B7280',
    badgeText: '#FFFFFF',
  },
  SINISTRE: {
    buttonBg: '#FEE2E2',
    buttonText: '#991B1B',
    buttonBorder: '#FECACA',
    badgeBg: '#DC2626',
    badgeText: '#FFFFFF',
  },
}

// ============================================================================
// TYPES DE CLIENT
// ============================================================================

export const CLIENT_TYPES = [
  { value: 'ENTREPRISE', label: 'Entreprise' },
  { value: 'PARTICULIER', label: 'Particulier' },
] as const

// ============================================================================
// RÔLES UTILISATEUR
// ============================================================================

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  ARCHIVISTE: 'Archiviste',
  CONSULTANT: 'Consultant',
}

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#DC2626',
  ARCHIVISTE: '#2563EB',
  CONSULTANT: '#059669',
}

// ============================================================================
// STATUTS EXERCICE
// ============================================================================

export const STATUT_EXERCICE = [
  { value: 'ACTIF', label: 'Actif' },
  { value: 'ARCHIVE', label: 'Archivé' },
  { value: 'CLOTURE', label: 'Clôturé' },
] as const

// ============================================================================
// COULEURS ACS
// ============================================================================

export const ACS_COLORS = {
  primary: '#D32027',
  secondary: '#0066B3',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#3B82F6',
} as const

// ============================================================================
// PAGINATION
// ============================================================================

export const PAGINATION = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
} as const

// ============================================================================
// DATES
// ============================================================================

export const ANNEE_MIN_EXERCICE = 2020
