/**
 * Système d'apprentissage progressif pour l'assistant ACS
 * 
 * Ce module permet à l'assistant d'apprendre avec le temps en :
 * 1. Collectant les feedbacks utilisateurs (positif/négatif)
 * 2. Stockant les interactions réussies
 * 3. Identifiant les patterns de questions fréquentes
 * 4. Améliorant les réponses futures basées sur l'historique
 */

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackType = 'positive' | 'negative' | 'neutral'

export interface Interaction {
  id: string
  timestamp: Date
  question: string
  questionNormalized: string
  response: string
  intent: 'documents' | 'statistiques'
  typeMessage: string
  clientMentionne: string | null
  typeDocMentionne: string | null
  feedback: FeedbackType | null
  feedbackComment: string | null
  responseTimeMs: number
  llmUsed: boolean
  userId: string | null
}

export interface QuestionPattern {
  pattern: string
  examples: string[]
  bestResponses: string[]
  frequency: number
  avgFeedbackScore: number // -1 à 1
  lastUpdated: Date
}

export interface LearningStats {
  totalInteractions: number
  positiveRate: number
  negativeRate: number
  neutralRate: number
  mostAskedPatterns: QuestionPattern[]
  improvementSuggestions: string[]
}

// ============================================================================
// STOCKAGE EN MÉMOIRE (cache local + persistance backend)
// ============================================================================

const interactions: Map<string, Interaction> = new Map()
const questionPatterns: Map<string, QuestionPattern> = new Map()
const goodResponses: Map<string, string[]> = new Map() // pattern -> bonnes réponses

// Configuration
const MAX_INTERACTIONS = 10000
const MAX_PATTERNS = 500
const MIN_FREQUENCY_FOR_PATTERN = 3
const PATTERN_SIMILARITY_THRESHOLD = 0.7

// Configuration API Backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://backend:8000/api'
const API_BASE = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`

// ============================================================================
// PERSISTANCE BACKEND (async, non-bloquant)
// ============================================================================

/**
 * Persiste une interaction vers le backend (fire-and-forget)
 */
async function persistInteractionToBackend(
  interaction: Interaction,
  cookie: string | null
): Promise<void> {
  if (!cookie) return
  
  try {
    await fetch(`${API_BASE}assistant/learning/record/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        id: interaction.id,
        question: interaction.question,
        question_normalized: interaction.questionNormalized,
        response: interaction.response,
        intent: interaction.intent,
        type_message: interaction.typeMessage,
        client_mentionne: interaction.clientMentionne,
        type_doc_mentionne: interaction.typeDocMentionne,
        response_time_ms: interaction.responseTimeMs,
        llm_used: interaction.llmUsed,
      }),
    })
  } catch (error) {
    console.warn('[Learning] Échec persistance interaction:', error)
  }
}

/**
 * Persiste un pattern vers le backend (fire-and-forget)
 */
