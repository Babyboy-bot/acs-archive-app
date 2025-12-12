/*
 * Utilitaires d'intégration LLM pour l'assistant IA.
 * L'objectif est de centraliser la configuration, la construction du prompt
 * et l'appel réseau afin de sécuriser l'intégration d'un modèle de langage.
 */

import type { DocumentPiece } from './types'
import { enrichPromptWithLearning } from './learning'

const PROVIDER = (process.env.ASSISTANT_LLM_PROVIDER ?? 'openai').toLowerCase()
const API_KEY = process.env.ASSISTANT_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
const BASE_URL = process.env.ASSISTANT_LLM_BASE_URL ?? 'https://api.openai.com/v1'
const MODEL = process.env.ASSISTANT_LLM_MODEL ?? 'gpt-4o-mini'
const LLM_ENABLED = (process.env.ASSISTANT_LLM_ENABLED ?? 'true').toLowerCase() !== 'false'

// Configuration pour la stratégie multi-modèles Mistral
const MISTRAL_BASE_URL = process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1'
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY ?? ''
// Modèle par défaut plus puissant pour de meilleures réponses
const MISTRAL_MODEL_DEFAULT = process.env.MISTRAL_MODEL_DEFAULT ?? 'mistral-medium-latest'
const MISTRAL_MODEL_ADVANCED = process.env.MISTRAL_MODEL_ADVANCED ?? 'mistral-large-latest'
const MISTRAL_ENABLED = (process.env.MISTRAL_ENABLED ?? 'false').toLowerCase() === 'true'

// Seuil de complexité pour utiliser le modèle avancé (abaissé pour utiliser plus souvent le modèle puissant)
const COMPLEXITY_THRESHOLD = Number(process.env.COMPLEXITY_THRESHOLD ?? '80')

// Mémoire de conversation (stockage en mémoire pour la session)
type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// Cache des conversations par utilisateur (clé = token hash ou session id)
const conversationCache = new Map<string, ConversationMessage[]>()
const MAX_CONVERSATION_HISTORY = 10 // Garder les 10 derniers échanges (5 questions + 5 réponses)
const CONVERSATION_TTL_MS = 60 * 60 * 1000 // 1 heure d'inactivité

// Import dynamique pour éviter les erreurs de build
import { 
  getConversationHistoryPersistent, 
  addMessagePersistent, 
  clearLocalCache 
} from './conversation'

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
  dbContext?: {
    totalDocuments?: number
    totalClients?: number
    clientsListe?: string[]
  }
}

export type LlmResult = {
  content: string
  telemetry: LlmTelemetry
}

export function isLlmConfigured(): boolean {
  if (!LLM_ENABLED) return false

  // Pour OpenAI, on exige une clé API. Pour un fournisseur local compatible
  // OpenAI (ex: Ollama, LM Studio), on peut se contenter de BASE_URL.
  if (PROVIDER === 'openai') {
    return Boolean(API_KEY)
  }
  
  // Pour Mistral, vérifier la clé API Mistral
  if (PROVIDER === 'mistral') {
    return Boolean(MISTRAL_API_KEY)
  }

  return true
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

async function callOpenAi(prompt: string, modelOverride?: string): Promise<LlmResult> {
  const url = `${BASE_URL.replace(/\/$/, '')}/chat/completions`
  const started = Date.now()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: modelOverride || MODEL,
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant d'archives intelligent et très convivial nommé ACS Assistant. Tu dois t'exprimer comme un humain naturel et amical, jamais comme un robot ou une IA.
      
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
      temperature: 0.8,
      max_tokens: 300,
    }),
  })

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

