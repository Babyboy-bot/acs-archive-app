/**
 * Module d'appels API backend pour l'assistant
 * Recherche de documents, statistiques, validation clients
 */

import type { DocumentPiece, Statistiques } from './types'
import { TYPE_DOCUMENT_KEYWORDS, extraireCriteresRecherche, loadValidClients } from './criteria'

// ============================================================================
// TYPES
// ============================================================================

export type DocumentSearchResult = {
  id: string
  titre: string
  reference?: string | null
  client?: string | null
  risque?: string | null
  creeLe?: string | null
}

export type AssistantSearchResult = {
  id: string
  titre: string
  content: string
  metadata: Record<string, unknown>
  score: number
  highlights?: string[] | null
}

export type DocumentDetail = {
  id: string
  titre: string
  description?: string | null
  type_courrier?: string | null
  categorie?: string | null
  categorie_nom?: string | null
  reference?: string | null
  date_document?: string | null
  date_archivage?: string | null
  est_archive?: boolean
  cree_le?: string | null
  fichier_url?: string | null
  risque_detail?: {
    exercice_info?: {
      client?: string | null
      annee?: number | null
    }
    type?: string | null
  }
}

export type FiltresRecherche = {
  client?: string | null
  exercice?: string | null
  risque?: string | null
  typeDocument?: string | null
}

type ClientLookup = {
  nom?: string
  numero_client?: string | null
}

type ClientValidationCacheEntry = { ok: boolean; expiresAt: number }

// ============================================================================
// CONSTANTES
// ============================================================================

