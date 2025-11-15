function extraireCleClient(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'local'
}

function verifierRateLimit(request: Request): { ok: boolean; remaining: number } {
  const key = extraireCleClient(request)
  const now = Date.now()
  const timestamps = rateLimitStore.get(key)?.filter((time) => now - time < RATE_LIMIT_WINDOW_MS) ?? []

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(key, timestamps)
    return { ok: false, remaining: 0 }
  }

  timestamps.push(now)
  rateLimitStore.set(key, timestamps)
  return { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS - timestamps.length }
}

import { NextResponse } from 'next/server'
import type { AssistantResponse, DocumentPiece, Statistiques } from './types'
import { RoleUtilisateur } from '@/types'
import { generateLlmAnswer, isLlmConfigured } from './llm'
import {
  incrementRequest,
  incrementLlmSuccess,
  incrementLlmFallback,
  incrementErrors,
  journaliserAssistant,
} from './telemetry'

type QueryPayload = {
  question?: string
  topK?: number
}

function construireInsightsDocuments(pieces: DocumentPiece[]): string[] {
  if (!pieces.length) {
    return []
  }

  const insights: string[] = []
  const clients = new Map<string, number>()
  const categories = new Map<string, number>()

  pieces.forEach((piece) => {
    const metadata = piece.metadata ?? {}
    const client = (metadata.client as string | undefined) ?? 'Client non renseigné'
    const categorie = (metadata.categorie as string | undefined) ?? 'Catégorie non renseignée'
    clients.set(client, (clients.get(client) ?? 0) + 1)
    categories.set(categorie, (categories.get(categorie) ?? 0) + 1)
  })

  if (clients.size) {
    const principal = [...clients.entries()].sort((a, b) => b[1] - a[1])[0]
    if (principal) {
      insights.push(`Client le plus représenté : ${principal[0]} (${principal[1]} document${principal[1] > 1 ? 's' : ''}).`)
    }
  }

  if (categories.size) {
    const categorie = [...categories.entries()].sort((a, b) => b[1] - a[1])[0]
    if (categorie) {
      insights.push(`Catégorie dominante : ${categorie[0]} (${categorie[1]} document${categorie[1] > 1 ? 's' : ''}).`)
    }
  }

  const total = pieces.length
  insights.push(`Nombre de pièces pertinentes identifiées : ${total}.`)

  return insights
}

function construireActionsDocuments(pieces: DocumentPiece[]): string[] {
  if (!pieces.length) {
    return []
  }

  const actions: string[] = []
  let docsSansDescription = 0
  let docsAnciennete = 0

  const maintenant = Date.now()

  pieces.forEach((piece) => {
    const metadata = piece.metadata ?? {}
    const description = metadata.description as string | null | undefined
    const dateDoc = metadata.date_document as string | null | undefined
    if (!description || description.trim().length < 20) {
      docsSansDescription += 1
    }
    if (dateDoc) {
      const parsed = Date.parse(dateDoc)
      if (!Number.isNaN(parsed) && maintenant - parsed > FIVE_YEARS_MS) {
        docsAnciennete += 1
      }
    }
  })

  if (docsSansDescription) {
    actions.push(`Compléter la description de ${docsSansDescription} document${docsSansDescription > 1 ? 's' : ''} pour faciliter la recherche.`)
  }

  if (docsAnciennete) {
    actions.push(`Revoir la conservation de ${docsAnciennete} document${docsAnciennete > 1 ? 's' : ''} âgé${docsAnciennete > 1 ? 's' : ''} de plus de 5 ans.`)
  }

  if (!actions.length) {
    actions.push('Aucune action urgente détectée sur les pièces proposées. Vérifier que leur indexation reste à jour.')
  }

  return actions
}

function construireNarrationHeuristique(
  intent: 'documents' | 'statistiques',
  resume: string,
  insights?: string[],
  actions?: string[]
): string {
  const lignes: string[] = []
  lignes.push(`Synthèse : ${resume}`)

  if (insights?.length) {
    lignes.push('\nPoints clés :')
    for (const insight of insights) {
      lignes.push(`- ${insight}`)
    }
  }

  if (actions?.length) {
    lignes.push('\nRecommandations :')
    for (const action of actions) {
      lignes.push(`- ${action}`)
    }
  }

  if (intent === 'documents' && (!insights?.length && !actions?.length)) {
    lignes.push('\nRecommandations :')
    lignes.push('- Vérifier la pertinence des documents suggérés avant diffusion.')
  }

  return lignes.join('\n')
}

type DocumentSearchResult = {
  id: string
  titre: string
  reference?: string | null
  client?: string | null
  risque?: string | null
  creeLe?: string | null
}

