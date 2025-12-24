/**
 * 🔒 Module de sécurité pour l'assistant
 * - Rate limiting
 * - Détection d'injection de prompt
 * - Validation des entrées
 * - Nettoyage des caches
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = Number(process.env.NEXT_PUBLIC_ASSISTANT_RATE_LIMIT ?? '12')
export const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
export const MAX_QUESTION_LENGTH = 2000
export const MIN_QUESTION_LENGTH = 2

// ============================================================================
// STORES (en mémoire)
// ============================================================================

export const rateLimitStore = new Map<string, number[]>()

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Extrait l'identifiant client depuis les headers de la requête (IP)
 * Note: x-forwarded-for peut être falsifié, donc on l'utilise en complément du userId
 */
export function extraireCleClient(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return `ip:${forwarded.split(',')[0].trim()}`
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return `ip:${realIp.trim()}`
  }
  return 'ip:local'
}

/**
 * Extrait l'identifiant utilisateur depuis le token (plus fiable que l'IP)
 */
export function extraireUserIdDepuisToken(token: string | null): string | null {
  if (!token) return null
  const cleaned = token.replace(/^Bearer\s+/i, '')
  // Extraire un hash stable du token pour identifier l'utilisateur
  // On utilise les 32 premiers caractères pour avoir une clé unique
  if (cleaned.length >= 16) {
    return `user:${cleaned.substring(0, 32)}`
  }
  return null
}

/**
 * Vérifie si la requête respecte le rate limit
 * Utilise à la fois l'IP ET le userId pour une protection robuste
 * @param request - La requête HTTP
 * @param userId - L'identifiant utilisateur (optionnel, extrait du token)
 */
export function verifierRateLimit(
  request: Request, 
  userId?: string | null
): { ok: boolean; remaining: number; blockedBy?: 'ip' | 'user' } {
  const now = Date.now()
  const ipKey = extraireCleClient(request)
  
  // Vérifier le rate limit par IP
  const ipTimestamps = rateLimitStore.get(ipKey)?.filter((time) => now - time < RATE_LIMIT_WINDOW_MS) ?? []
  
  if (ipTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(ipKey, ipTimestamps)
    return { ok: false, remaining: 0, blockedBy: 'ip' }
  }
  
  // Si on a un userId, vérifier aussi par utilisateur (protection contre IP spoofing)
  if (userId) {
    const userTimestamps = rateLimitStore.get(userId)?.filter((time) => now - time < RATE_LIMIT_WINDOW_MS) ?? []
    
    if (userTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      rateLimitStore.set(userId, userTimestamps)
      return { ok: false, remaining: 0, blockedBy: 'user' }
    }
    
    // Enregistrer pour l'utilisateur
    userTimestamps.push(now)
    rateLimitStore.set(userId, userTimestamps)
  }

  // Enregistrer pour l'IP
  ipTimestamps.push(now)
  rateLimitStore.set(ipKey, ipTimestamps)
  
  // Retourner le minimum des deux limites restantes
  const ipRemaining = RATE_LIMIT_MAX_REQUESTS - ipTimestamps.length
  const userRemaining = userId 
    ? RATE_LIMIT_MAX_REQUESTS - (rateLimitStore.get(userId)?.length ?? 0)
    : ipRemaining
  
  return { ok: true, remaining: Math.min(ipRemaining, userRemaining) }
}

// ============================================================================
// NETTOYAGE DES CACHES
// ============================================================================

let lastCacheCleanup = Date.now()

/**
 * Nettoie périodiquement les caches pour éviter les memory leaks
 * @param additionalCaches - Caches supplémentaires à nettoyer (avec expiresAt)
 */
export function cleanupCaches(
  additionalCaches?: Map<string, { expiresAt: number; [key: string]: unknown }>[]
): void {
  const now = Date.now()
  
  // Ne nettoyer que toutes les 5 minutes max
  if (now - lastCacheCleanup < CACHE_CLEANUP_INTERVAL_MS) return
  lastCacheCleanup = now
  
  // Nettoyer rateLimitStore (supprimer les entrées expirées)
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key)
    } else {
      rateLimitStore.set(key, validTimestamps)
    }
  }
  
  // Nettoyer les caches additionnels
  if (additionalCaches) {
    for (const cache of additionalCaches) {
      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt < now) {
          cache.delete(key)
        }
      }
    }
  }
  
  // Log si beaucoup d'entrées (pour monitoring)
  const totalEntries = rateLimitStore.size
  if (totalEntries > 1000) {
    console.warn(`[Assistant Security] Cache size warning: ${totalEntries} entries in rateLimitStore`)
  }
}

// ============================================================================
// DÉTECTION D'INJECTION DE PROMPT
// ============================================================================

export type SecurityFlags = { 
  promptInjectionSuspect?: boolean
  piiSuspect?: boolean 
}

export type SecurityAnalysis = {
  level: 'low' | 'medium' | 'high'
  flags: SecurityFlags
}

