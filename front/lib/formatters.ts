/**
 * Fonctions de formatage réutilisables
 */

import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { RISQUE_LABELS, RISQUE_COLORS, COURRIER_LABELS } from '@/constants'

// ============================================================================
// FORMATAGE DES DATES
// ============================================================================

/**
 * Formate une date en format français court (ex: "15 déc. 2024")
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'd MMM yyyy', { locale: fr })
  } catch {
    return '—'
  }
}

/**
 * Formate une date en format français long (ex: "15 décembre 2024")
 */
export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'd MMMM yyyy', { locale: fr })
  } catch {
    return '—'
  }
}

/**
 * Formate une date en format ISO (ex: "2024-12-15")
 */
export function formatDateISO(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'yyyy-MM-dd')
  } catch {
    return '—'
  }
}

/**
 * Formate une date relative (ex: "il y a 2 heures")
 */
export function formatDateRelative(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return formatDistanceToNow(d, { addSuffix: true, locale: fr })
  } catch {
    return '—'
  }
}

/**
 * Formate une date relative courte (ex: "Il y a 2h")
 */
export function formatDateRelativeShort(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    
    if (diffMinutes < 1) return 'À l\'instant'
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`
    
    const diffHeures = Math.floor(diffMinutes / 60)
    if (diffHeures < 24) return `Il y a ${diffHeures} h`
    
    const diffJours = Math.floor(diffHeures / 24)
    if (diffJours < 30) return `Il y a ${diffJours} jour${diffJours > 1 ? 's' : ''}`
    
    return formatDateShort(d)
  } catch {
    return '—'
  }
}

// ============================================================================
// FORMATAGE DES TAILLES
// ============================================================================

/**
 * Formate une taille de fichier en octets vers une unité lisible
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || Number.isNaN(bytes)) return '—'
  
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

// ============================================================================
// FORMATAGE DES RISQUES
// ============================================================================

/**
 * Normalise une clé de risque (majuscules, underscores)
 */
export function normalizeRisqueKey(value: string | null | undefined): string {
  if (!value) return 'AUTRE'
  return value.toString().toUpperCase().replace(/[\s-]+/g, '_')
}

/**
 * Retourne le label d'un type de risque
 */
export function getRisqueLabel(type: string | null | undefined): string {
  if (!type) return 'Autre'
  const normalized = normalizeRisqueKey(type)
  return RISQUE_LABELS[normalized] || formatRisqueLabel(type)
}

/**
 * Formate un label de risque (capitalise chaque mot)
 */
export function formatRisqueLabel(value: string | null | undefined): string {
  if (!value) return 'Autre'
  const sanitized = value.toString().trim().replace(/[_\s]+/g, ' ')
  if (!sanitized) return 'Autre'
  return sanitized
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
}

/**
 * Retourne la couleur d'un type de risque
 */
export function getRisqueColor(type: string | null | undefined): string {
  if (!type) return RISQUE_COLORS.AUTRE
  const normalized = normalizeRisqueKey(type)
  return RISQUE_COLORS[normalized] || RISQUE_COLORS.AUTRE
}

// ============================================================================
// FORMATAGE DES COURRIERS
// ============================================================================

/**
 * Retourne le label d'un type de courrier
 */
export function getCourrierLabel(type: string | null | undefined): string {
  if (!type) return 'Autre'
  return COURRIER_LABELS[type as keyof typeof COURRIER_LABELS] || type
}

// ============================================================================
// FORMATAGE DES TEXTES
// ============================================================================

/**
 * Tronque un texte à une longueur maximale
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Capitalise la première lettre d'un texte
 */
export function capitalize(text: string): string {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Génère les initiales d'un nom complet
 */
export function getInitials(nom: string, prenom?: string): string {
  const n = nom?.charAt(0)?.toUpperCase() || ''
  const p = prenom?.charAt(0)?.toUpperCase() || ''
  return `${p}${n}`.trim() || '?'
}

// ============================================================================
// FORMATAGE DES NOMBRES
// ============================================================================

/**
 * Formate un nombre avec séparateurs de milliers
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

/**
 * Formate un pourcentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}
