/*
 * Utilitaires d'intégration LLM pour l'assistant IA.
 * L'objectif est de centraliser la configuration, la construction du prompt
 * et l'appel réseau afin de sécuriser l'intégration d'un modèle de langage.
 */

import type { DocumentPiece } from './types'
import { setDefaultResultOrder } from 'dns'
import { enrichPromptWithLearning } from './learning'
import {
  getConversationHistoryPersistent,
  addMessagePersistent,
  clearLocalCache,
  getStructuredMemory,
  structuredMemoryToPrompt,
  updateMemoryAfterExchange,
  detectSubjectTransition,
  applySubjectTransition,
  setStructuredMemory,
  logSubjectTransition,
  detectUserCorrection,
  getTelemetryStats,
  isDocumentFollowUpQuestion,
  buildDocumentActivePrompt,
  extractDocumentIndex,
  getDocumentFromSelection,
  isContextExpired,
  getValidContextEntity,
  updateEntityProtected,
  CONFIDENCE_THRESHOLD,
  CONTEXT_EXPIRATION_MS,
  type StructuredMemory,
  type SubjectAnalysis,
  type SubjectTelemetry,
  type ContextSnapshot,
  type DocumentSelection,
} from './conversation'

// Réexporter pour utilisation dans route.ts
export { 
  updateMemoryAfterExchange, 
  getStructuredMemory, 
  detectSubjectTransition, 
  applySubjectTransition,
  setStructuredMemory,
  logSubjectTransition,
  detectUserCorrection,
  getTelemetryStats,
  isDocumentFollowUpQuestion,
  buildDocumentActivePrompt,
  extractDocumentIndex,
  getDocumentFromSelection,
  isContextExpired,
  getValidContextEntity,
  updateEntityProtected,
  CONFIDENCE_THRESHOLD,
  CONTEXT_EXPIRATION_MS,
  type StructuredMemory,
  type SubjectAnalysis,
  type SubjectTelemetry,
  type ContextSnapshot,
  type DocumentSelection,
}

try {
  setDefaultResultOrder('ipv4first')
} catch {
  // noop
}

const PROVIDER = 'mistral'

// Configuration générique type OpenAI-compatible (OpenAI ou proxy compatible)
const API_KEY = process.env.ASSISTANT_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
const BASE_URL = process.env.ASSISTANT_LLM_BASE_URL ?? 'https://api.openai.com/v1'
const MODEL = process.env.ASSISTANT_LLM_MODEL ?? 'gpt-4o-mini'

// Configuration pour Claude (Anthropic)
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''
const CLAUDE_BASE_URL = process.env.CLAUDE_BASE_URL ?? 'https://api.anthropic.com/v1'
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022'
const LLM_ENABLED = (process.env.ASSISTANT_LLM_ENABLED ?? 'true').toLowerCase() !== 'false'

// Timeout global (en millisecondes) pour les appels LLM afin d'éviter les requêtes qui pendent
const MIN_LLM_TIMEOUT_MS = 5000
const MAX_LLM_TIMEOUT_MS = 20000

