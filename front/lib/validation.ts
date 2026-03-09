/**
 * Fonctions de validation réutilisables pour les formulaires
 */

// ============================================================================
// VALIDATION EMAIL
// ============================================================================

/**
 * Valide un format d'email
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Valide et nettoie un email
 */
export function validateEmail(email: string): { isValid: boolean; cleaned?: string; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email requis' }
  }

  const trimmed = email.trim()

  if (!trimmed) {
    return { isValid: false, error: 'Email requis' }
  }

  if (!isValidEmail(trimmed)) {
    return { isValid: false, error: 'Format d\'email invalide' }
  }

  return { isValid: true, cleaned: trimmed.toLowerCase() }
}

// ============================================================================
// VALIDATION CHAÎNES
// ============================================================================

/**
 * Valide une longueur minimale
 */
export function validateMinLength(value: string, minLength: number, fieldName = 'Champ'): { isValid: boolean; error?: string } {
  if (!value || value.length < minLength) {
    return { isValid: false, error: `${fieldName} doit contenir au moins ${minLength} caractères` }
  }
  return { isValid: true }
}

/**
 * Valide une longueur maximale
 */
export function validateMaxLength(value: string, maxLength: number, fieldName = 'Champ'): { isValid: boolean; error?: string } {
  if (value && value.length > maxLength) {
    return { isValid: false, error: `${fieldName} ne peut pas dépasser ${maxLength} caractères` }
  }
  return { isValid: true }
}

/**
 * Valide qu'un champ n'est pas vide
 */
export function validateRequired(value: string | null | undefined, fieldName = 'Champ'): { isValid: boolean; error?: string } {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} est requis` }
  }
  return { isValid: true }
}

// ============================================================================
// VALIDATION NOMBRES
// ============================================================================

/**
 * Valide qu'une valeur est un nombre positif
 */
export function validatePositiveNumber(value: number | string, fieldName = 'Valeur'): { isValid: boolean; error?: string } {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num) || num <= 0) {
    return { isValid: false, error: `${fieldName} doit être un nombre positif` }
  }

  return { isValid: true }
}

/**
 * Valide une plage numérique
 */
export function validateNumberRange(
  value: number | string,
  min: number,
  max: number,
  fieldName = 'Valeur'
): { isValid: boolean; error?: string } {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} doit être un nombre` }
  }

  if (num < min || num > max) {
    return { isValid: false, error: `${fieldName} doit être entre ${min} et ${max}` }
  }

  return { isValid: true }
}

// ============================================================================
// VALIDATION SÉCURITÉ (XSS, INJECTION)
// ============================================================================

/**
 * Nettoie une chaîne de caractères des caractères dangereux
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return ''

  return input
    .replace(/[<>]/g, '') // Supprime < >
    .replace(/javascript:/gi, '') // Supprime javascript:
    .replace(/on\w+\s*=/gi, '') // Supprime les event handlers
    .trim()
}

/**
 * Valide qu'une chaîne ne contient pas de caractères dangereux
 */
export function validateSafeString(input: string, fieldName = 'Champ'): { isValid: boolean; cleaned?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: true, cleaned: '' }
  }

  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ]

  const hasDangerousContent = dangerousPatterns.some(pattern => pattern.test(input))

  if (hasDangerousContent) {
    return { isValid: false, error: `${fieldName} contient des caractères non autorisés` }
  }

  const cleaned = sanitizeString(input)
  return { isValid: true, cleaned }
}

// ============================================================================
// VALIDATION FICHIERS
// ============================================================================

/**
 * Types MIME autorisés pour les images
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
] as const

/**
 * Types MIME autorisés pour les documents (doit correspondre à la whitelist backend)
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
] as const

/**
 * Valide un type de fichier
 */
export function validateFileType(
  file: File,
  allowedTypes: readonly string[],
  fieldName = 'Fichier'
): { isValid: boolean; error?: string } {
  if (!file || !file.type) {
    return { isValid: false, error: `${fieldName} invalide` }
  }

  if (!allowedTypes.includes(file.type)) {
    const allowedExtensions = allowedTypes.map(type => type.split('/')[1]).join(', ')
    return { isValid: false, error: `${fieldName} doit être de type: ${allowedExtensions}` }
  }

  return { isValid: true }
}

/**
 * Valide la taille d'un fichier (en octets)
 */
export function validateFileSize(
  file: File,
  maxSizeBytes: number,
  fieldName = 'Fichier'
): { isValid: boolean; error?: string } {
  if (!file || !file.size) {
    return { isValid: false, error: `${fieldName} invalide` }
  }

  if (file.size > maxSizeBytes) {
    let maxSizeFormatted: string
    if (maxSizeBytes >= 1024 * 1024) {
      // Show in MB for large files
      maxSizeFormatted = `${(maxSizeBytes / (1024 * 1024)).toFixed(1)} MB`
    } else if (maxSizeBytes >= 1024) {
      // Show in KB for medium files
      maxSizeFormatted = `${(maxSizeBytes / 1024).toFixed(1)} KB`
    } else {
      // Show in bytes for small files
      maxSizeFormatted = `${maxSizeBytes} B`
    }
    return { isValid: false, error: `${fieldName} ne peut pas dépasser ${maxSizeFormatted}` }
  }

  return { isValid: true }
}

// ============================================================================
// VALIDATION FORMULAIRE COMPLÈTE
// ============================================================================

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  cleanedData?: Record<string, any>
}

/**
 * Valide un formulaire complet
 */
export function validateForm(
  data: Record<string, any>,
  rules: Record<string, Array<(value: any, fieldName: string) => { isValid: boolean; error?: string }>>
): ValidationResult {
  const errors: Record<string, string> = {}
  const cleanedData: Record<string, any> = {}

  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    const value = data[fieldName]

    for (const rule of fieldRules) {
      const result = rule(value, fieldName)

      if (!result.isValid) {
        errors[fieldName] = result.error || `${fieldName} invalide`
        break // Stop at first error for this field
      }
    }

    if (!errors[fieldName]) {
      cleanedData[fieldName] = value
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: Object.keys(cleanedData).length > 0 ? cleanedData : undefined
  }
}