const API_BASE_URL = process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://backend:8000/api'
const API_BASE = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`
export const DEFAULT_TOP_K = 15
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
export const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000
const USE_FAISS = process.env.NEXT_PUBLIC_ASSISTANT_USE_FAISS === 'true'
const BACKEND_FETCH_TIMEOUT_MS = Number(process.env.ASSISTANT_BACKEND_FETCH_TIMEOUT_MS ?? '12000')
const CLIENT_VALIDATION_TTL_MS = Number(process.env.ASSISTANT_CLIENT_VALIDATION_TTL_MS ?? '600000')

const clientValidationCache = new Map<string, ClientValidationCacheEntry>()

// ============================================================================
// ERREUR BACKEND
// ============================================================================

export class BackendError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// ============================================================================
// HTTP
// ============================================================================

export function buildBackendUrl(path: string): URL {
  return new URL(path, API_BASE)
}

export async function fetchJson<T>(url: URL, token: string | null): Promise<T> {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  if (token) {
    headers.set('Authorization', token)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new BackendError(`Timeout backend après ${BACKEND_FETCH_TIMEOUT_MS} ms`, 504)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const text = await response.text()
  
  if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
    console.error('Le backend a retourné du HTML au lieu de JSON:', text.substring(0, 200))
    throw new BackendError('Erreur interne du serveur Django', 500)
  }
  
  let data = null
  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch (error) {
    console.error('Erreur lors du parsing JSON:', error)
    console.error('Réponse brute:', text.substring(0, 500))
    throw new BackendError('Réponse invalide du serveur', 500)
  }

  if (!response.ok) {
    const detail = (data as { detail?: string; erreur?: string } | null)?.detail ?? (data as { erreur?: string } | null)?.erreur
    throw new BackendError(detail ?? `Erreur API (${response.status})`, response.status)
  }

  return data as T
}

// ============================================================================
// UTILITAIRES DE CONSTRUCTION DE DOCUMENTS
// ============================================================================

export function toTitle(value: string | null | undefined): string | null {
  if (!value) return null
  const formatted = value.replace(/_/g, ' ').toLowerCase()
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

export function construireMetadataDocument(doc: DocumentDetail, resultat?: DocumentSearchResult): Record<string, unknown> {
  const exercice = doc.risque_detail?.exercice_info?.annee
  const client = doc.risque_detail?.exercice_info?.client ?? resultat?.client ?? null
  const dateDocument = doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null
  const dateFormatee = formatDate(dateDocument)
  const type = doc.type_courrier ? toTitle(doc.type_courrier) : null

  return {
    titre: doc.titre,
    description: doc.description ?? null,
    type,
    client,
    exercice,
    reference: doc.reference ?? resultat?.reference ?? null,
    date_document: dateDocument,
    date_document_formatee: dateFormatee,
    statut_archive: doc.est_archive ?? null,
    derniere_mise_a_jour: doc.cree_le ?? null,
    fichier_url: doc.fichier_url ?? null,
  }
}

export function construireHighlights(metadata: Record<string, unknown>): string[] {
  const highlights: string[] = []
  const client = metadata.client as string | null
  const type = metadata.type as string | null
  const date = metadata.date_document_formatee as string | null

  if (client) {
    highlights.push(`Client : ${client}`)
  }
  if (type) {
    highlights.push(`Type : ${type}`)
  }
  if (date) {
    highlights.push(`Date : ${date}`)
  }
  const reference = metadata.reference as string | null
  if (reference) {
    highlights.push(`Référence : ${reference}`)
  }

  return highlights
}

export function construireContenuDocument(doc: DocumentDetail, resultat?: DocumentSearchResult): string {
  const lignes: string[] = []

  if (doc.description) {
    lignes.push(doc.description.trim())
  }

  const client = doc.risque_detail?.exercice_info?.client ?? resultat?.client
  if (client) {
    lignes.push(`Client : ${client}`)
  }

  if (doc.reference ?? resultat?.reference) {
    lignes.push(`Référence : ${doc.reference ?? resultat?.reference}`)
  }

  if (doc.type_courrier) {
    lignes.push(`Type de courrier : ${toTitle(doc.type_courrier)}`)
  }

  const date = formatDate(doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null)
  if (date) {
    lignes.push(`Date : ${date}`)
  }

  return lignes.join('\n') || 'Informations limitées sur ce document.'
}

export function tokenizeText(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/gi)
    .filter(Boolean)
}

// ============================================================================
// VALIDATION CLIENT
// ============================================================================

export async function verifierCodeClientBackend(code: string, token: string | null): Promise<boolean | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return false

  const cached = clientValidationCache.get(normalized)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.ok
  }

  let data: unknown
  try {
    const url = buildBackendUrl('clients/')
    url.searchParams.set('simple', '1')
    url.searchParams.set('search', normalized)
    data = await fetchJson<unknown>(url, token)
  } catch {
    return null
  }

  const results = Array.isArray(data)
    ? (data as ClientLookup[])
    : Array.isArray((data as any)?.results)
      ? ((data as any).results as ClientLookup[])
      : []

  const ok = results.some((client) => {
    const nom = (client?.nom ?? '').toString().trim().toUpperCase()
    const numero = (client?.numero_client ?? '').toString().trim().toUpperCase()
    return nom === normalized || numero === normalized
  })

  clientValidationCache.set(normalized, { ok, expiresAt: now + CLIENT_VALIDATION_TTL_MS })
  return ok
}

// ============================================================================
// JOURNALISATION LLM
// ============================================================================

export async function logLlmUsage(
  telemetry: {
    provider: string
    model: string
    tokensInput?: number
    tokensOutput?: number
    durationMs?: number
  },
  purpose: 'router' | 'answer' | 'summary',
  token: string | null
): Promise<void> {
  if (!token) return

  try {
    const url = buildBackendUrl('/api/assistant/llm/usage/')
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({
        provider: telemetry.provider,
        model: telemetry.model,
        purpose,
        tokens_input: telemetry.tokensInput ?? 0,
        tokens_output: telemetry.tokensOutput ?? 0,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    console.warn('Failed to log LLM usage:', error)
  }
}

// ============================================================================
// RECHERCHE DE DOCUMENTS
// ============================================================================

async function rechercherDocumentsSemantic(
  question: string,
  token: string | null,
  topK: number,
  filtres?: FiltresRecherche
): Promise<DocumentPiece[] | null> {
  const url = buildBackendUrl('assistant/documents/search/semantic/')
  url.searchParams.set('q', question)
  url.searchParams.set('top_k', String(topK))
  url.searchParams.set('include_fallback', 'true')
  
  if (filtres?.client) {
    url.searchParams.set('client', filtres.client)
  }
  if (filtres?.exercice) {
    url.searchParams.set('exercice', filtres.exercice)
  }
  if (filtres?.risque) {
    url.searchParams.set('risque', filtres.risque)
  }
  if (filtres?.typeDocument) {
    url.searchParams.set('type_document', filtres.typeDocument)
  }

  try {
    const data = await fetchJson<{ results?: AssistantSearchResult[]; method?: string }>(url, token)
    const results = data?.results ?? []
    const method = data?.method ?? 'unknown'
    
    
    if (!results.length) {
      return null
    }

    return results.map((result) => ({
      id: result.id,
      source: result.titre,
      content: result.content,
      metadata: {
        ...result.metadata,
        highlights: result.highlights ?? [],
        searchMethod: method,
      },
      score: result.score,
      isFallback: result.metadata?.isFallback === true,
    }))
  } catch (error) {
    console.warn('Recherche sémantique indisponible, fallback TF-IDF.', error)
    return null
  }
}

async function rechercherDocumentsFiltered(
  question: string,
  token: string | null,
  topK: number,
  filtres?: FiltresRecherche
): Promise<DocumentPiece[] | null> {
  const url = buildBackendUrl('assistant/documents/search/filtered/')
  if (question) {
    url.searchParams.set('q', question)
  }
  url.searchParams.set('top_k', String(topK))

  if (filtres?.client) {
    url.searchParams.set('client', filtres.client)
  }
  if (filtres?.exercice) {
    url.searchParams.set('exercice', filtres.exercice)
  }
  if (filtres?.risque) {
    url.searchParams.set('risque', filtres.risque)
  }
  if (filtres?.typeDocument) {
    url.searchParams.set('type_document', filtres.typeDocument)
  }

  try {
    const data = await fetchJson<{ results?: Array<{
      id: string
      titre: string
      reference: string
      type_courrier: string
      client: string
      exercice: string | number
      risque: string
      chemin_fichier: string
      fichier_url: string | null
    }>; method?: string }>(url, token)

    const results = data?.results ?? []

    if (!results.length) {
      return null
    }

    return results.map((doc) => ({
      id: doc.id,
      source: doc.titre,
      content: '',
      metadata: {
        client: doc.client,
        exercice: doc.exercice,
        risque: doc.risque,
        type_courrier: doc.type_courrier,
        reference: doc.reference,
        chemin_fichier: doc.chemin_fichier,
        fichier_url: doc.fichier_url,
        titre: doc.titre,
      },
      score: 1.0,
      isFallback: false,
    }))
  } catch (error) {
    console.warn('Recherche filtrée indisponible.', error)
    return null
  }
}

async function rechercherDocumentsFaiss(
  question: string,
  token: string | null,
  topK: number
): Promise<DocumentPiece[] | null> {
  const url = buildBackendUrl('assistant/documents/search/faiss/')
  url.searchParams.set('q', question)
  url.searchParams.set('top_k', String(topK))
  url.searchParams.set('include_fallback', 'true')

  try {
    const data = await fetchJson<{ results?: AssistantSearchResult[] }>(url, token)
    const results = data?.results ?? []
    if (!results.length) {
      return null
    }

    return results.map((result) => ({
      id: result.id,
      source: result.titre,
      content: result.content,
      metadata: {
        ...result.metadata,
        highlights: result.highlights ?? [],
      },
      score: result.score,
      isFallback: result.metadata?.isFallback === true,
    }))
  } catch (error) {
    console.warn('Assistant FAISS search unavailable, falling back to TF-IDF.', error)
    return null
  }
}

function prioriserPiecesParReference(pieces: DocumentPiece[], referenceDemandee: string | null): DocumentPiece[] {
  if (!referenceDemandee) {
    return pieces
  }

  const ref = referenceDemandee.toUpperCase()
  const exact: DocumentPiece[] = []
  const partial: DocumentPiece[] = []
  const autres: DocumentPiece[] = []

  for (const piece of pieces) {
    const refPiece = (piece.metadata?.reference as string | undefined)?.toUpperCase()
    if (!refPiece) {
      autres.push(piece)
      continue
    }
    if (refPiece === ref) {
      exact.push(piece)
    } else if (refPiece.includes(ref)) {
      partial.push(piece)
    } else {
      autres.push(piece)
    }
  }

  if (exact.length > 0) {
    return [...exact, ...partial, ...autres]
  }
  if (partial.length > 0) {
    return [...partial, ...autres]
  }
  return pieces
}

export function extraireClientMentionne(question: string): string | null {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!normalized) return null

  const motsIgnores = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'pour', 'et', 'ou', 'en', 'au', 'aux'])
  
  const motsReserves = new Set([
    'acs', 'pdf', 'doc', 'ref', 'type', 'date', 'cfa', 'eur', 'usd',
    'montre', 'affiche', 'ouvre', 'donne', 'envoie', 'voir', 'cherche', 'trouve',
    'telecharge', 'imprime', 'copie', 'partage', 'ouvrir', 'ferme',
    'moi', 'toi', 'lui', 'elle', 'nous', 'vous', 'eux', 'ici', 'cela', 'ceci',
    'document', 'fichier', 'piece', 'archive', 'dossier',
    'avenant', 'facture', 'contrat', 'sinistre', 'devis', 'quittance',
    'sante', 'auto', 'vie', 'flotte', 'rc', 'mrh',
  ])

  const patterns = [
    /(?:client)\s+(?:le\s+|la\s+)?([a-z0-9]{2,4})(?:\s|$|,|\.|\?)/i,
    /(?:avenants?|factures?|documents?|courriers?|contrats?)\s+(?:de|du|pour)\s+(?:le\s+|la\s+)?(?:client\s+)?([a-z0-9]{2,4})(?:\s|$|,|\.|\?)/i,
    /(?:avenants?|factures?|documents?|courriers?|contrats?)\s+([a-z0-9]{2,4})(?:\s|$|,|\.|\?)/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const candidat = match[1].toUpperCase()
      const candidatLower = candidat.toLowerCase()
      
      if (motsIgnores.has(candidatLower)) continue
      if (motsReserves.has(candidatLower)) continue
      if (/^(19|20)\d{2}$/.test(candidat)) continue
      
      return candidat
    }
  }

  return null
}

export async function rechercherDocuments(
  question: string, 
  token: string | null, 
  topK: number,
  filtres?: FiltresRecherche
): Promise<DocumentPiece[]> {
  if (!token) {
    throw new BackendError('Authentification requise pour interroger les documents.', 401)
  }

  await loadValidClients(token)

  const criteres = extraireCriteresRecherche(question)
  const referenceDemandee = criteres.reference

  let clientMentionne = extraireClientMentionne(question) || criteres.client
  if (referenceDemandee && clientMentionne) {
    if (/^N\d+$/i.test(clientMentionne)) {
      clientMentionne = null
    }
  }

  const anneeMentionnee = criteres.annee
  const risqueMentionne = criteres.risque
  const typeDocumentMentionne = criteres.typeDocument


  const filtresBackend: FiltresRecherche = {
    client: filtres?.client || clientMentionne || null,
    exercice: filtres?.exercice || anneeMentionnee || null,
    risque: filtres?.risque || risqueMentionne || null,
    typeDocument: typeDocumentMentionne || null,
  }

  if (filtresBackend.client || filtresBackend.exercice || filtresBackend.risque) {
  }

  let pieces: DocumentPiece[] = []

  // 0. PRIORITÉ ABSOLUE: Si une référence est demandée, recherche exacte par référence
  if (referenceDemandee) {
    try {
      const refUrl = buildBackendUrl('assistant/documents/search/by-reference/')
      refUrl.searchParams.set('reference', referenceDemandee)

      const data = await fetchJson<{ resultats?: Array<{
        id: string
        titre: string
        reference: string
        type_courrier: string
        client: string
        exercice: string | number
        risque: string
        chemin_fichier: string
        metadata: Record<string, unknown>
      }> }>(refUrl, token)

      const resultats = data?.resultats ?? []
      if (resultats.length > 0) {
        pieces = resultats.map((doc) => ({
          id: doc.id,
          source: doc.titre,
          content: '',
          metadata: {
            ...doc.metadata,
            client: doc.client,
            exercice: doc.exercice,
            risque: doc.risque,
            type_courrier: doc.type_courrier,
            reference: doc.reference,
            chemin_fichier: doc.chemin_fichier,
            fichier_url: doc.chemin_fichier ? `/media/${doc.chemin_fichier}` : null,
            titre: doc.titre,
          },
          score: 1.0,
          isFallback: false,
        }))
        return pieces
      }
      return []
    } catch (err) {
      return []
    }
  }

  // 1. Si des filtres sont présents, utiliser la recherche filtrée en priorité
  const hasSpecificFilters = filtresBackend.client || filtresBackend.exercice || filtresBackend.risque || filtresBackend.typeDocument
  if (hasSpecificFilters) {
    const filteredPieces = await rechercherDocumentsFiltered(question, token, topK * 3, filtresBackend)
    if (filteredPieces && filteredPieces.length > 0) {
      pieces = filteredPieces
    } else {
      const typeInfo = filtresBackend.typeDocument ? ` type="${filtresBackend.typeDocument}"` : ''
      return []
    }
  }
  
  // 2. Sinon, essayer la recherche sémantique
  if (!pieces.length && !filtresBackend.typeDocument) {
    const semanticPieces = await rechercherDocumentsSemantic(question, token, topK * 3, filtresBackend)
    if (semanticPieces && semanticPieces.length > 0) {
      pieces = semanticPieces
    }
  }

  // 3. Fallback sur FAISS
  if (!pieces.length && USE_FAISS && !filtresBackend.typeDocument) {
    const faissPieces = await rechercherDocumentsFaiss(question, token, topK * 3)
    if (faissPieces && faissPieces.length > 0) {
      pieces = faissPieces
    }
  }

  // 4. Fallback TF-IDF
  if (!pieces.length && !filtresBackend.typeDocument) {
    const searchUrl = buildBackendUrl('assistant/documents/search/tfidf/')
    searchUrl.searchParams.set('q', question)
    searchUrl.searchParams.set('top_k', String(topK * 3))

    const data = await fetchJson<{ results?: AssistantSearchResult[] }>(searchUrl, token)
    const results = data?.results ?? []

    if (!results.length) {
      const fallback = await recupererDocumentRecent(token)
      return fallback ? [fallback] : []
    }

    pieces = results.map((result) => ({
      id: result.id,
      source: result.titre,
      content: result.content,
      metadata: {
        ...result.metadata,
        highlights: result.highlights ?? [],
      },
      score: result.score,
      isFallback: result.metadata?.isFallback === true,
    }))
  }

  // Filtrer par client si un client spécifique est mentionné dans la question
  if (clientMentionne) {
    const piecesFiltrees = pieces.filter((piece) => {
      const clientPiece = (piece.metadata?.client as string)?.toUpperCase()
      return clientPiece === clientMentionne
    })

    if (piecesFiltrees.length > 0) {
      const ordonnees = prioriserPiecesParReference(piecesFiltrees, referenceDemandee)
      return ordonnees.slice(0, topK)
    } else {
      return []
    }
  }

  const ordonnees = prioriserPiecesParReference(pieces, referenceDemandee)
  return ordonnees.slice(0, topK)
}

// ============================================================================
// RÉCUPÉRATION DE DOCUMENTS
// ============================================================================

export async function recupererDocumentRecent(token: string | null): Promise<DocumentPiece | null> {
  if (!token) {
    throw new BackendError('Authentification requise pour consulter les documents.', 401)
  }

  const url = buildBackendUrl('documents/')
  url.searchParams.set('ordering', '-cree_le')
  url.searchParams.set('page_size', '1')

  const data = await fetchJson<any>(url, token)
  const results = Array.isArray(data) ? (data as DocumentDetail[]) : ((data?.results ?? []) as DocumentDetail[])
  const doc = results[0]
  if (!doc) {
    return null
  }

  const metadata = construireMetadataDocument(doc)
  const highlights = construireHighlights(metadata)

  return {
    id: doc.id,
    source: doc.titre,
    content: construireContenuDocument(doc),
    metadata: {
      ...metadata,
      highlights,
    },
    score: 0,
    isFallback: true,
  }
}

export async function recupererTousLesDocuments(token: string | null): Promise<DocumentDetail[]> {
  if (!token) {
    throw new BackendError('Authentification requise pour consulter les statistiques.', 401)
  }

  const documents: DocumentDetail[] = []
  let nextUrl: URL | null = buildBackendUrl('documents/')
  nextUrl.searchParams.set('ordering', '-cree_le')
  nextUrl.searchParams.set('page_size', '100')

  let pages = 0
  const maxPages = 5

  while (nextUrl && pages < maxPages) {
    const data = await fetchJson<any>(nextUrl, token)
    const results = Array.isArray(data) ? (data as DocumentDetail[]) : ((data?.results ?? []) as DocumentDetail[])
    documents.push(...results)
    const nextLink = data?.next as string | null | undefined
    nextUrl = nextLink ? new URL(nextLink, API_BASE) : null
    pages += 1
  }

  return documents
}

// ============================================================================
// STATISTIQUES
// ============================================================================

export function calculerStatistiques(documents: DocumentDetail[]): Statistiques {
  const mois = new Map<string, number>()
  const clients = new Map<string, number>()

  let documentsEnRetard = 0
  let alertesPeremption = 0
  const maintenant = Date.now()

  for (const doc of documents) {
    const dateSource = doc.date_document ?? doc.cree_le
    if (dateSource) {
      const date = new Date(dateSource)
      if (!Number.isNaN(date.getTime())) {
        const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        mois.set(cle, (mois.get(cle) ?? 0) + 1)

        if (!(doc.est_archive ?? false) && maintenant - date.getTime() > THIRTY_DAYS_MS) {
          documentsEnRetard += 1
        }

        if (maintenant - date.getTime() > FIVE_YEARS_MS) {
          alertesPeremption += 1
        }
      }
    }

    const client = doc.risque_detail?.exercice_info?.client ?? 'Client inconnu'
    clients.set(client, (clients.get(client) ?? 0) + 1)
  }

  const documents_par_mois = Array.from(mois.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .reduce<Record<string, number>>((acc, [cle, total]) => {
      acc[cle] = total
      return acc
    }, {})

  const top_clients = Array.from(clients.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([client, compte]) => ({ client, compte }))

  const total = documents.length
  const taux_conformite = total > 0 ? Math.max(0, Math.min(1, (total - documentsEnRetard) / total)) : 1

  return {
    documents_par_mois,
    top_clients,
    kpi: {
      taux_conformite,
      documents_en_retard: documentsEnRetard,
      alertes_peremption: alertesPeremption,
    },
  }
}

export async function collecterStatistiques(token: string | null): Promise<Statistiques> {
  if (!token) {
    throw new BackendError('Authentification requise pour consulter les statistiques.', 401)
  }

  try {
    const url = buildBackendUrl('assistant/stats/')
    const data = await fetchJson<any>(url, token)

    const statistiques: Statistiques = {
      documents_par_mois: (data?.documents_par_mois as Record<string, number>) ?? {},
      top_clients: (data?.top_clients as { client: string; compte: number }[]) ?? [],
      kpi: data?.kpi as Statistiques['kpi'],
      totaux_clients: data?.totaux_clients as Statistiques['totaux_clients'],
    }

    return statistiques
  } catch (error) {
    console.warn('assistant/stats indisponible, fallback sur calcul local', error)
    const documents = await recupererTousLesDocuments(token)
    if (!documents.length) {
      return {
        documents_par_mois: {},
        top_clients: [],
        kpi: {
          taux_conformite: 1,
          documents_en_retard: 0,
          alertes_peremption: 0,
        },
      }
    }

    return calculerStatistiques(documents)
  }
}