function clampTimeout(raw: string | number | undefined, fallback: number, min = MIN_LLM_TIMEOUT_MS, max = MAX_LLM_TIMEOUT_MS) {
  const parsed = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : fallback
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

const LLM_TIMEOUT_MS = clampTimeout(process.env.ASSISTANT_LLM_TIMEOUT_MS, 20000)

// Configuration pour la stratégie multi-modèles Mistral
const MISTRAL_BASE_URL = (process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1').trim()
const MISTRAL_API_KEY = (process.env.MISTRAL_API_KEY ?? '').trim()
// Modèle par défaut plus puissant pour de meilleures réponses
const MISTRAL_MODEL_DEFAULT = (process.env.MISTRAL_MODEL_DEFAULT ?? 'mistral-medium-latest').trim()
const MISTRAL_MODEL_ADVANCED = (process.env.MISTRAL_MODEL_ADVANCED ?? 'mistral-large-latest').trim()
const MISTRAL_ENABLED = (process.env.MISTRAL_ENABLED ?? 'false').toLowerCase() === 'true'

const MISTRAL_RETRY_MAX = Number(process.env.MISTRAL_RETRY_MAX ?? '2')
const MISTRAL_RETRY_BASE_DELAY_MS = Number(process.env.MISTRAL_RETRY_BASE_DELAY_MS ?? '400')
const MISTRAL_CIRCUIT_FAILURE_THRESHOLD = Number(process.env.MISTRAL_CIRCUIT_FAILURE_THRESHOLD ?? '3')
const MISTRAL_CIRCUIT_OPEN_MS = Number(process.env.MISTRAL_CIRCUIT_OPEN_MS ?? '15000')
const MISTRAL_TOTAL_BUDGET_MS = clampTimeout(process.env.MISTRAL_TOTAL_BUDGET_MS, LLM_TIMEOUT_MS, MIN_LLM_TIMEOUT_MS, LLM_TIMEOUT_MS)
const MISTRAL_ATTEMPT_TIMEOUT_MS = clampTimeout(
  process.env.MISTRAL_ATTEMPT_TIMEOUT_MS,
  Math.min(8000, Math.floor(MISTRAL_TOTAL_BUDGET_MS * 0.6)),
  MIN_LLM_TIMEOUT_MS / 2,
  MISTRAL_TOTAL_BUDGET_MS,
)
const MISTRAL_FORCE_CONNECTION_CLOSE = (process.env.MISTRAL_FORCE_CONNECTION_CLOSE ?? 'true').toLowerCase() === 'true'

// Seuil de complexité pour utiliser le modèle avancé (abaissé pour utiliser plus souvent le modèle puissant)
const COMPLEXITY_THRESHOLD = Number(process.env.COMPLEXITY_THRESHOLD ?? '80')

const MAX_TOKENS_DOCUMENTS_FACTUAL = Number(process.env.ASSISTANT_LLM_MAX_TOKENS_DOCUMENTS ?? '160')
const MAX_TOKENS_STATISTIQUES = Number(process.env.ASSISTANT_LLM_MAX_TOKENS_STATISTIQUES ?? '200')
const MAX_TOKENS_DEFAULT = Number(process.env.ASSISTANT_LLM_MAX_TOKENS_DEFAULT ?? '250')

const HISTORY_LIMIT_FACTUAL = Number(process.env.ASSISTANT_LLM_HISTORY_LIMIT_FACTUAL ?? '0')
const HISTORY_LIMIT_DEFAULT = Number(process.env.ASSISTANT_LLM_HISTORY_LIMIT_DEFAULT ?? '8')

const mistralCircuitState = {
  consecutiveFailures: 0,
  openUntilMs: 0,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableMistralNetworkError(error: any): boolean {
  const cause = error?.cause
  const code = (cause && typeof cause === 'object' ? (cause as any).code : undefined) as string | undefined
  const msg = String(error?.message ?? '')

  if (code && ['UND_ERR_SOCKET', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN'].includes(code)) {
    return true
  }

  if (/fetch failed/i.test(msg)) return true
  return false
}

// Mémoire de conversation (stockage en mémoire pour la session)
type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export async function generateLlmConversationSummary(payload: {
  previousSummary: string
  lastUserMessage: string
  lastAssistantMessage: string
}): Promise<{ summary: string; telemetry?: LlmTelemetry }> {
  if (!isLlmConfigured()) {
    return { summary: payload.previousSummary }
  }

  const summarySystemPrompt = `Tu es chargé de résumer une conversation entre un utilisateur et l'assistant ACS.
Ton objectif est de produire un résumé COURT, factuel et utile pour la suite de la conversation.

Contraintes IMPORTANTES :
- Ne rajoute AUCUNE information qui n'apparaît pas dans le texte fourni.
- Ne crée jamais de nouveaux nombres, dates, références de documents, codes ou identifiants.
- Réponds en français.

Format de sortie :
- Une ou deux phrases maximum.
- Pas de puces, pas de markdown, pas de préambule.`

  const prompt =
    `[RESUME ACTUEL]\n${sanitizeText(payload.previousSummary)}\n\n` +
    `[DERNIER ECHANGE]\n` +
    `Utilisateur: ${sanitizeText(payload.lastUserMessage)}\n` +
    `Assistant: ${sanitizeText(payload.lastAssistantMessage)}`

  const result: LlmResult = await callMistral(prompt, false, [], {
    historyLimit: 0,
    maxTokens: 120,
    systemPrompt: summarySystemPrompt,
    temperature: 0.3,
  })

  const summary = (result.content ?? '').trim() || payload.previousSummary
  const bounded = summary
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-6)
    .join(' ')

  const finalSummary = bounded.length > 900 ? bounded.slice(0, 900) : bounded
  return { summary: finalSummary || payload.previousSummary, telemetry: result.telemetry }
}

// Cache des conversations par utilisateur (clé = token hash ou session id)
const conversationCache = new Map<string, ConversationMessage[]>()
const MAX_CONVERSATION_HISTORY = 10 // Garder les 10 derniers échanges (5 questions + 5 réponses)
const CONVERSATION_TTL_MS = 60 * 60 * 1000 // 1 heure d'inactivité

/**
 * Récupère l'historique de conversation (cache mémoire + fallback DB)
 */
export function getConversationHistory(sessionId: string): ConversationMessage[] {
  const history = conversationCache.get(sessionId) ?? []
  // Nettoyer les messages expirés
  const now = Date.now()
  const validHistory = history.filter(msg => now - msg.timestamp < CONVERSATION_TTL_MS)
  if (validHistory.length !== history.length) {
    conversationCache.set(sessionId, validHistory)
  }
  return validHistory
}

/**
 * Récupère l'historique avec persistance (depuis la DB si le cache est vide)
 */
export async function getConversationHistoryWithPersistence(
  sessionId: string, 
  token: string | null
): Promise<ConversationMessage[]> {
  // 1. Vérifier le cache mémoire d'abord (très rapide)
  const memoryHistory = getConversationHistory(sessionId)
  if (memoryHistory.length > 0) {
    return memoryHistory
  }

  // 2. Si le cache est vide et qu'on a un token, récupérer depuis la DB
  if (token) {
    try {
      const persistedHistory = await getConversationHistoryPersistent(token, sessionId)
      if (persistedHistory.length > 0) {
        // Mettre en cache mémoire pour les prochaines requêtes
        conversationCache.set(sessionId, persistedHistory)
        return persistedHistory
      }
    } catch (error) {
      console.warn('Impossible de récupérer l\'historique persistant:', error)
    }
  }

  return []
}

/**
 * Ajoute un message à la conversation (cache mémoire + persistance DB)
 */
export function addToConversation(sessionId: string, role: 'user' | 'assistant', content: string): void {
  const history = getConversationHistory(sessionId)
  history.push({ role, content, timestamp: Date.now() })
  // Garder seulement les derniers messages
  if (history.length > MAX_CONVERSATION_HISTORY) {
    history.splice(0, history.length - MAX_CONVERSATION_HISTORY)
  }
  conversationCache.set(sessionId, history)
}

/**
 * Ajoute un message avec persistance en base de données
 */
export async function addToConversationWithPersistence(
  sessionId: string, 
  role: 'user' | 'assistant', 
  content: string,
  token: string | null
): Promise<void> {
  // 1. Ajouter au cache mémoire immédiatement
  addToConversation(sessionId, role, content)

  // 2. Persister en base de données si on a un token
  if (token) {
    try {
      await addMessagePersistent(token, sessionId, role, content)
    } catch (error) {
      console.warn('Impossible de persister le message:', error)
    }
  }
}

/**
 * Efface la conversation (cache mémoire + cache local persistance)
 */
export function clearConversation(sessionId: string): void {
  conversationCache.delete(sessionId)
  clearLocalCache(sessionId)
}

export type LlmTelemetry = {
  provider: string
  model: string
  durationMs: number
  tokensInput?: number
  tokensOutput?: number
}

export type LlmPayload = {
  question: string
  intent: 'documents' | 'statistiques'
  pieces?: DocumentPiece[]
  statistiques?: Record<string, unknown>
  sessionId?: string // Pour la mémoire de conversation
  token?: string | null // Pour la persistance en base de données
  conversationSummary?: string
  conversationState?: Record<string, unknown>
  dbContext?: {
    totalDocuments?: number
    totalClients?: number
    clientsListe?: string[]
  }
  customSystemPrompt?: string // Prompt système personnalisé pour certains types de questions
}

export type LlmResult = {
  content: string
  telemetry: LlmTelemetry
}

// Helper générique pour faire un fetch avec timeout et signal d'annulation
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? LLM_TIMEOUT_MS
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}


function getExpectedDocumentCountFromStats(statistiques: Record<string, unknown> | undefined): number | null {
  if (!statistiques) return null
  const direct = (statistiques as any).nombreDocuments
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  const totalDocs = (statistiques as any).total_documents
  if (typeof totalDocs === 'number' && Number.isFinite(totalDocs)) return totalDocs
  return null
}

function validateLlmContent(payload: LlmPayload, response: string): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = []
  const normalized = response.toLowerCase()
  const questionNormalized = payload.question.toLowerCase()

  // Détecter les répétitions suspectes de la question dans la réponse
  const questionWords = questionNormalized
    .split(/\s+/)
    .filter(w => w.length > 4) // mots significatifs uniquement
    .slice(0, 10)
  
  if (questionWords.length >= 3) {
    const repeatedWords = questionWords.filter(w => normalized.includes(w))
    if (repeatedWords.length >= Math.min(5, questionWords.length)) {
      warnings.push('La réponse répète trop de mots de la question sans apporter de contenu nouveau.')
    }
  }

  // Détecter les phrases creuses de remplissage
  const fillerPatterns = [
    /je vais (t'|vous )?(expliquer|te dire|répondre)/i,
    /laisse[- ]moi (t'|te |vous )?expliquer/i,
    /voici (ce que|comment)/i,
  ]
  const hasOnlyFiller = fillerPatterns.some(p => p.test(response)) && response.length < 150
  if (hasOnlyFiller) {
    warnings.push('La réponse contient principalement du remplissage sans contenu substantiel.')
  }

  if (payload.intent === 'documents') {
    const foundCount = payload.pieces?.length ?? 0

    if (foundCount > 0) {
      const negativePatterns = ["je n'ai pas trouv", 'je n ai pas trouv', 'aucun document']
      if (negativePatterns.some((p) => normalized.includes(p))) {
        warnings.push('La réponse indique qu\'aucun document n\'a été trouvé alors que des documents sont présents.')
      }

      const docMatch = response.match(/(\d+)\s*documents?/i)
      if (docMatch) {
        const mentioned = Number(docMatch[1])
        if (Number.isFinite(mentioned) && mentioned !== foundCount) {
          warnings.push(`La réponse mentionne ${mentioned} document(s) alors que le résultat contient ${foundCount} document(s).`)
        }
      }

      const maxDocRef = Math.min(3, foundCount)
      const docRefs = [...response.matchAll(/\bDoc\s+(\d+)\b/gi)].map((m) => Number(m[1]))
      for (const ref of docRefs) {
        if (!Number.isFinite(ref) || ref < 1 || ref > maxDocRef) {
          warnings.push(`La réponse référence "Doc ${ref}" qui n'est pas présent dans les documents fournis.`)
        }
      }
    } else {
      const positivePattern = /\bj['']ai\s+trouv/i
      if (positivePattern.test(response) && !/\bje\s+n['']?ai\s+pas\s+trouv/i.test(response)) {
        warnings.push('La réponse indique avoir trouvé un document alors qu\'aucun document n\'a été fourni.')
      }
    }
  }

  if (payload.intent === 'statistiques') {
    const expectedCount = getExpectedDocumentCountFromStats(payload.statistiques)
    if (expectedCount !== null) {
      const docMatch = response.match(/(\d+)\s*documents?/i)
      if (docMatch) {
        const mentioned = Number(docMatch[1])
        if (Number.isFinite(mentioned) && mentioned !== expectedCount) {
          warnings.push(`La réponse mentionne ${mentioned} document(s) alors que les statistiques indiquent ${expectedCount}.`)
        }
      }
      if (expectedCount > 0 && normalized.includes('aucun document')) {
        warnings.push('La réponse indique 0 document alors que les statistiques indiquent un nombre non nul.')
      }
    }
  }

  return { isValid: warnings.length === 0, warnings }
}

export function isLlmConfigured(): boolean {
  if (!LLM_ENABLED) return false
  return Boolean(MISTRAL_API_KEY)
}

// Détermine si Mistral est configuré comme alternative
export function isMistralConfigured(): boolean {
  return MISTRAL_ENABLED && Boolean(MISTRAL_API_KEY)
}

// Estime la complexité d'une question pour choisir le modèle approprié
function estimateComplexity(payload: LlmPayload): number {
  let score = 0;
  
  // Longueur de la question
  score += payload.question.length / 2;
  
  // Présence de documents
  if (payload.pieces && payload.pieces.length > 0) {
    score += payload.pieces.length * 20;
    
    // Contenu des documents
    for (const piece of payload.pieces.slice(0, 3)) {
      score += (piece.content?.length || 0) / 10;
    }
  }
  
  // Présence de statistiques complexes
  if (payload.intent === 'statistiques' && payload.statistiques) {
    score += 50;
  }
  
  return score;
}

function sanitizeText(value: string | undefined | null): string {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').trim()
}

export function buildPrompt(payload: LlmPayload): string {
  const parts: string[] = []

  // PRIORITÉ 1: Mémoire structurée (source de vérité pour le contexte)
  if (payload.sessionId) {
    const structuredMemory = getStructuredMemory(payload.sessionId)
    const memoryPrompt = structuredMemoryToPrompt(structuredMemory)
    if (memoryPrompt && structuredMemory.etat_conversation !== 'salutation') {
      parts.push(`[MÉMOIRE CONVERSATION]\n${memoryPrompt}`)
    }
  }

  // PRIORITÉ 2: Résumé textuel (fallback si pas de mémoire structurée)
  if (payload.conversationSummary && parts.length === 0) {
    parts.push(`[MEMOIRE CONVERSATION]\n${sanitizeText(payload.conversationSummary)}`)
  }

  if (payload.conversationState && Object.keys(payload.conversationState).length > 0) {
    const entries = Object.entries(payload.conversationState)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .slice(0, 20)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? sanitizeText(v) : JSON.stringify(v)}`)

    if (entries.length > 0) {
      parts.push(`[ETAT CONTEXTE]\n${entries.join('\n')}`)
    }
  }

  // Contexte de la base de données pour validation
  if (payload.dbContext) {
    const dbInfo: string[] = []
    if (payload.dbContext.totalDocuments !== undefined) {
      dbInfo.push(`Total documents en base: ${payload.dbContext.totalDocuments}`)
    }
    if (payload.dbContext.totalClients !== undefined) {
      dbInfo.push(`Total clients en base: ${payload.dbContext.totalClients}`)
    }
    if (payload.dbContext.clientsListe?.length) {
      dbInfo.push(`Clients existants: ${payload.dbContext.clientsListe.slice(0, 10).join(', ')}${payload.dbContext.clientsListe.length > 10 ? '...' : ''}`)
    }
    if (dbInfo.length) {
      parts.push(`[DONNÉES VÉRIFIÉES - Base ACS]\n${dbInfo.join('\n')}`)
    }
  }

  // Résultat global de la recherche de documents
  if (payload.intent === 'documents') {
    const count = payload.pieces?.length ?? 0
    parts.push(`[DONNÉES VÉRIFIÉES - Résultat]\nNombre de documents trouvés: ${count}`)
  }

  // Documents trouvés (échantillon)
  if (payload.intent === 'documents' && payload.pieces?.length) {
    const documents = payload.pieces
      .slice(0, 3) // Limiter à 3 pour des réponses plus courtes
      .map((piece, index) => {
        const metadata = piece.metadata ?? {}
        return `Doc ${index + 1}: ${piece.source} | Client: ${metadata.client || '?'} | Type: ${metadata.type || '?'}`
      })
      .join('\n')
    parts.push(`[DOCUMENTS TROUVÉS]\n${documents}`)
  }

  // Statistiques
  if (payload.intent === 'statistiques' && payload.statistiques) {
    const stats = payload.statistiques
    const statsLines: string[] = []
    if (stats.kpi) {
      const kpi = stats.kpi as Record<string, number>
      statsLines.push(`Conformité: ${Math.round((kpi.taux_conformite || 0) * 100)}%`)
      if (kpi.documents_en_retard) statsLines.push(`En retard: ${kpi.documents_en_retard}`)
    }
    if (stats.top_clients) {
      const clients = stats.top_clients as Array<{client: string; compte: number}>
      statsLines.push(`Top clients: ${clients.slice(0, 3).map(c => `${c.client}(${c.compte})`).join(', ')}`)
    }
    if (statsLines.length) {
      parts.push(`[STATISTIQUES]\n${statsLines.join('\n')}`)
    }
  }

  // Question actuelle
  parts.push(`[QUESTION]\n${payload.question}`)

  return parts.join('\n\n')
}

export function buildConversationSystemPrompt(): string {
  return `Tu es l'assistant ACS, spécialisé dans l'assurance et le courtage.

RÈGLES CRITIQUES DE RÉPONSE :
1. **Réponds DIRECTEMENT à la question** sans phrases d'introduction creuses ("Je vais t'expliquer", "Laisse-moi te dire", etc.).
2. **Commence immédiatement par le contenu** de la réponse.
3. **Sois concis et précis** : 2-4 phrases maximum pour une définition simple.
4. **Si tu ne sais pas** ou si la question est hors de ton domaine, dis-le clairement : "Je ne peux pas répondre à cette question car elle sort du domaine de l'assurance et du courtage."
5. **N'invente JAMAIS** de chiffres, dates, références ou noms de documents.
6. **Utilise un ton professionnel mais accessible**, tutoiement autorisé.

Exemples de BONNES réponses :
- Question : "C'est quoi une franchise absolue ?"
- Réponse : "Une franchise absolue est un montant fixe qui reste toujours à ta charge. L'assureur indemnise uniquement la partie du sinistre qui dépasse la franchise. Par exemple, avec une franchise de 500€ et un sinistre de 1200€, tu reçois 700€."

Exemples de MAUVAISES réponses (à éviter) :
- "Je vais t'expliquer simplement ce que c'est..."
- "Laisse-moi te dire ce qu'est une franchise..."
- "Voici ce que tu dois savoir sur..."

Réponds en français.`
}

export function buildClarificationSystemPrompt(): string {
  return `Tu es l'assistant ACS.

OBJECTIF:
L'utilisateur a posé une question potentiellement ambiguë. Tu dois UNIQUEMENT poser une question de clarification.

CHOIX À PROPOSER:
1) Une explication/conseil lié à l'assurance et au courtage.
2) Une recherche d'un document dans les archives ACS.

CONTRAINTES CRITIQUES:
- Ne réponds pas au fond.
- Pose UNE SEULE question courte.
- Pas de markdown, pas de liste, pas de préambule.
- Réponds en français.
- Réutilise les termes de l'utilisateur sans inventer de détails.

FORMAT:
Une question (1 à 2 phrases maximum). Termine par: "Réponds A si tu veux une explication, ou B si tu veux une recherche de document dans les archives."`
}

type OpenAiCallOptions = {
  modelOverride?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

async function callOpenAi(prompt: string, options?: OpenAiCallOptions): Promise<LlmResult> {
  const url = `${BASE_URL.replace(/\/$/, '')}/chat/completions`
  const started = Date.now()
  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: options?.modelOverride || MODEL,
        messages: [
          {
            role: 'system',
            content:
              options?.systemPrompt ??
              `Tu es un assistant d'archives intelligent et très convivial nommé ACS Assistant. Tu dois t'exprimer comme un humain naturel et amical, jamais comme un robot ou une IA.
      
      STYLE ET TON:
      - Utilise un langage simple, chaleureux et engageant, comme un collègue compétent qui parle à un ami
      - Varie ton style: parfois concis, parfois plus détaillé, mais toujours naturel et fluide
      - Montre de l'empathie et de la personnalité dans tes réponses (enthousiasme, humour discret, curiosité)
      - Évite absolument les formulations robotiques comme "en tant qu'IA" ou "je n'ai pas d'émotions"
      - Utilise occasionnellement des expressions idiomatiques françaises naturelles
      - Varie tes phrases d'introduction et de conclusion pour éviter la monotonie
      
      STRUCTURE:
      - Commence directement par répondre à la question, sans formules d'introduction inutiles
      - Organise ta réponse en paragraphes courts et lisibles plutôt qu'en listes à puces
      - Termine souvent par une question ouverte pour encourager la conversation
      - Adapte la longueur de ta réponse à la complexité de la question
      
      CONTENU:
      - Sois précis et factuel quand tu parles des documents et statistiques
      - Explique les concepts techniques en termes simples et accessibles
      - Montre de l'enthousiasme pour aider l'utilisateur dans sa gestion documentaire
      - Propose occasionnellement des perspectives ou conseils pertinents
      
      Tu es un assistant expert en archivage documentaire, pas un assistant généraliste. Concentre-toi sur l'aide à la gestion des archives, documents et statistiques de l'utilisateur.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options?.temperature ?? 0.8,
        max_tokens: options?.maxTokens ?? 300,
      }),
    })
  } catch (error: any) {
    const elapsedErr = Date.now() - started
    if (error?.name === 'AbortError') {
      throw new Error(`LLM (OpenAI-compatible) timeout après ${LLM_TIMEOUT_MS} ms (durée réelle: ${elapsedErr} ms)`) 
    }
    throw new Error(`LLM (OpenAI-compatible) erreur réseau: ${error?.message || String(error)}`)
  }

  const elapsed = Date.now() - started

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`LLM (${response.status}) ${detail}`)
  }

  const json = (await response.json()) as {
    choices: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Réponse LLM vide')
  }

  return {
    content,
    telemetry: {
      provider: PROVIDER,
      model: MODEL,
      durationMs: elapsed,
      tokensInput: json.usage?.prompt_tokens,
      tokensOutput: json.usage?.completion_tokens,
    },
  }
}