// Patterns d'injection de prompt - Version améliorée
// Couvre les variantes orthographiques, encodages et techniques courantes
const INJECTION_PATTERNS_HIGH = [
  // Tentatives directes de manipulation du système
  /ignore(?:r|z)?\s*(?:toutes?|all|les?)\s*(?:les?)?\s*instructions?/i,
  /ignore(?:r|z)?\s*(?:les?)?\s*consignes?\s*(?:precedentes?|anterieures?|systeme)/i,
  /oublie(?:r|z)?\s*(?:tout|tes|les|vos)\s*(?:instructions?|consignes?|regles?)/i,
  /(?:desactive|disable|bypass)\s*(?:la|les|tes|vos)?\s*(?:securite|security|filtres?|restrictions?)/i,
  
  // Tentatives de changement de rôle/identité
  /tu\s*es\s*maintenant\s*(?:un|une|le|la)/i,
  /(?:agis|comporte[- ]?toi|fais)\s*comme\s*(?:si\s*tu\s*etais|un|une)/i,
  /(?:nouveau|change|modifie)\s*(?:ton|ta|tes)?\s*(?:role|identite|personnalite)/i,
  /(?:pretend|imagine|suppose)\s*(?:que\s*tu\s*es|you\s*are)/i,
  
  // Tentatives d'accès au prompt système
  /(?:system|systeme)\s*prompt/i,
  /(?:montre|affiche|revele|donne)[- ]?(?:moi)?\s*(?:ton|le|ta|la)?\s*(?:prompt|instruction|consigne)/i,
  /(?:contenu|texte)\s*(?:du|de\s*ton|de\s*ta)?\s*prompt/i,
  /(?:quel(?:le)?s?\s*sont\s*tes|dis[- ]?moi\s*tes)\s*(?:instructions?|consignes?|regles?)/i,
  
  // Termes de jailbreak connus
  /jailbreak/i,
  /DAN\s*mode/i,
  /developer\s*mode/i,
  /(?:do\s*anything|faire\s*n'?importe\s*quoi)\s*(?:now|maintenant)/i,
  
  // Tentatives d'injection via délimiteurs
  /\]\s*\[\s*system/i,
  /<\/?system>/i,
  /```\s*system/i,
  /\{\{\s*system/i,
]

// Patterns de risque moyen (suspicieux mais pas forcément malveillants)
const INJECTION_PATTERNS_MEDIUM = [
  // Questions sur les capacités de contournement
  /(?:comment|peux[- ]tu)\s*(?:contourner|eviter|ignorer)/i,
  /(?:limites?|restrictions?)\s*(?:de\s*l'?|du)?\s*(?:assistant|ia|ai)/i,
  
  // Tentatives de manipulation émotionnelle
  /(?:si\s*tu\s*ne\s*(?:fais|dis)\s*pas|sinon\s*je)/i,
  /(?:tu\s*dois|il\s*faut\s*que\s*tu)\s*(?:absolument|obligatoirement)/i,
  
  // Encodages suspects (base64, hex, etc.)
  /(?:decode|decodez?|base64|hex(?:adecimal)?)\s*(?:ceci|this|ca)/i,
]

// Patterns de détection de PII (données personnelles)
const PII_PATTERNS = [
  /\b\d{13,16}\b/, // Numéros de carte bancaire
  /\b\d{3}[- ]?\d{3}[- ]?\d{3}[- ]?\d{3}\b/, // Numéro de sécu (format FR)
  /\b(?:mot\s*de\s*passe|password|mdp)\s*(?:est|:|\s)\s*\S+/i,
]

/**
 * Analyse le risque de sécurité d'une question
 * Détecte les tentatives d'injection de prompt et les données sensibles
 */
export function analyserRisqueQuestion(question: string): SecurityAnalysis {
  // Normalisation avancée : supprime accents, convertit en minuscules, 
  // et normalise les espaces multiples
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  const flags: SecurityFlags = {}
  let level: SecurityAnalysis['level'] = 'low'

  // Vérifier les patterns d'injection à haut risque
  if (INJECTION_PATTERNS_HIGH.some((re) => re.test(normalized))) {
    flags.promptInjectionSuspect = true
    level = 'high'
  }
  // Vérifier les patterns de risque moyen
  else if (INJECTION_PATTERNS_MEDIUM.some((re) => re.test(normalized))) {
    flags.promptInjectionSuspect = true
    level = 'medium'
  }

  // Vérifier les données personnelles sensibles
  if (PII_PATTERNS.some((re) => re.test(question))) {
    flags.piiSuspect = true
    // Élever le niveau si PII détecté
    if (level === 'low') level = 'medium'
  }

  return { level, flags }
}

// ============================================================================
// VALIDATION DES ENTRÉES
// ============================================================================

export type ValidationResult = {
  valid: boolean
  error?: string
}

/**
 * Valide une question utilisateur
 */
export function validerQuestion(question: string | undefined | null): ValidationResult {
  const trimmed = question?.trim()
  
  if (!trimmed) {
    return { valid: false, error: 'La question est requise' }
  }
  
  if (trimmed.length < MIN_QUESTION_LENGTH) {
    return { valid: false, error: 'La question est trop courte' }
  }
  
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return { valid: false, error: `La question est trop longue (max ${MAX_QUESTION_LENGTH} caractères)` }
  }
  
  return { valid: true }
}

// ============================================================================
// EXTRACTION DU TOKEN
// ============================================================================

/**
 * Extrait le token d'authentification depuis les cookies de la requête
 */
export function extraireTokenDepuisCookies(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) {
        acc[key] = decodeURIComponent(value)
      }
      return acc
    },
    {} as Record<string, string>,
  )

  const accessToken = cookies['access_token']
  if (accessToken) {
    return accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
  }

  return null
}

// ============================================================================
// GÉNÉRATION D'ID DE SESSION
// ============================================================================

/**
 * Génère un ID de session stable à partir du conversationId ou du token
 * Utilise conversationId pour isoler le contexte par discussion
 */
export function generateSessionId(token: string | null, conversationId?: string | null): string {
  // Si on a un conversationId, l'utiliser pour isoler le contexte
  if (conversationId) {
    return `conv-${conversationId}`
  }
  // Fallback sur le token pour les anciens clients
  if (!token) return 'anonymous'
  const cleaned = token.replace(/^Bearer\s+/i, '')
  return cleaned.substring(0, 16)
}