async function persistPatternToBackend(
  pattern: string,
  example: string,
  response: string,
  feedbackScore: number,
  cookie: string | null
): Promise<void> {
  if (!cookie) return
  
  try {
    await fetch(`${API_BASE}assistant/learning/patterns/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        pattern,
        example,
        response,
        feedback_score: feedbackScore,
      }),
    })
  } catch (error) {
    console.warn('[Learning] Échec persistance pattern:', error)
  }
}

/**
 * Récupère les interactions similaires depuis le backend
 */
export async function getSimilarFromBackend(
  questionNormalized: string,
  cookie: string | null
): Promise<{ question: string; response: string }[]> {
  if (!cookie) return []
  
  try {
    const response = await fetch(
      `${API_BASE}assistant/learning/similar/?q=${encodeURIComponent(questionNormalized)}&limit=3`,
      {
        headers: { cookie },
      }
    )
    
    if (!response.ok) return []
    
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.warn('[Learning] Échec récupération similaires:', error)
    return []
  }
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Génère un ID unique pour une interaction
 */
function generateInteractionId(): string {
  return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Normalise une question pour la comparaison de patterns
 */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retire les accents
    .replace(/[^\w\s]/g, ' ')         // Retire la ponctuation
    .replace(/\s+/g, ' ')             // Normalise les espaces
    .trim()
}

/**
 * Extrait les mots-clés importants d'une question
 */
function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'a', 'au', 'aux',
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se',
    'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cette', 'ces',
    'qui', 'que', 'quoi', 'dont', 'ou', 'comment', 'pourquoi', 'quand',
    'est', 'sont', 'suis', 'es', 'etre', 'avoir', 'ai', 'as', 'a', 'avons', 'avez', 'ont',
    'pour', 'dans', 'sur', 'avec', 'par', 'en', 'y',
    'moi', 'toi', 'lui', 'eux',
    'ne', 'pas', 'plus', 'moins', 'tres', 'bien', 'mal',
  ])
  
  const normalized = normalizeQuestion(question)
  return normalized
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.has(word))
}

/**
 * Calcule la similarité entre deux questions (0 à 1)
 */
export function calculateSimilarity(q1: string, q2: string): number {
  const keywords1 = new Set(extractKeywords(q1))
  const keywords2 = new Set(extractKeywords(q2))
  
  if (keywords1.size === 0 || keywords2.size === 0) return 0
  
  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)))
  const union = new Set([...keywords1, ...keywords2])
  
  return intersection.size / union.size // Jaccard similarity
}

/**
 * Trouve le pattern le plus proche d'une question
 */
function findClosestPattern(question: string): QuestionPattern | null {
  const normalized = normalizeQuestion(question)
  let bestMatch: QuestionPattern | null = null
  let bestScore = 0
  
  for (const pattern of questionPatterns.values()) {
    // Vérifier la similarité avec les exemples du pattern
    for (const example of pattern.examples) {
      const similarity = calculateSimilarity(normalized, example)
      if (similarity > bestScore && similarity >= PATTERN_SIMILARITY_THRESHOLD) {
        bestScore = similarity
        bestMatch = pattern
      }
    }
  }
  
  return bestMatch
}

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

/**
 * Enregistre une nouvelle interaction
 */
export function recordInteraction(data: {
  question: string
  response: string
  intent: 'documents' | 'statistiques'
  typeMessage: string
  clientMentionne?: string | null
  typeDocMentionne?: string | null
  responseTimeMs: number
  llmUsed: boolean
  userId?: string | null
}): string {
  // Nettoyage si on dépasse la limite
  if (interactions.size >= MAX_INTERACTIONS) {
    // Supprimer les plus anciennes
    const sorted = [...interactions.entries()]
      .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())
    for (let i = 0; i < 1000; i++) {
      interactions.delete(sorted[i][0])
    }
  }
  
  const id = generateInteractionId()
  const interaction: Interaction = {
    id,
    timestamp: new Date(),
    question: data.question,
    questionNormalized: normalizeQuestion(data.question),
    response: data.response,
    intent: data.intent,
    typeMessage: data.typeMessage,
    clientMentionne: data.clientMentionne ?? null,
    typeDocMentionne: data.typeDocMentionne ?? null,
    feedback: null,
    feedbackComment: null,
    responseTimeMs: data.responseTimeMs,
    llmUsed: data.llmUsed,
    userId: data.userId ?? null,
  }
  
  interactions.set(id, interaction)
  
  // Mettre à jour les patterns
  updatePatterns(interaction)
  
  return id
}

/**
 * Enregistre le feedback d'un utilisateur sur une interaction
 */
export function recordFeedback(
  interactionId: string,
  feedback: FeedbackType,
  comment?: string
): boolean {
  const interaction = interactions.get(interactionId)
  if (!interaction) return false
  
  interaction.feedback = feedback
  interaction.feedbackComment = comment ?? null
  
  // Si feedback positif, ajouter à la liste des bonnes réponses
  if (feedback === 'positive') {
    addGoodResponse(interaction.questionNormalized, interaction.response)
    updatePatternScore(interaction.questionNormalized, 1)
  } else if (feedback === 'negative') {
    updatePatternScore(interaction.questionNormalized, -1)
  }
  
  return true
}

/**
 * Met à jour les patterns de questions
 */
function updatePatterns(interaction: Interaction): void {
  const normalized = interaction.questionNormalized
  const keywords = extractKeywords(interaction.question).slice(0, 5).join(' ')
  
  if (!keywords) return
  
  // Chercher un pattern existant similaire
  const existingPattern = findClosestPattern(interaction.question)
  
  if (existingPattern) {
    // Mettre à jour le pattern existant
    existingPattern.frequency++
    existingPattern.lastUpdated = new Date()
    if (!existingPattern.examples.includes(normalized)) {
      existingPattern.examples.push(normalized)
      // Garder max 10 exemples
      if (existingPattern.examples.length > 10) {
        existingPattern.examples.shift()
      }
    }
  } else if (questionPatterns.size < MAX_PATTERNS) {
    // Créer un nouveau pattern
    const pattern: QuestionPattern = {
      pattern: keywords,
      examples: [normalized],
      bestResponses: [],
      frequency: 1,
      avgFeedbackScore: 0,
      lastUpdated: new Date(),
    }
    questionPatterns.set(keywords, pattern)
  }
}

/**
 * Met à jour le score d'un pattern basé sur le feedback
 */
function updatePatternScore(questionNormalized: string, delta: number): void {
  const pattern = findClosestPattern(questionNormalized)
  if (pattern) {
    // Moyenne mobile du score
    pattern.avgFeedbackScore = (pattern.avgFeedbackScore * 0.8) + (delta * 0.2)
    pattern.lastUpdated = new Date()
  }
}

/**
 * Ajoute une bonne réponse au cache
 */
function addGoodResponse(questionNormalized: string, response: string): void {
  const keywords = extractKeywords(questionNormalized).slice(0, 5).join(' ')
  if (!keywords) return
  
  const existing = goodResponses.get(keywords) ?? []
  if (!existing.includes(response)) {
    existing.push(response)
    // Garder max 5 bonnes réponses par pattern
    if (existing.length > 5) {
      existing.shift()
    }
    goodResponses.set(keywords, existing)
  }
}

/**
 * Récupère une bonne réponse passée pour une question similaire
 */
export function getSimilarGoodResponse(question: string): string | null {
  const normalized = normalizeQuestion(question)
  const keywords = extractKeywords(question).slice(0, 5).join(' ')
  
  // Chercher une réponse exacte
  const exact = goodResponses.get(keywords)
  if (exact && exact.length > 0) {
    return exact[exact.length - 1] // La plus récente
  }
  
  // Chercher une réponse similaire
  const pattern = findClosestPattern(question)
  if (pattern && pattern.bestResponses.length > 0) {
    return pattern.bestResponses[pattern.bestResponses.length - 1]
  }
  
  return null
}

/**
 * Génère des exemples contextuels pour enrichir le prompt LLM
 */
export function getContextualExamples(question: string, limit: number = 3): Array<{question: string, response: string}> {
  const examples: Array<{question: string, response: string}> = []
  const keywords = extractKeywords(question)
  
  // Trouver des interactions similaires avec feedback positif
  for (const interaction of interactions.values()) {
    if (interaction.feedback !== 'positive') continue
    
    const similarity = calculateSimilarity(question, interaction.question)
    if (similarity >= 0.5) {
      examples.push({
        question: interaction.question,
        response: interaction.response,
      })
      if (examples.length >= limit) break
    }
  }
  
  return examples
}

/**
 * Obtient des suggestions d'amélioration basées sur les patterns négatifs
 */
export function getImprovementSuggestions(): string[] {
  const suggestions: string[] = []
  
  // Patterns avec score négatif
  for (const pattern of questionPatterns.values()) {
    if (pattern.avgFeedbackScore < -0.3 && pattern.frequency >= MIN_FREQUENCY_FOR_PATTERN) {
      suggestions.push(
        `Pattern "${pattern.pattern}" a un score négatif (${pattern.avgFeedbackScore.toFixed(2)}). ` +
        `Fréquence: ${pattern.frequency}. Exemples: ${pattern.examples.slice(0, 2).join(', ')}`
      )
    }
  }
  
  return suggestions.slice(0, 10)
}

/**
 * Obtient les statistiques d'apprentissage
 */
export function getLearningStats(): LearningStats {
  let positive = 0
  let negative = 0
  let neutral = 0
  
  for (const interaction of interactions.values()) {
    if (interaction.feedback === 'positive') positive++
    else if (interaction.feedback === 'negative') negative++
    else if (interaction.feedback === 'neutral') neutral++
  }
  
  const total = interactions.size
  const feedbackTotal = positive + negative + neutral
  
  // Top patterns
  const sortedPatterns = [...questionPatterns.values()]
    .filter(p => p.frequency >= MIN_FREQUENCY_FOR_PATTERN)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)
  
  return {
    totalInteractions: total,
    positiveRate: feedbackTotal > 0 ? positive / feedbackTotal : 0,
    negativeRate: feedbackTotal > 0 ? negative / feedbackTotal : 0,
    neutralRate: feedbackTotal > 0 ? neutral / feedbackTotal : 0,
    mostAskedPatterns: sortedPatterns,
    improvementSuggestions: getImprovementSuggestions(),
  }
}

/**
 * Enrichit un prompt avec des exemples appris
 */
export function enrichPromptWithLearning(
  basePrompt: string,
  question: string
): string {
  const examples = getContextualExamples(question, 2)
  
  if (examples.length === 0) {
    return basePrompt
  }
  
  let enrichedPrompt = basePrompt + '\n\nVoici des exemples de bonnes réponses passées pour des questions similaires:\n'
  
  for (const example of examples) {
    enrichedPrompt += `\nQ: ${example.question}\nR: ${example.response}\n`
  }
  
  enrichedPrompt += '\nUtilise ces exemples comme inspiration pour ta réponse.'
  
  return enrichedPrompt
}

// ============================================================================
// API POUR LE FEEDBACK
// ============================================================================

/**
 * Endpoint data pour enregistrer le feedback (à appeler depuis l'API)
 */
export function processFeedbackRequest(data: {
  interactionId: string
  feedback: 'like' | 'dislike'
  comment?: string
}): { success: boolean; message: string } {
  const feedbackType: FeedbackType = data.feedback === 'like' ? 'positive' : 'negative'
  
  const success = recordFeedback(data.interactionId, feedbackType, data.comment)
  
  if (success) {
    return { success: true, message: 'Feedback enregistré, merci !' }
  } else {
    return { success: false, message: 'Interaction non trouvée' }
  }
}

// ============================================================================
// EXPORT DES DONNÉES POUR ANALYSE
// ============================================================================

/**
 * Exporte toutes les interactions pour analyse externe
 */
export function exportInteractions(): Interaction[] {
  return [...interactions.values()]
}

/**
 * Exporte tous les patterns pour analyse externe
 */
export function exportPatterns(): QuestionPattern[] {
  return [...questionPatterns.values()]
}