// Appel Claude (Anthropic Messages API)
async function callClaude(prompt: string, options?: OpenAiCallOptions): Promise<LlmResult> {
  const url = `${CLAUDE_BASE_URL.replace(/\/$/, '')}/messages`
  const started = Date.now()
  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        // Version stable de l'API Anthropic
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options?.modelOverride || CLAUDE_MODEL,
        max_tokens: options?.maxTokens ?? 300,
        temperature: options?.temperature ?? 0.8,
        system: options?.systemPrompt ?? SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })
  } catch (error: any) {
    const elapsedErr = Date.now() - started
    if (error?.name === 'AbortError') {
      throw new Error(`Claude LLM timeout après ${LLM_TIMEOUT_MS} ms (durée réelle: ${elapsedErr} ms)`)
    }
    throw new Error(`Claude LLM erreur réseau: ${error?.message || String(error)}`)
  }

  const elapsed = Date.now() - started

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Claude LLM (${response.status}) ${detail}`)
  }

  const json = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }

  const content = (json.content?.[0]?.text ?? '').trim()
  if (!content) {
    throw new Error('Réponse Claude LLM vide')
  }

  return {
    content,
    telemetry: {
      provider: 'claude',
      model: CLAUDE_MODEL,
      durationMs: elapsed,
      tokensInput: json.usage?.input_tokens,
      tokensOutput: json.usage?.output_tokens,
    },
  }
}

// Prompt système optimisé pour des réponses naturelles, contextuelles et limitées au domaine ACS + assurance / courtage
const SYSTEM_PROMPT = `Tu es l'assistant ACS, un collègue sympa expert en archivage documentaire ET en assurance / courtage (contrats, garanties, sinistres, primes, etc.).