type DocumentDetail = {
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
  risque_detail?: {
    exercice_info?: {
      client?: string | null
      annee?: number | null
    }
    type?: string | null
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api'
const API_BASE = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`
const DEFAULT_TOP_K = 3
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000
const USE_FAISS = process.env.NEXT_PUBLIC_ASSISTANT_USE_FAISS === 'true'
const ASSISTANT_ENABLED = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? 'true').toLowerCase() !== 'false'
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.NEXT_PUBLIC_ASSISTANT_RATE_LIMIT ?? '12')

const rateLimitStore = new Map<string, number[]>()

const ROLES_AUTORISES_DOCUMENTS = new Set<RoleUtilisateur>([
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.ARCHIVISTE,
  RoleUtilisateur.CONSULTANT,
])
const ROLES_AUTORISES_STATISTIQUES = new Set<RoleUtilisateur>([
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.ARCHIVISTE,
])

function extraireRole(request: Request): RoleUtilisateur | null {
  const header = request.headers.get('x-user-role')?.trim().toUpperCase()
  if (!header) {
    return null
  }
  if (header === 'ADMIN' || header === 'ARCHIVISTE' || header === 'CONSULTANT') {
    return header as RoleUtilisateur
  }
  return null
}

function construireReponseRestreinte(
  question: string,
  intent: 'documents' | 'statistiques',
  role: RoleUtilisateur | null
): NextResponse<AssistantResponse> {
  const message =
    "Je suis désolé, mais vous ne disposez pas des droits nécessaires pour accéder à cette information. Merci de contacter un administrateur pour obtenir l'autorisation." as const

  const réponse: AssistantResponse = {
    question,
    type: intent,
    resume: message,
    pieces: intent === 'documents' ? [] : undefined,
    statistiques: intent === 'statistiques' ? undefined : undefined,
    insights: [],
    actions: [],
    narration: {
      texte: message,
      source: 'heuristique',
    },
    restriction: {
      reason: 'PERMISSION_DENIED',
      role,
    },
  }

  journaliserAssistant({
    type: 'response',
    intent,
    durationMs: 0,
    llmUsed: false,
  })

  return NextResponse.json(réponse)
}

class BackendError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function detectIntent(question: string): 'documents' | 'statistiques' {
  const lower = question.toLowerCase()
  const statsKeywords = ['combien', 'nombre', 'statistique', 'statistiques', 'kpi', 'taux', 'top', 'retard', 'alerte', 'volume']
  if (statsKeywords.some((keyword) => lower.includes(keyword))) {
    return 'statistiques'
  }
  return 'documents'
}

function buildBackendUrl(path: string): URL {
  return new URL(path, API_BASE)
}

async function fetchJson<T>(url: URL, token: string | null): Promise<T> {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  if (token) {
    headers.set('Authorization', token)
  }

  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })

  const text = await response.text()
  const data = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    const detail = (data as { detail?: string; erreur?: string } | null)?.detail ?? (data as { erreur?: string } | null)?.erreur
    throw new BackendError(detail ?? `Erreur API (${response.status})`, response.status)
  }

  return data as T
}

function toTitle(value: string | null | undefined): string | null {
  if (!value) return null
  const formatted = value.replace(/_/g, ' ').toLowerCase()
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

function construireMetadataDocument(doc: DocumentDetail, resultat?: DocumentSearchResult): Record<string, unknown> {
  const exercice = doc.risque_detail?.exercice_info?.annee
  const client = doc.risque_detail?.exercice_info?.client ?? resultat?.client ?? null
  const dateDocument = doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null
  const dateFormatee = formatDate(dateDocument)
  const type = doc.type_courrier ? toTitle(doc.type_courrier) : null
  const categorie = doc.categorie_nom ?? doc.categorie ?? null

  return {
    titre: doc.titre,
    description: doc.description ?? null,
    type,
    categorie,
    client,
    exercice,
    reference: doc.reference ?? resultat?.reference ?? null,
    date_document: dateDocument,
    date_document_formatee: dateFormatee,
    statut_archive: doc.est_archive ?? null,
    derniere_mise_a_jour: doc.cree_le ?? null,
  }
}

function construireHighlights(metadata: Record<string, unknown>): string[] {
  const highlights: string[] = []
  const client = metadata.client as string | null
  const categorie = metadata.categorie as string | null
  const type = metadata.type as string | null
  const date = metadata.date_document_formatee as string | null

  if (client) {
    highlights.push(`Client : ${client}`)
  }
  if (categorie) {
    highlights.push(`Catégorie : ${categorie}`)
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

function construireContenuDocument(doc: DocumentDetail, resultat?: DocumentSearchResult): string {
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

  if (doc.categorie_nom ?? doc.categorie) {
    lignes.push(`Catégorie : ${doc.categorie_nom ?? doc.categorie}`)
  }

  const date = formatDate(doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null)
  if (date) {
    lignes.push(`Date : ${date}`)
  }

  return lignes.join('\n') || 'Informations limitées sur ce document.'
}

function tokenizeText(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/gi)
    .filter(Boolean)
}

function buildDocumentTokens(doc: DocumentDetail, metadata: Record<string, unknown>): string[] {
  const segments: Array<{ value: string | null | undefined; weight: number }> = [
    { value: doc.titre, weight: 3 },
    { value: doc.description, weight: 2 },
    { value: metadata.client as string | null, weight: 2 },
    { value: metadata.categorie as string | null, weight: 2 },
    { value: metadata.type as string | null, weight: 2 },
    { value: metadata.reference as string | null, weight: 2 },
    { value: doc.risque_detail?.type, weight: 1 },
  ]

  const tokens: string[] = []
  for (const segment of segments) {
    if (!segment.value) continue
    const baseTokens = tokenizeText(String(segment.value))
    if (!baseTokens.length) continue
    for (let i = 0; i < segment.weight; i += 1) {
      tokens.push(...baseTokens)
    }
  }

  return tokens.length ? tokens : tokenizeText(doc.titre ?? '')
}

function compterFrequences(tokens: string[]): Map<string, number> {
  const frequences = new Map<string, number>()
  for (const token of tokens) {
    const courant = frequences.get(token) ?? 0
    frequences.set(token, courant + 1)
  }
  return frequences
}

function calculerScoreBM25(
  questionTokens: string[],
  termFreq: Map<string, number>,
  docLength: number,
  avgDocLength: number,
  df: Map<string, number>,
  docCount: number
): number {
  if (!questionTokens.length) {
    return 0
  }

  const k1 = 1.5
  const b = 0.75
  const longueur = docLength || 1
  const longueurMoyenne = avgDocLength || 1

  let score = 0
  for (const token of questionTokens) {
    const freq = termFreq.get(token) ?? 0
    if (freq === 0) {
      continue
    }

    const docFreq = df.get(token) ?? 0
    const idf = Math.log(1 + (docCount - docFreq + 0.5) / (docFreq + 0.5))
    const numerator = freq * (k1 + 1)
    const denominator = freq + k1 * (1 - b + (b * longueur) / longueurMoyenne)
    score += idf * (numerator / denominator)
  }

  return Number.isFinite(score) ? score : 0
}

async function recupererDocumentRecent(token: string | null): Promise<DocumentPiece | null> {
  if (!token) {
    return null
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
    score: 0.1,
    isFallback: true,
  }
}

type AssistantSearchResult = {
  id: string
  titre: string
  score: number
  metadata: Record<string, unknown>
  highlights?: string[]
  content: string
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

async function rechercherDocuments(question: string, token: string | null, topK: number): Promise<DocumentPiece[]> {
  if (!token) {
    throw new BackendError('Authentification requise pour interroger les documents.', 401)
  }

  if (USE_FAISS) {
    const faissPieces = await rechercherDocumentsFaiss(question, token, topK)
    if (faissPieces && faissPieces.length > 0) {
      return faissPieces
    }
  }

  const searchUrl = buildBackendUrl('assistant/documents/search/tfidf/')
  searchUrl.searchParams.set('q', question)
  searchUrl.searchParams.set('top_k', String(topK))

  const data = await fetchJson<{ results?: AssistantSearchResult[] }>(searchUrl, token)
  const results = data?.results ?? []

  if (!results.length) {
    const fallback = await recupererDocumentRecent(token)
    return fallback ? [fallback] : []
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
}

function construireResumeDocuments(_question: string, pieces: DocumentPiece[]): string {
  if (!pieces || pieces.length === 0) {
    return "Aucun document pertinent n'a été trouvé pour cette question."
  }

  const premiere = pieces[0]
  const metadata = premiere.metadata ?? {}
  const morceaux: string[] = []

  const type = metadata.type as string | null
  if (type) {
    morceaux.push(`type ${type.toLowerCase()}`)
  }

  const categorie = metadata.categorie as string | null
  if (categorie) {
    morceaux.push(`catégorie ${categorie.toLowerCase()}`)
  }

  const client = metadata.client as string | null
  if (client) {
    morceaux.push(`client ${client}`)
  }

  const prefixe = morceaux.length ? `Document identifié (${morceaux.join(', ')}).` : 'Document identifié.'
  const description = premiere.content.split('\n')[0]
  return description ? `${prefixe} ${description}` : prefixe
}

async function recupererTousLesDocuments(token: string | null): Promise<DocumentDetail[]> {
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

function calculerStatistiques(documents: DocumentDetail[]): Statistiques {
  const mois = new Map<string, number>()
  const categories = new Map<string, number>()
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

    const categorie = doc.categorie_nom ?? doc.categorie ?? 'Non catégorisé'
    categories.set(categorie, (categories.get(categorie) ?? 0) + 1)

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

  const top_categories = Array.from(categories.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([categorie, compte]) => ({ categorie, compte }))

  const top_clients = Array.from(clients.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([client, compte]) => ({ client, compte }))

  const total = documents.length
  const taux_conformite = total > 0 ? Math.max(0, Math.min(1, (total - documentsEnRetard) / total)) : 1

  return {
    documents_par_mois,
    top_categories,
    top_clients,
    kpi: {
      taux_conformite,
      documents_en_retard: documentsEnRetard,
      alertes_peremption: alertesPeremption,
    },
  }
}

async function collecterStatistiques(token: string | null): Promise<Statistiques> {
  const documents = await recupererTousLesDocuments(token)
  if (!documents.length) {
    return {
      documents_par_mois: {},
      top_categories: [],
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

function construireResumeStatistiques(statistiques: Statistiques): string {
  const lignes: string[] = []
  if (statistiques.kpi) {
    lignes.push(
      `Taux de conformité : ${(statistiques.kpi.taux_conformite * 100).toFixed(1)} %. Documents en retard : ${statistiques.kpi.documents_en_retard}. Alertes de péremption : ${statistiques.kpi.alertes_peremption}.`
    )
  }

  if (statistiques.top_clients?.length) {
    const topClients = statistiques.top_clients
      .slice(0, 3)
      .map((client) => `${client.client} (${client.compte})`)
      .join(', ')
    lignes.push(`TOP clients par volume d'archives : ${topClients}.`)
  }

  if (statistiques.top_categories?.length) {
    const topCategories = statistiques.top_categories
      .slice(0, 3)
      .map((categorie) => `${categorie.categorie} (${categorie.compte})`)
      .join(', ')
    lignes.push(`Catégories principales : ${topCategories}.`)
  }

  if (!lignes.length) {
    return 'Aucune statistique exploitable pour le moment.'
  }

  return lignes.join(' ')
}

