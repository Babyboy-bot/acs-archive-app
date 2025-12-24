/**
 * 🔍 Module de recherche et filtrage de documents
 * - Filtrage multi-critères
 * - Vérification de pertinence
 * - Validation des clients contre la BDD
 */

import type { DocumentPiece } from './types'
import { 
  CriteresRecherche, 
  TYPE_DOCUMENT_KEYWORDS, 
  TYPES_RISQUES,
  extraireCriteresRecherche 
} from './criteria'

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api'
const API_BASE = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`
const CLIENT_VALIDATION_TTL_MS = Number(process.env.ASSISTANT_CLIENT_VALIDATION_TTL_MS ?? '600000')

// ============================================================================
// CACHES
// ============================================================================

type ClientValidationCacheEntry = { ok: boolean; expiresAt: number }
export const clientValidationCache = new Map<string, ClientValidationCacheEntry>()
export const clientsBatchCache = new Map<string, { valid: boolean; expiresAt: number }>()

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Construit une URL vers le backend
 */
export function buildBackendUrl(path: string): URL {
  const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`
  return new URL(path, base)
}

// ============================================================================
// VALIDATION DES CLIENTS
// ============================================================================

/**
 * Valide les codes clients contre la BDD en batch
 * Élimine les faux positifs comme "RENOUVELLEMENT"
 */
export async function validerClientsBatch(
  candidats: string[], 
  token: string | null
): Promise<string[]> {
  if (!candidats.length) return []
  
  const now = Date.now()
  const toValidate: string[] = []
  const alreadyValid: string[] = []
  
  // Vérifier le cache d'abord
  for (const c of candidats) {
    const cached = clientsBatchCache.get(c.toUpperCase())
    if (cached && cached.expiresAt > now) {
      if (cached.valid) alreadyValid.push(c.toUpperCase())
    } else {
      toValidate.push(c)
    }
  }
  
  if (!toValidate.length) return alreadyValid
  
  // Appeler le backend pour valider les candidats non cachés
  try {
    const url = buildBackendUrl('clients/validate-batch/')
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: token } : {}),
      },
      body: JSON.stringify({ codes: toValidate }),
    })
    
    if (!response.ok) {
      console.warn('Erreur validation batch clients:', response.status)
      return alreadyValid
    }
    
    const data = await response.json() as { valid: string[]; invalid: string[] }
    
    // Mettre en cache les résultats
    const expiresAt = now + CLIENT_VALIDATION_TTL_MS
    for (const v of data.valid || []) {
      clientsBatchCache.set(v.toUpperCase(), { valid: true, expiresAt })
    }
    for (const i of data.invalid || []) {
      clientsBatchCache.set(i.toUpperCase(), { valid: false, expiresAt })
    }
    
    return [...alreadyValid, ...(data.valid || [])]
  } catch (error) {
    console.error('Erreur lors de la validation batch des clients:', error)
    return alreadyValid
  }
}

// ============================================================================
// FILTRAGE MULTI-CRITÈRES
// ============================================================================

export type ResultatFiltrage = {
  pertinents: DocumentPiece[]
  nonPertinents: DocumentPiece[]
  tousNonPertinents: boolean
  criteresNonTrouves: string[]
  criteresUtilises: CriteresRecherche
}

/**
 * Vérifie si un document correspond à un critère spécifique
 */
export function documentCorrespondAuCritere(
  piece: DocumentPiece, 
  critere: string, 
  valeur: string
): boolean {
  const metadata = piece.metadata || {}
  const titre = (piece.source || '').toLowerCase()
  const contenu = (piece.content || '').toLowerCase()
  
  switch (critere) {
    case 'typeDocument': {
      const keywords = TYPE_DOCUMENT_KEYWORDS[valeur] ?? [valeur]
      const typeCourrier = ((metadata.type_courrier as string) || '').toLowerCase()
      const typeDoc = ((metadata.type as string) || '').toLowerCase()
      return keywords.some(kw => 
        titre.includes(kw) || contenu.includes(kw) || typeCourrier.includes(kw) || typeDoc.includes(kw)
      )
    }
    
    case 'client': {
      const clientDoc = ((metadata.client as string) || '').toUpperCase()
      return clientDoc === valeur.toUpperCase() || clientDoc.includes(valeur.toUpperCase())
    }
    
    case 'annee': {
      // L'exercice EST l'année de référence du document
      const exercice = String(metadata.exercice || '')
      const exerciceStr = exercice.trim()
      const matchExercice = exerciceStr === valeur || exerciceStr.includes(valeur)
      return matchExercice
    }
    
    case 'risque': {
      const risqueDoc = ((metadata.risque as string) || '').toLowerCase()
      const keywords = TYPES_RISQUES[valeur] ?? [valeur]
      return keywords.some(kw => risqueDoc.includes(kw) || titre.includes(kw) || contenu.includes(kw))
    }
    
    case 'typeCourrier': {
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const typeCourrier = normalize((metadata.type_courrier as string) || '')
      const typeDoc = normalize((metadata.type as string) || '')
      const critereNorm = normalize(valeur)
      return typeCourrier === critereNorm || typeDoc === critereNorm
    }
    
    case 'reference': {
      const ref = ((metadata.reference as string) || '').toUpperCase()
      return ref.includes(valeur) || titre.toUpperCase().includes(valeur) || contenu.toUpperCase().includes(valeur)
    }
    
    default:
      return true
  }
}