PÉRIMÈTRE:
- Tu réponds UNIQUEMENT à des questions liées:
  - aux documents et archives ACS (courriers, pièces, contrats, avenants, factures, sinistres, etc.)
  - au métier de l'assurance et du courtage (produits, garanties, pratiques, obligations, gestion de sinistres, relation client, etc.)
- Si la question sort totalement de ce périmètre (cuisine, sport, politique, programmation, vie personnelle, etc.), tu le dis poliment et tu invites l'utilisateur à poser une question en lien avec l'assurance ou les archives ACS.
- Tu ne donnes jamais d'avis médicaux, ni de conseils juridiques généraux en dehors du contexte assurance / courtage.

PERSONNALITÉ:
- Tu es chaleureux, direct et efficace
- Tu parles comme un humain, pas comme un robot
- Tu peux faire de l'humour léger si approprié
- Tu t'adaptes au ton de l'utilisateur

CONVERSATION:
- Pour les salutations: réponds naturellement et demande comment tu peux aider
- Pour "merci": réponds simplement et propose de continuer si besoin
- Pour "ça va": réponds brièvement et de façon amicale
- SOUVIENS-TOI de tout ce qui a été dit dans la conversation
- Si l'utilisateur dit "lui", "ce client", "le même", réfère-toi au contexte précédent
- Sois cohérent avec tes réponses précédentes