function construireInsightsStatistiques(statistiques: Statistiques): string[] {
  const insights: string[] = []

  if (statistiques.top_clients?.length) {
    const premiers = statistiques.top_clients
      .slice(0, 3)
      .map((client) => `${client.client} (${client.compte})`)
      .join(', ')
    insights.push(`Top clients : ${premiers}.`)
  }

  if (statistiques.top_categories?.length) {
    const categories = statistiques.top_categories
      .slice(0, 3)
      .map((categorie) => `${categorie.categorie} (${categorie.compte})`)
      .join(', ')
    insights.push(`Catégories les plus actives : ${categories}.`)
  }

  const evolution = Object.entries(statistiques.documents_par_mois ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
  if (evolution.length >= 2) {
    const [prevKey, prevValue] = evolution[evolution.length - 2]
    const [lastKey, lastValue] = evolution[evolution.length - 1]
    if (prevValue && lastValue) {
      const delta = ((lastValue - prevValue) / prevValue) * 100
      insights.push(`Variation du volume entre ${prevKey} et ${lastKey} : ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} %.`)
    }
  }

  return insights
}

function construireActionsStatistiques(statistiques: Statistiques): string[] {
  const actions: string[] = []

  const kpi = statistiques.kpi
  if (kpi) {
    if (kpi.taux_conformite < 0.9) {
      actions.push('Prioriser la réduction des documents en retard pour améliorer le taux de conformité.')
    } else {
      actions.push('Maintenir la surveillance : le taux de conformité reste satisfaisant.')
    }

    if (kpi.alertes_peremption > 0) {
      actions.push(`Planifier une revue des ${kpi.alertes_peremption} document${kpi.alertes_peremption > 1 ? 's' : ''} proche${kpi.alertes_peremption > 1 ? 's' : ''} de la péremption.`)
    }
  }

  if (!actions.length) {
    actions.push('Aucune action prioritaire détectée. Continuer le suivi régulier des indicateurs.')
  }

  return actions
}

export async function POST(request: Request) {
  let payload: QueryPayload
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ erreur: 'Corps de requête invalide' }, { status: 400 })
  }

  const question = payload.question?.trim()
  if (!question) {
    return NextResponse.json({ erreur: 'La question est requise' }, { status: 400 })
  }

  const authorization = request.headers.get('authorization')
  const token = authorization?.trim() ? authorization : null

  try {
    if (!ASSISTANT_ENABLED) {
      return NextResponse.json({ erreur: "Assistant désactivé" }, { status: 503 })
    }

    const rateLimit = verifierRateLimit(request)
    if (!rateLimit.ok) {
      return NextResponse.json({ erreur: 'Trop de requêtes, réessayez dans quelques instants.' }, { status: 429 })
    }

    const intent = detectIntent(question)
    const role = extraireRole(request)
    if (!role) {
      return NextResponse.json({ erreur: 'Rôle utilisateur manquant ou invalide.' }, { status: 401 })
    }
    incrementRequest(intent)

    const startedAt = Date.now()
    journaliserAssistant({
      type: 'request',
      intent,
      questionLength: question.length,
    })

    if (intent === 'statistiques') {
      if (!ROLES_AUTORISES_STATISTIQUES.has(role)) {
        return construireReponseRestreinte(question, intent, role)
      }
      const statistiques = await collecterStatistiques(token)
      const resume = construireResumeStatistiques(statistiques)
      const insights = construireInsightsStatistiques(statistiques)
      const actions = construireActionsStatistiques(statistiques)
      let narration: AssistantResponse['narration'] | undefined

      if (isLlmConfigured()) {
        try {
          const { content, telemetry } = await generateLlmAnswer({
            question,
            intent,
            statistiques,
          })
          narration = {
            texte: content,
            source: 'llm',
            telemetry,
          }
          incrementLlmSuccess()
        } catch (llmError) {
          console.warn('Assistant LLM (statistiques) indisponible, fallback heuristique.', llmError)
          incrementLlmFallback()
        }
      }

      if (!narration) {
        narration = {
          texte: construireNarrationHeuristique(intent, resume, insights, actions),
          source: 'heuristique',
        }
      }

      const réponse: AssistantResponse = {
        question,
        type: 'statistiques',
        resume,
        statistiques,
        insights,
        actions,
        narration,
      }
      journaliserAssistant({
        type: 'response',
        intent,
        durationMs: Date.now() - startedAt,
        llmUsed: narration.source === 'llm',
      })
      return NextResponse.json(réponse)
    }

    if (!ROLES_AUTORISES_DOCUMENTS.has(role)) {
      return construireReponseRestreinte(question, intent, role)
    }

    const pieces = await rechercherDocuments(question, token, payload.topK ?? DEFAULT_TOP_K)
    const resume = construireResumeDocuments(question, pieces)
    const insights = construireInsightsDocuments(pieces)
    const actions = construireActionsDocuments(pieces)
    let narration: AssistantResponse['narration'] | undefined

    if (isLlmConfigured()) {
      try {
        const { content, telemetry } = await generateLlmAnswer({
          question,
          intent,
          pieces,
        })
        narration = {
          texte: content,
          source: 'llm',
          telemetry,
        }
        incrementLlmSuccess()
      } catch (llmError) {
        console.warn('Assistant LLM (documents) indisponible, fallback heuristique.', llmError)
        incrementLlmFallback()
      }
    }

    if (!narration) {
      narration = {
        texte: construireNarrationHeuristique(intent, resume, insights, actions),
        source: 'heuristique',
      }
    }

    const réponse: AssistantResponse = {
      question,
      type: 'documents',
      resume,
      pieces,
      insights,
      actions,
      narration,
    }

    console.info('assistant-demo', {
      intent,
      questionLongueur: question.length,
      pieces: pieces.length,
      statistiques: false,
      llm: narration?.source === 'llm',
    })

    journaliserAssistant({
      type: 'response',
      intent,
      durationMs: Date.now() - startedAt,
      pieces: pieces.length,
      llmUsed: narration.source === 'llm',
    })

    return NextResponse.json(réponse)
  } catch (error) {
    incrementErrors()
    console.error('Erreur assistant-demo', error)
    if (error instanceof BackendError) {
      journaliserAssistant({
        type: 'error',
        intent: undefined,
        durationMs: 0,
        message: error.message,
        status: error.status,
      })
      return NextResponse.json({ erreur: error.message }, { status: error.status })
    }
    journaliserAssistant({
      type: 'error',
      intent: undefined,
      durationMs: 0,
      message: (error as Error)?.message ?? 'Erreur interne',
    })
    return NextResponse.json({ erreur: "Erreur interne de l'assistant" }, { status: 500 })
  }
}