/**
 * Filtre les documents selon les critères extraits de la question
 */
export function filtrerParPertinence(
  pieces: DocumentPiece[], 
  question: string
): ResultatFiltrage {
  const criteres = extraireCriteresRecherche(question)
  
  // Si aucun critère spécifique, retourner tous les résultats
  const hasCriteres = Object.values(criteres).some(v => v !== null)
  if (!hasCriteres || pieces.length === 0) {
    return { 
      pertinents: pieces, 
      nonPertinents: [], 
      tousNonPertinents: false, 
      criteresNonTrouves: [],
      criteresUtilises: criteres
    }
  }
  
  const pertinents: DocumentPiece[] = []
  const nonPertinents: DocumentPiece[] = []
  const criteresNonTrouves: Set<string> = new Set()
  
  for (const piece of pieces) {
    let estPertinent = true
    
    // Vérifier chaque critère non-null
    for (const [critere, valeur] of Object.entries(criteres)) {
      if (valeur === null) continue
      
      if (!documentCorrespondAuCritere(piece, critere, valeur)) {
        estPertinent = false
        criteresNonTrouves.add(critere)
      }
    }
    
    if (estPertinent) {
      pertinents.push(piece)
    } else {
      nonPertinents.push(piece)
    }
  }
  
  return {
    pertinents,
    nonPertinents,
    tousNonPertinents: pertinents.length === 0 && nonPertinents.length > 0,
    criteresNonTrouves: [...criteresNonTrouves],
    criteresUtilises: criteres
  }
}

/**
 * Filtre les documents par type de document uniquement (compatibilité)
 */
export function verifierPertinenceResultats(
  pieces: DocumentPiece[], 
  typeDemande: string | null
): {
  pertinents: DocumentPiece[]
  nonPertinents: DocumentPiece[]
  tousNonPertinents: boolean
} {
  if (!typeDemande || pieces.length === 0) {
    return { pertinents: pieces, nonPertinents: [], tousNonPertinents: false }
  }

  const keywords = TYPE_DOCUMENT_KEYWORDS[typeDemande] ?? [typeDemande]
  
  const pertinents: DocumentPiece[] = []
  const nonPertinents: DocumentPiece[] = []
  
  for (const piece of pieces) {
    const titre = (piece.source || '').toLowerCase()
    const contenu = (piece.content || '').toLowerCase()
    const typeCourrier = ((piece.metadata?.type_courrier as string) || '').toLowerCase()
    
    const estPertinent = keywords.some(kw => 
      titre.includes(kw) || contenu.includes(kw) || typeCourrier.includes(kw)
    )
    
    if (estPertinent) {
      pertinents.push(piece)
    } else {
      nonPertinents.push(piece)
    }
  }
  
  return {
    pertinents,
    nonPertinents,
    tousNonPertinents: pertinents.length === 0 && nonPertinents.length > 0
  }
}

// ============================================================================
// RECHERCHE DE DOCUMENTS (appel backend)
// ============================================================================

/**
 * Recherche des documents via l'API backend
 */
export async function rechercherDocuments(
  query: string,
  token: string | null,
  topK: number = 30
): Promise<DocumentPiece[]> {
  try {
    const url = buildBackendUrl('assistant/search/')
    url.searchParams.set('q', query)
    url.searchParams.set('top_k', String(topK))
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: token } : {}),
      },
    })
    
    if (!response.ok) {
      console.error('Erreur recherche documents:', response.status)
      return []
    }
    
    const data = await response.json() as { resultats?: DocumentPiece[] }
    return data.resultats ?? []
  } catch (error) {
    console.error('Erreur lors de la recherche de documents:', error)
    return []
  }
}

// ============================================================================
// EXTRACTION DU CLIENT MENTIONNÉ
// ============================================================================

/**
 * Extrait le client mentionné dans une question (simple extraction)
 */
export function extraireClientMentionne(question: string): string | null {
  // Pattern simple: code client en majuscules (2-6 caractères)
  const match = question.match(/\b([A-Z0-9]{2,6})\b/)
  if (match) {
    const candidat = match[1]
    // Vérifier que ce n'est pas une année
    if (!/^(19|20)\d{2}$/.test(candidat)) {
      return candidat
    }
  }
  return null
}