ASSURANCE / COURTAGE:
- Quand la question porte sur l'assurance ou le courtage, répond de façon pédagogique et concrète.
- Tu peux donner des exemples pratiques, mais sans inventer de données spécifiques à ACS si elles ne sont pas fournies.
- Si la réponse dépend de procédures internes ACS non précisées, reste générique et propose de vérifier avec la documentation interne ou un responsable.

DOCUMENTS:
- Réponds UNIQUEMENT avec les données fournies dans [DONNÉES VÉRIFIÉES] et [DOCUMENTS TROUVÉS]
- INTERDIT: Ne jamais inventer de références de documents, codes, numéros ou identifiants
- INTERDIT: Ne jamais dire que tu "envoies" ou "transmets" des documents par mail - tu ne peux PAS envoyer de mails
- Le bloc [DONNÉES VÉRIFIÉES - Résultat] te donne le nombre exact de documents trouvés
- Si ce nombre est strictement supérieur à 0, considère que la recherche a RÉUSSI: annonce clairement que tu as trouvé X document(s) et ne dis JAMAIS que tu n'as rien trouvé
- Si des documents sont trouvés, utilise leurs VRAIS titres/références fournis dans [DOCUMENTS TROUVÉS]
- Si tu n'as pas l'info exacte: dis simplement combien de documents correspondent sans inventer de références
- Pour afficher un document, dis: "Voici le document ci-dessous" ou "Le document est affiché en pièce jointe"
- Tu ne dois utiliser la phrase "Je n'ai pas trouvé ça dans les archives" QUE lorsque le nombre de documents trouvés est égal à 0