// Prompt système optimisé pour des réponses naturelles et contextuelles
const SYSTEM_PROMPT = `Tu es l'assistant ACS, un collègue sympa expert en archivage documentaire.

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
  conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
): Promise<LlmResult> {
  const url = `${MISTRAL_BASE_URL.replace(/\/$/, '')}/chat/completions`
  const started = Date.now()
  const model = useAdvancedModel ? MISTRAL_MODEL_ADVANCED : MISTRAL_MODEL_DEFAULT

  // Construire les messages avec l'historique
  const messages: Array<{role: string, content: string}> = [
    { role: 'system', content: SYSTEM_PROMPT }
  ]
  
  // Ajouter l'historique de conversation (8 derniers messages pour un meilleur contexte)
  for (const msg of conversationHistory.slice(-8)) {
    messages.push({ role: msg.role, content: msg.content })
  }
  
  // Ajouter la question actuelle
  messages.push({ role: 'user', content: prompt })

  console.log(`=== MISTRAL: ${messages.length} messages dans la conversation ===`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: model,
      messages,
      temperature: 0.7, // Un peu plus haut pour des réponses plus naturelles
      max_tokens: 250, // Un peu plus pour les conversations
    }),
  })

  const elapsed = Date.now() - started

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Mistral LLM (${response.status}) ${detail}`)
  }

  const json = (await response.json()) as {
    choices: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) {
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

  // Récupérer l'historique de conversation si sessionId fourni
  const conversationHistory = payload.sessionId 
    ? getConversationHistory(payload.sessionId).map(m => ({ role: m.role, content: m.content }))
    : []

  console.log(`=== LLM INFO: Provider = ${PROVIDER}, Historique = ${conversationHistory.length} messages ===`)

  const basePrompt = buildPrompt(payload)
  const prompt = enrichPromptWithLearning(basePrompt, payload.question)

  // Stratégie multi-modèles
  if (PROVIDER === 'mistral') {
    const complexity = estimateComplexity(payload)
    const useAdvancedModel = complexity > COMPLEXITY_THRESHOLD
    
    console.log(`=== MISTRAL: Complexité ${complexity}, modèle ${useAdvancedModel ? MISTRAL_MODEL_ADVANCED : MISTRAL_MODEL_DEFAULT} ===`)
    
    const result = await callMistral(prompt, useAdvancedModel, conversationHistory)
    
    // Sauvegarder dans l'historique (mémoire + persistance si token disponible)
    if (payload.sessionId) {
      if (payload.token) {
        // Avec persistance en base de données
        await addToConversationWithPersistence(payload.sessionId, 'user', payload.question, payload.token)
        await addToConversationWithPersistence(payload.sessionId, 'assistant', result.content, payload.token)
      } else {
        // Cache mémoire uniquement
        addToConversation(payload.sessionId, 'user', payload.question)
        addToConversation(payload.sessionId, 'assistant', result.content)
      }
    }
    
    return result
  }
  
  // Fallback à Mistral si configuré comme alternative
  if (isMistralConfigured() && !['openai', 'ollama', 'local', 'mistral'].includes(PROVIDER)) {
    console.log(`=== MISTRAL FALLBACK ===`)
    const result = await callMistral(prompt, false, conversationHistory)
    
    if (payload.sessionId) {
      if (payload.token) {
        await addToConversationWithPersistence(payload.sessionId, 'user', payload.question, payload.token)
        await addToConversationWithPersistence(payload.sessionId, 'assistant', result.content, payload.token)
      } else {
        addToConversation(payload.sessionId, 'user', payload.question)
        addToConversation(payload.sessionId, 'assistant', result.content)
      }
    }
    
    return result
  }

  // Providers compatibles OpenAI
  if (!['openai', 'ollama', 'local'].includes(PROVIDER)) {
    throw new Error(`Fournisseur LLM non pris en charge: ${PROVIDER}`)
  }

  const result = await callOpenAi(prompt)
  
  if (payload.sessionId) {
    if (payload.token) {
      await addToConversationWithPersistence(payload.sessionId, 'user', payload.question, payload.token)
      await addToConversationWithPersistence(payload.sessionId, 'assistant', result.content, payload.token)
    } else {
      addToConversation(payload.sessionId, 'user', payload.question)
      addToConversation(payload.sessionId, 'assistant', result.content)
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