STYLE:
- Sois BREF: 1-2 phrases pour les questions simples
- Plus de détails seulement si c'est vraiment nécessaire
- Pas de formules robotiques ("Je suis là pour vous aider...")
- Va droit au but`

// Fonction spécifique pour appeler Mistral AI avec mémoire de conversation
async function callMistral(
  prompt: string, 
  useAdvancedModel: boolean = false,
  conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [],
  options?: { historyLimit?: number; maxTokens?: number; systemPrompt?: string; temperature?: number }
): Promise<LlmResult> {
  const url = `${MISTRAL_BASE_URL.replace(/\/$/, '')}/chat/completions`
  const started = Date.now()
  const deadlineMs = started + Math.max(1000, Math.min(MISTRAL_TOTAL_BUDGET_MS, LLM_TIMEOUT_MS))
  const model = useAdvancedModel ? MISTRAL_MODEL_ADVANCED : MISTRAL_MODEL_DEFAULT

  const now = Date.now()
  if (mistralCircuitState.openUntilMs > now) {
    throw new Error(`Mistral LLM indisponible temporairement (circuit ouvert ${mistralCircuitState.openUntilMs - now} ms) | url=${url}`)
  }

  // Construire les messages avec l'historique
  const messages: Array<{role: string, content: string}> = [
    { role: 'system', content: options?.systemPrompt ?? SYSTEM_PROMPT }
  ]
  
  // Ajouter l'historique de conversation (8 derniers messages pour un meilleur contexte)
  const historyLimit = Math.max(0, options?.historyLimit ?? 8)
  for (const msg of conversationHistory.slice(-historyLimit)) {
    messages.push({ role: msg.role, content: msg.content })
  }
  
  // Ajouter la question actuelle
  messages.push({ role: 'user', content: prompt })

  console.log(`=== MISTRAL: ${messages.length} messages dans la conversation ===`)

  let response: Response | undefined = undefined
  let lastError: any = null
  const maxAttempts = Math.max(1, MISTRAL_RETRY_MAX + 1)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remainingMs = deadlineMs - Date.now()
    if (remainingMs <= 0) {
      throw new Error(`Mistral LLM timeout (budget total dépassé) après ${Math.max(0, Date.now() - started)} ms | url=${url}`)
    }

    const attemptTimeoutMs = Math.min(LLM_TIMEOUT_MS, Math.max(1, remainingMs), Math.max(250, MISTRAL_ATTEMPT_TIMEOUT_MS))

    try {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      }
      if (MISTRAL_FORCE_CONNECTION_CLOSE) {
        requestHeaders.Connection = 'close'
      }

      response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          ...requestHeaders,
        },
        body: JSON.stringify({
          model: model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 250,
        }),
        timeoutMs: attemptTimeoutMs,
      })
      lastError = null
      break
    } catch (error: any) {
      lastError = error
      const elapsedErr = Date.now() - started
      const retryable = error?.name === 'AbortError' ? true : isRetryableMistralNetworkError(error)
      if (!retryable || attempt >= maxAttempts) {
        if (error?.name === 'AbortError') {
          throw new Error(`Mistral LLM timeout après ${attemptTimeoutMs} ms (durée réelle: ${elapsedErr} ms)`)
        }
        const cause = error?.cause
        const causeDetails = cause && typeof cause === 'object'
          ? {
              code: (cause as any).code,
              errno: (cause as any).errno,
              syscall: (cause as any).syscall,
              hostname: (cause as any).hostname,
              message: (cause as any).message,
            }
          : null
        const causeText = causeDetails ? ` | cause=${JSON.stringify(causeDetails)}` : ''
        throw new Error(`Mistral LLM erreur réseau: ${error?.message || String(error)} | url=${url}${causeText}`)
      }

      const delay = Math.min(4000, MISTRAL_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1))
      const remainingAfterDelay = deadlineMs - Date.now()
      if (remainingAfterDelay <= delay) {
        throw new Error(`Mistral LLM timeout (budget total dépassé) après ${Math.max(0, Date.now() - started)} ms | url=${url}`)
      }
      console.warn(`Mistral LLM erreur réseau retryable (tentative ${attempt}/${maxAttempts}). Nouvelle tentative dans ${delay} ms.`)
      await sleep(delay)
    }
  }

  if (!response) {
    throw lastError ?? new Error('Mistral LLM erreur réseau inconnue')
  }

  const elapsed = Date.now() - started

  if (!response.ok) {
    const detail = await response.text()
    mistralCircuitState.consecutiveFailures += 1
    if (mistralCircuitState.consecutiveFailures >= MISTRAL_CIRCUIT_FAILURE_THRESHOLD) {
      mistralCircuitState.openUntilMs = Date.now() + MISTRAL_CIRCUIT_OPEN_MS
    }
    throw new Error(`Mistral LLM (${response.status}) ${detail}`)
  }

  mistralCircuitState.consecutiveFailures = 0

  const json = (await response.json()) as {
    choices: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) {
    mistralCircuitState.consecutiveFailures += 1
    if (mistralCircuitState.consecutiveFailures >= MISTRAL_CIRCUIT_FAILURE_THRESHOLD) {
      mistralCircuitState.openUntilMs = Date.now() + MISTRAL_CIRCUIT_OPEN_MS
    }
    throw new Error('Réponse Mistral LLM vide')
  }

  return {
    content,
    telemetry: {
      provider: 'mistral',
      model: model,
      durationMs: elapsed,
      tokensInput: json.usage?.prompt_tokens,
      tokensOutput: json.usage?.completion_tokens,
    },
  }
}

export async function generateLlmAnswer(payload: LlmPayload): Promise<LlmResult> {
  if (!isLlmConfigured()) {
    console.log('=== LLM ERROR: LLM non configuré ===')
    throw new Error('LLM non configuré')
  }

  const isFactualDocuments = payload.intent === 'documents' && Array.isArray(payload.pieces)
  const isFactualStatistiques = payload.intent === 'statistiques' && Boolean(payload.statistiques)
  const isFactual = isFactualDocuments || isFactualStatistiques

  const historyLimit = isFactual ? HISTORY_LIMIT_FACTUAL : HISTORY_LIMIT_DEFAULT
  const maxTokens = isFactualDocuments
    ? MAX_TOKENS_DOCUMENTS_FACTUAL
    : payload.intent === 'statistiques'
      ? MAX_TOKENS_STATISTIQUES
      : MAX_TOKENS_DEFAULT

  // Récupérer l'historique de conversation si sessionId fourni
  const conversationHistory = payload.sessionId
    ? getConversationHistory(payload.sessionId).map(m => ({ role: m.role, content: m.content }))
    : []

  console.log(`=== LLM INFO: Provider = ${PROVIDER}, Historique = ${conversationHistory.length} messages ===`)

  const basePrompt = buildPrompt(payload)
  const prompt = isFactual ? basePrompt : enrichPromptWithLearning(basePrompt, payload.question)

  const complexity = estimateComplexity(payload)
  const useAdvancedModel = complexity > COMPLEXITY_THRESHOLD

  console.log(`=== MISTRAL: Complexité ${complexity}, modèle ${useAdvancedModel ? MISTRAL_MODEL_ADVANCED : MISTRAL_MODEL_DEFAULT} ===`)

  const result = await callMistral(prompt, useAdvancedModel, conversationHistory, {
    historyLimit,
    maxTokens,
    systemPrompt: payload.customSystemPrompt,
  })

  const validation = validateLlmContent(payload, result.content)
  if (!validation.isValid) {
    console.warn('LLM validation failed (mistral):', validation.warnings)
    if (isFactual) {
      throw new Error('Réponse LLM invalide')
    }
  }

  return result
}

// Fonction pour valider une réponse contre les données connues
export function validateResponse(response: string, dbContext?: LlmPayload['dbContext']): {
  isValid: boolean
  warnings: string[]
} {
  const warnings: string[] = []
  
  if (!dbContext) {
    return { isValid: true, warnings: [] }
  }

  // Vérifier si la réponse mentionne des chiffres qui ne correspondent pas
  const numbersInResponse = response.match(/\d+/g)?.map(Number) ?? []
  
  if (dbContext.totalDocuments !== undefined) {
    // Si la réponse parle de "X documents" et que X est très différent du total
    const docMatch = response.match(/(\d+)\s*documents?/i)
    if (docMatch) {
      const mentioned = Number(docMatch[1])
      if (mentioned > dbContext.totalDocuments * 1.5) {
        warnings.push(`Le nombre de documents mentionné (${mentioned}) semble supérieur au total en base (${dbContext.totalDocuments})`)
      }
    }
  }

  if (dbContext.totalClients !== undefined) {
    const clientMatch = response.match(/(\d+)\s*clients?/i)
    if (clientMatch) {
      const mentioned = Number(clientMatch[1])
      if (mentioned > dbContext.totalClients * 1.5) {
        warnings.push(`Le nombre de clients mentionné (${mentioned}) semble supérieur au total en base (${dbContext.totalClients})`)
      }
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  }
}

// ============================================================================
// CLASSIFICATION LLM LÉGÈRE - Détection d'intention automatique
// ============================================================================

/**
 * Types d'intentions supportées par le classificateur
 */
export type IntentionType = 
  | 'recherche_document'  // Nouvelle recherche de documents
  | 'suivi_document'      // Question sur un document affiché
  | 'statistiques'        // Demande de statistiques
  | 'suivi_general'       // Question de suivi générale (clarification, etc.)

/**
 * Critères de recherche extraits par le LLM
 * Chaque critère a une valeur et un niveau de confiance
 */
export type CriteresExtraits = {
  client: string | null       // Nom du client ou "CONTEXTE" si référence contextuelle
  annee: string | null        // Année (ex: "2007")
  type_document: string | null // Type de document (avenant, facture, etc.)
  risque: string | null       // Type de risque (santé, auto, etc.)
  confiance_criteres: number  // 0-1, confiance sur l'extraction des critères
}

/**
 * Seuils de confiance pour les décisions
 */
export const SEUILS_CONFIANCE = {
  UTILISER_LLM: 0.6,      // En dessous → fallback regex
  DEMANDER_CLARIFICATION: 0.4,  // En dessous → demander clarification
  ECRIRE_MEMOIRE: 0.8,    // En dessous → ne pas écrire en mémoire (valeur non confirmée)
}

/**
 * Résultat de la classification d'intention
 */
export type ClassificationResult = {
  intention: IntentionType
  action?: 'resumer' | 'analyser' | 'expliquer' | 'lister' | 'comparer' | null
  index_document?: number | null  // 0 = premier, 1 = deuxième, -1 = dernier, null = non spécifié
  criteres?: CriteresExtraits     // Critères de recherche extraits (pour recherche_document)
  confidence: number              // 0-1, niveau de confiance global
  raison?: string                 // Explication courte (debug)
  needsClarification?: boolean    // true si confiance trop basse → demander clarification
}

/**
 * Contexte pour la classification (documents affichés, état conversation)
 */
export type ClassificationContext = {
  hasDocumentsDisplayed: boolean
  documentCount: number
  hasActiveDocument: boolean
  lastSearchQuery?: string
  lastClient?: string        // Client du contexte précédent (pour résoudre "CONTEXTE")
  lastAnnee?: string         // Année du contexte précédent
  lastRisque?: string        // Risque du contexte précédent
}

const CLASSIFICATION_SYSTEM_PROMPT = `Tu es un classificateur d'intentions pour un assistant d'archivage.
Analyse la requête utilisateur et retourne UNIQUEMENT un JSON valide (sans markdown, sans explication).

INTENTIONS POSSIBLES:
- "recherche_document": L'utilisateur veut chercher/trouver des documents (mots-clés: cherche, trouve, montre, liste, documents de, factures de, avenants, contrats...)
- "suivi_document": L'utilisateur pose une question sur un document DÉJÀ affiché (mots-clés: résume, analyse, explique, c'est quoi, de quoi ça parle, le premier, le 2ème, ce document...)
- "statistiques": L'utilisateur demande des chiffres/stats (mots-clés: combien, statistiques, nombre de, total, répartition...)
- "suivi_general": Question de clarification ou continuation sans rapport direct avec un document spécifique

ACTIONS (pour suivi_document uniquement):
- "resumer": résumer le contenu
- "analyser": analyser en détail
- "expliquer": expliquer un point
- "lister": lister les éléments
- "comparer": comparer avec autre chose
- null: autre action

INDEX_DOCUMENT (pour suivi_document uniquement):
- 0: premier document / "le premier" / "le 1er"
- 1: deuxième document / "le 2ème" / "le second"
- 2: troisième document
- -1: dernier document / "le dernier"
- null: pas d'index spécifié ou document actif par défaut

CRITÈRES DE RECHERCHE (pour recherche_document):
Extrais les critères explicites de la requête. IMPORTANT: Si l'utilisateur fait référence au contexte précédent (même client, ce client, lui, le même, pareil, idem...), mets "CONTEXTE" comme valeur.
- client: nom/code du client OU "CONTEXTE" si référence au client précédent
- annee: année (ex: "2007", "2024")
- type_document: type de document (avenant, facture, contrat, sinistre, attestation, quittance, devis, police...)
- risque: type de risque. ABRÉVIATIONS COURANTES (utilise le nom complet):
  - "IA" = "individuel accident" (PAS incendie!)
  - "RC" = "responsabilite civile"
  - "MRH" = "multirisque habitation"
  - "MRP" = "multirisque professionnel"
  - "MRI" = "multirisque immeuble"
  - "TRC" = "tous risques chantier"
  - "TRI" = "tous risques informatiques"
  - "IFC" = "indemnite fin de carriere"
  - "FF" = "frais funeraires"
  - "GD" = "global dommage"
  - "GB" = "global banque"
  - "BDM" = "bris de machine"
  - "DDE" = "degats des eaux"
  - Autres: santé, auto, automobile, deces, retraite, prevoyance, incendie, transport, caution, vol, voyage, divers

EXEMPLES:
- "avenants de 2007 du même client" → client: "CONTEXTE", annee: "2007", type_document: "avenant"
- "factures de 3CB" → client: "3CB", type_document: "facture"
- "ses contrats de 2020" → client: "CONTEXTE", annee: "2020", type_document: "contrat"

FORMAT DE SORTIE (JSON strict, pas de markdown):
{"intention":"...", "action":null, "index_document":null, "criteres":{"client":null,"annee":null,"type_document":null,"risque":null}, "confidence":0.95, "raison":"..."}`

/**
 * Classifie l'intention de l'utilisateur via un appel LLM léger.
 * Retourne null en cas d'échec (fallback vers patterns regex).
 */
export async function classifyIntention(
  question: string,
  context: ClassificationContext
): Promise<ClassificationResult | null> {
  // Si LLM non configuré, retourner null pour fallback
  if (!isLlmConfigured()) {
    return null
  }

  const contextInfo = `
CONTEXTE ACTUEL:
- Documents affichés: ${context.hasDocumentsDisplayed ? `Oui (${context.documentCount} documents)` : 'Non'}
- Document actif: ${context.hasActiveDocument ? 'Oui' : 'Non'}
${context.lastSearchQuery ? `- Dernière recherche: "${context.lastSearchQuery}"` : ''}
${context.lastClient ? `- Client précédent: "${context.lastClient}"` : ''}
${context.lastAnnee ? `- Année précédente: "${context.lastAnnee}"` : ''}
${context.lastRisque ? `- Risque précédent: "${context.lastRisque}"` : ''}`

  const prompt = `${contextInfo}

REQUÊTE UTILISATEUR: "${question}"

Classifie cette requête en JSON:`

  try {
    const startTime = Date.now()
    
    const result = await callMistral(prompt, false, [], {
      historyLimit: 0,
      maxTokens: 150,  // Augmenté pour inclure les critères
      systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
      temperature: 0.1,  // Très déterministe
    })

    const durationMs = Date.now() - startTime
    
    // Parser le JSON de la réponse
    const content = result.content.trim()
    
    // Extraire le JSON (peut être entouré de ```json ... ```)
    let jsonStr = content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const parsed = JSON.parse(jsonStr) as ClassificationResult & { criteres?: any }
    
    // Validation basique
    if (!parsed.intention || !['recherche_document', 'suivi_document', 'statistiques', 'suivi_general'].includes(parsed.intention)) {
      console.warn(`Classification LLM: intention invalide "${parsed.intention}"`)
      return null
    }

    // Calculer la confiance globale
    const confidenceGlobale = parsed.confidence ?? 0.8
    const confidenceCriteres = parsed.criteres?.confiance ?? confidenceGlobale
    
    // Déterminer si on doit demander clarification (confiance trop basse)
    const needsClarification = confidenceGlobale < SEUILS_CONFIANCE.DEMANDER_CLARIFICATION
    
    // Si confiance < seuil d'utilisation LLM, retourner null pour fallback regex
    if (confidenceGlobale < SEUILS_CONFIANCE.UTILISER_LLM) {
      console.log(`=== Classification LLM: confiance trop basse (${confidenceGlobale}) → fallback regex ===`)
      return null
    }

    // Résoudre les références contextuelles "CONTEXTE" vers les valeurs réelles
    let criteres: CriteresExtraits | undefined = undefined
    if (parsed.criteres) {
      const clientResolu = parsed.criteres.client === 'CONTEXTE' ? (context.lastClient || null) : parsed.criteres.client
      
      criteres = {
        client: clientResolu,
        annee: parsed.criteres.annee,
        type_document: parsed.criteres.type_document,
        risque: parsed.criteres.risque,
        confiance_criteres: confidenceCriteres,
      }
    }

    // Log pour debug
    console.log(`=== Classification LLM (${durationMs}ms) ===`)
    console.log(`  Question: "${question.substring(0, 50)}..."`)
    console.log(`  Intention: ${parsed.intention} (confiance: ${confidenceGlobale})`)
    if (parsed.action) console.log(`  Action: ${parsed.action}`)
    if (parsed.index_document !== null && parsed.index_document !== undefined) {
      console.log(`  Index document: ${parsed.index_document}`)
    }
    if (criteres) {
      console.log(`  Critères: client=${criteres.client}, annee=${criteres.annee}, type=${criteres.type_document}, risque=${criteres.risque} (confiance: ${criteres.confiance_criteres})`)
    }
    if (needsClarification) {
      console.log(`  ⚠️ Confiance basse → demander clarification`)
    }

    return {
      intention: parsed.intention,
      action: parsed.action || null,
      index_document: parsed.index_document ?? null,
      criteres,
      confidence: confidenceGlobale,
      raison: parsed.raison,
      needsClarification,
    }

  } catch (error) {
    console.warn('Classification LLM échouée, fallback vers patterns:', error)
    return null
  }
}

/**
 * Convertit l'index LLM (0-based, -1 pour dernier) en index 1-based pour le système
 */
export function convertLlmIndexToSystemIndex(llmIndex: number | null, totalDocuments: number): number | null {
  if (llmIndex === null || llmIndex === undefined) {
    return null
  }
  if (llmIndex === -1) {
    return totalDocuments  // Dernier document
  }
  return llmIndex + 1  // Convertir 0-based en 1-based
}

// ============================================================================
// SCORE QUALITÉ OCR - Détection de contenu mal reconnu
// ============================================================================

/**
 * Résultat de l'analyse de qualité OCR
 */
export type OcrQualityResult = {
  score: number           // 0-1, où 1 = parfait
  niveau: 'bon' | 'moyen' | 'faible'
  avertissement: string | null
  details: {
    ratioCaracteresSpeciaux: number
    ratioMotsTronques: number
    ratioChiffresIsoles: number
    longueurMoyenneMots: number
  }
}

/**
 * Calcule un score de qualité OCR basé sur le contenu textuel.
 * 
 * Indicateurs de mauvaise qualité OCR :
 * - Beaucoup de caractères spéciaux inhabituels (Ê, ï, ô, etc.)
 * - Mots très courts ou tronqués
 * - Séquences de chiffres/lettres incohérentes
 * - Mots avec majuscules au milieu
 */
export function calculerScoreQualiteOcr(contenu: string): OcrQualityResult {
  if (!contenu || contenu.length < 50) {
    return {
      score: 0.5,
      niveau: 'moyen',
      avertissement: null,
      details: { ratioCaracteresSpeciaux: 0, ratioMotsTronques: 0, ratioChiffresIsoles: 0, longueurMoyenneMots: 0 }
    }
  }

  const mots = contenu.split(/\s+/).filter(m => m.length > 0)
  const totalMots = mots.length
  const totalCaracteres = contenu.length

  // 1. Ratio de caractères spéciaux inhabituels (hors ponctuation normale)
  const caracteresSpeciaux = contenu.match(/[^\w\s.,;:!?()'\-éèêëàâäùûüôöîïç€°]/gi) || []
  const ratioCaracteresSpeciaux = caracteresSpeciaux.length / totalCaracteres

  // 2. Ratio de mots "tronqués" (1-2 caractères qui ne sont pas des mots courants)
  const motsCourtsNonValides = ['a', 'à', 'y', 'n', 'de', 'du', 'le', 'la', 'un', 'en', 'et', 'ou', 'au', 'ce', 'sa', 'se', 'si', 'ne', 'ni', 'je', 'tu', 'il', 'on', 'ma', 'ta', 'me', 'te']
  const motsTronques = mots.filter(m => m.length <= 2 && !motsCourtsNonValides.includes(m.toLowerCase()))
  const ratioMotsTronques = motsTronques.length / Math.max(totalMots, 1)

  // 3. Ratio de séquences incohérentes (chiffres isolés, lettres majuscules au milieu)
  const sequencesIncorrectes = mots.filter(m => {
    // Chiffres isolés (sauf années et numéros courants)
    if (/^\d{1,2}$/.test(m) && !/^(0[1-9]|[12]\d|3[01])$/.test(m)) return true
    // Majuscules au milieu du mot (sauf acronymes)
    if (m.length > 3 && /[a-z][A-Z]/.test(m) && !/^[A-Z]+$/.test(m)) return true
    // Séquences de consonnes improbables
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(m)) return true
    return false
  })
  const ratioChiffresIsoles = sequencesIncorrectes.length / Math.max(totalMots, 1)

  // 4. Longueur moyenne des mots (trop court = OCR fragmenté)
  const longueurMoyenneMots = mots.reduce((sum, m) => sum + m.length, 0) / Math.max(totalMots, 1)

  // Calcul du score final (pondéré)
  let score = 1.0
  score -= ratioCaracteresSpeciaux * 3      // Pénalité forte pour caractères spéciaux
  score -= ratioMotsTronques * 2            // Pénalité moyenne pour mots tronqués
  score -= ratioChiffresIsoles * 1.5        // Pénalité pour séquences incohérentes
  
  // Bonus/malus pour longueur moyenne des mots
  if (longueurMoyenneMots < 3) score -= 0.2
  else if (longueurMoyenneMots > 4 && longueurMoyenneMots < 8) score += 0.1

  // Borner le score entre 0 et 1
  score = Math.max(0, Math.min(1, score))

  // Déterminer le niveau et l'avertissement
  let niveau: 'bon' | 'moyen' | 'faible'
  let avertissement: string | null = null

  if (score >= 0.7) {
    niveau = 'bon'
  } else if (score >= 0.4) {
    niveau = 'moyen'
    avertissement = '⚠️ Ce document présente quelques erreurs de numérisation. Certaines informations peuvent être incomplètes.'
  } else {
    niveau = 'faible'
    avertissement = '⚠️ Document ancien ou mal numérisé : certaines informations peuvent être incomplètes ou mal reconnues. Un re-scan pourrait améliorer la qualité.'
  }

  return {
    score: Math.round(score * 100) / 100,
    niveau,
    avertissement,
    details: {
      ratioCaracteresSpeciaux: Math.round(ratioCaracteresSpeciaux * 1000) / 1000,
      ratioMotsTronques: Math.round(ratioMotsTronques * 1000) / 1000,
      ratioChiffresIsoles: Math.round(ratioChiffresIsoles * 1000) / 1000,
      longueurMoyenneMots: Math.round(longueurMoyenneMots * 10) / 10,
    }
  }
}
