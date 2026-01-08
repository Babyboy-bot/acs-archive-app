/**
 * Gestion de la persistance des conversations de l'assistant.
 * Utilise le backend Django pour sauvegarder les messages.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

type ConversationMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

type Conversation = {
  id: string
  titre: string
  memoire_resume?: string
  memoire_etat?: Record<string, unknown>
  messages: ConversationMessage[]
  creeLe: string
  modifieLe: string
}

// Cache local pour éviter trop d'appels API
const localCache = new Map<string, ConversationMessage[]>()
const conversationIdCache = new Map<string, string>() // sessionId -> conversationId

type ConversationMemory = {
  conversationId: string
  memoire_resume: string
  memoire_etat: Record<string, unknown>
}

const memoryCache = new Map<string, { value: ConversationMemory; updatedAt: number }>()
const MEMORY_TTL_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Structure de mémoire enrichie pour ACS Archive
 * Basée sur les recommandations ChatGPT pour un système de contexte robuste
 */
export type StructuredMemory = {
  objectif_principal: string
  entites: {
    client: string | null
    annee: string | null
    risque: string | null
    type_document: string | null
  }
  documents: {
    mentionnes: string[]
    selectionne: string | null
  }
  resultats: {
    trouves: string[]
    absents: string[]
  }
  sujets_abordes: string[]
  dernieres_conclusions: string[]
  etat_conversation: 'salutation' | 'recherche_en_cours' | 'resultats_affiches' | 'question_generale' | 'hors_sujet'
}

/**
 * Crée une mémoire structurée vide
 */
export function createEmptyStructuredMemory(): StructuredMemory {
  return {
    objectif_principal: '',
    entites: {
      client: null,
      annee: null,
      risque: null,
      type_document: null,
    },
    documents: {
      mentionnes: [],
      selectionne: null,
    },
    resultats: {
      trouves: [],
      absents: [],
    },
    sujets_abordes: [],
    dernieres_conclusions: [],
    etat_conversation: 'salutation',
  }
}

/**
 * Met à jour la mémoire structurée avec les nouvelles informations
 */
export function updateStructuredMemory(
  current: StructuredMemory,
  update: {
    client?: string | null
    annee?: string | null
    risque?: string | null
    type_document?: string | null
    document_mentionne?: string
    document_selectionne?: string | null
    resultat_trouve?: string
    resultat_absent?: string
    sujet?: string
    conclusion?: string
    etat?: StructuredMemory['etat_conversation']
    objectif?: string
  }
): StructuredMemory {
  const newMemory = { ...current }
  
  // Mise à jour des entités (garde les anciennes si pas de nouvelle valeur)
  if (update.client !== undefined) newMemory.entites.client = update.client
  if (update.annee !== undefined) newMemory.entites.annee = update.annee
  if (update.risque !== undefined) newMemory.entites.risque = update.risque
  if (update.type_document !== undefined) newMemory.entites.type_document = update.type_document
  
  // Mise à jour des documents (limité à 5 derniers)
  if (update.document_mentionne) {
    newMemory.documents.mentionnes = [
      ...newMemory.documents.mentionnes.filter(d => d !== update.document_mentionne),
      update.document_mentionne
    ].slice(-5)
  }
  if (update.document_selectionne !== undefined) {
    newMemory.documents.selectionne = update.document_selectionne
  }
  
  // Mise à jour des résultats (limité à 3 derniers)
  if (update.resultat_trouve) {
    newMemory.resultats.trouves = [
      ...newMemory.resultats.trouves.filter(r => r !== update.resultat_trouve),
      update.resultat_trouve
    ].slice(-3)
  }
  if (update.resultat_absent) {
    newMemory.resultats.absents = [
      ...newMemory.resultats.absents.filter(r => r !== update.resultat_absent),
      update.resultat_absent
    ].slice(-3)
  }
  
  // Mise à jour des sujets (limité à 5 derniers)
  if (update.sujet) {
    newMemory.sujets_abordes = [
      ...newMemory.sujets_abordes.filter(s => s !== update.sujet),
      update.sujet
    ].slice(-5)
  }
  
  // Mise à jour des conclusions (limité à 3 dernières)
  if (update.conclusion) {
    newMemory.dernieres_conclusions = [
      ...newMemory.dernieres_conclusions,
      update.conclusion
    ].slice(-3)
  }
  
  // Mise à jour de l'état et objectif
  if (update.etat) newMemory.etat_conversation = update.etat
  if (update.objectif) newMemory.objectif_principal = update.objectif
  
  return newMemory
}

/**
 * Convertit la mémoire structurée en texte pour injection dans le prompt
 */
export function structuredMemoryToPrompt(memory: StructuredMemory): string {
  const parts: string[] = []
  
  if (memory.objectif_principal) {
    parts.push(`Objectif: ${memory.objectif_principal}`)
  }
  
  // Entités actives
  const entites: string[] = []
  if (memory.entites.client) entites.push(`Client: ${memory.entites.client}`)
  if (memory.entites.annee) entites.push(`Année: ${memory.entites.annee}`)
  if (memory.entites.risque) entites.push(`Risque: ${memory.entites.risque}`)
  if (memory.entites.type_document) entites.push(`Type doc: ${memory.entites.type_document}`)
  if (entites.length > 0) {
    parts.push(`Contexte actuel: ${entites.join(', ')}`)
  }
  
  // Document sélectionné
  if (memory.documents.selectionne) {
    parts.push(`Document en cours: ${memory.documents.selectionne}`)
  }
  
  // Sujets abordés
  if (memory.sujets_abordes.length > 0) {
    parts.push(`Sujets abordés: ${memory.sujets_abordes.join(', ')}`)
  }
  
  // Dernières conclusions
  if (memory.dernieres_conclusions.length > 0) {
    parts.push(`Points clés: ${memory.dernieres_conclusions.join(' | ')}`)
  }
  
  // État
  parts.push(`État: ${memory.etat_conversation}`)
  
  return parts.join('\n')
}

/**
 * Récupère ou crée une conversation pour un utilisateur
 */
export async function getOrCreateConversation(token: string, sessionId: string): Promise<string | null> {
  // Vérifier le cache local d'abord
  const cachedConversationId = conversationIdCache.get(sessionId)
  if (cachedConversationId) {
    return cachedConversationId
  }

  try {
    // Essayer de récupérer les conversations existantes
    const response = await fetch(`${API_BASE}/assistant/conversations/`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn('Impossible de récupérer les conversations:', response.status)
      return null
    }

    const data = await response.json()
    const conversations: any[] = Array.isArray(data) ? data : data?.results ?? []

    // Si une conversation est déjà associée au sessionId, la réutiliser
    const matching = conversations.find((c) => (c?.memoire_etat?.sessionId ?? c?.memoire_etat?.session_id) === sessionId)
    if (matching?.id) {
      conversationIdCache.set(sessionId, matching.id)
      return matching.id
    }

    // Créer une nouvelle conversation
    const createResponse = await fetch(`${API_BASE}/assistant/conversations/`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        titre: `Conversation ${new Date().toLocaleDateString('fr-FR')}`,
        memoire_etat: { sessionId },
      }),
    })

    if (!createResponse.ok) {
      console.warn('Impossible de créer une conversation:', createResponse.status)
      return null
    }

    const newConversation = await createResponse.json()
    conversationIdCache.set(sessionId, newConversation.id)
    return newConversation.id
  } catch (error) {
    console.error('Erreur lors de la gestion des conversations:', error)
    return null
  }
}

export async function getConversationMemoryPersistent(
  token: string,
  sessionId: string
): Promise<ConversationMemory | null> {
  const cached = memoryCache.get(sessionId)
  if (cached && Date.now() - cached.updatedAt < MEMORY_TTL_MS) {
    return cached.value
  }

  const conversationId = await getOrCreateConversation(token, sessionId)
  if (!conversationId) return null

  try {
    const response = await fetch(`${API_BASE}/assistant/conversations/${conversationId}/`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const convo = (await response.json()) as any
    const value: ConversationMemory = {
      conversationId,
      memoire_resume: typeof convo?.memoire_resume === 'string' ? convo.memoire_resume : '',
      memoire_etat: (convo?.memoire_etat && typeof convo.memoire_etat === 'object') ? convo.memoire_etat : {},
    }

    memoryCache.set(sessionId, { value, updatedAt: Date.now() })
    return value
  } catch (error) {
    console.error('Erreur lors de la récupération de la mémoire de conversation:', error)
    return null
  }
}

export async function updateConversationMemoryPersistent(
  token: string,
  sessionId: string,
  memoryPatch: { memoire_resume?: string; memoire_etat?: Record<string, unknown> }
): Promise<boolean> {
  const conversationId = await getOrCreateConversation(token, sessionId)
  if (!conversationId) return false

  try {
    const response = await fetch(`${API_BASE}/assistant/conversations/${conversationId}/`, {
      method: 'PATCH',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(memoryPatch),
    })

    if (!response.ok) {
      return false
    }

    const cached = memoryCache.get(sessionId)
    if (cached) {
      memoryCache.set(sessionId, {
        value: {
          conversationId,
          memoire_resume: memoryPatch.memoire_resume ?? cached.value.memoire_resume,
          memoire_etat: memoryPatch.memoire_etat ?? cached.value.memoire_etat,
        },
        updatedAt: Date.now(),
      })
    }

    return true
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la mémoire de conversation:', error)
    return false
  }
}

/**
 * Récupère l'historique des messages d'une conversation
 */
export async function getConversationMessages(
  token: string,
  conversationId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  try {
    const response = await fetch(
      `${API_BASE}/assistant/messages/?conversation=${conversationId}&limit=${limit}`,
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const messages = Array.isArray(data) ? data : data?.results ?? []

    return messages.map((m: any) => ({
      id: m.id,
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.contenu,
      timestamp: new Date(m.cree_le).getTime(),
      metadata: m.metadata,
    }))
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error)
    return []
  }
}

/**
 * Sauvegarde un message dans la conversation
 */
export async function saveMessage(
  token: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/assistant/messages/`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation: conversationId,
        role: role === 'user' ? 'USER' : 'ASSISTANT',
        contenu: content,
        metadata: metadata ?? {},
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du message:', error)
    return false
  }
}

/**
 * Récupère l'historique de conversation avec cache local + persistance
 */
export async function getConversationHistoryPersistent(
  token: string,
  sessionId: string
): Promise<ConversationMessage[]> {
  // 1. Vérifier le cache local d'abord (rapide)
  const cached = localCache.get(sessionId)
  if (cached && cached.length > 0) {
    return cached
  }

  // 2. Récupérer depuis la base de données
  const conversationId = await getOrCreateConversation(token, sessionId)
  if (!conversationId) {
    return []
  }

  const messages = await getConversationMessages(token, conversationId, 10)
  
  // 3. Mettre en cache localement
  if (messages.length > 0) {
    localCache.set(sessionId, messages)
  }

  return messages
}

/**
 * Ajoute un message à la conversation avec persistance
 */
export async function addMessagePersistent(
  token: string,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // 1. Ajouter au cache local immédiatement (pour la rapidité)
  const cached = localCache.get(sessionId) ?? []
  cached.push({ role, content, timestamp: Date.now(), metadata })
  
  // Garder seulement les 10 derniers messages
  if (cached.length > 10) {
    cached.splice(0, cached.length - 10)
  }
  localCache.set(sessionId, cached)

  // 2. Sauvegarder en base de données (en arrière-plan)
  const conversationId = await getOrCreateConversation(token, sessionId)
  if (conversationId) {
    // Ne pas attendre la sauvegarde pour ne pas ralentir la réponse
    saveMessage(token, conversationId, role, content, metadata).catch(err => {
      console.warn('Échec de la sauvegarde du message:', err)
    })
  }
}

/**
 * Efface le cache local d'une session
 */
export function clearLocalCache(sessionId: string): void {
  localCache.delete(sessionId)
  conversationIdCache.delete(sessionId)
}

// Cache local pour la mémoire structurée
const structuredMemoryCache = new Map<string, StructuredMemory>()

/**
 * Récupère la mémoire structurée d'une session
 */
export function getStructuredMemory(sessionId: string): StructuredMemory {
  return structuredMemoryCache.get(sessionId) ?? createEmptyStructuredMemory()
}

/**
 * Sauvegarde la mémoire structurée d'une session
 */
export function setStructuredMemory(sessionId: string, memory: StructuredMemory): void {
  structuredMemoryCache.set(sessionId, memory)
}

/**
 * Met à jour la mémoire après un échange complet (question + réponse)
 * C'est la fonction clé pour le résumé incrémental
 */
export async function updateMemoryAfterExchange(
  token: string,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  context: {
    client?: string | null
    annee?: string | null
    risque?: string | null
    type_document?: string | null
    documents_trouves?: number
    etat?: StructuredMemory['etat_conversation']
  }
): Promise<void> {
  // 1. Récupérer la mémoire structurée actuelle
  const currentMemory = getStructuredMemory(sessionId)
  
  // 2. Déterminer le sujet de la question
  let sujet = ''
  if (context.client) sujet = `Recherche ${context.client}`
  else if (context.type_document) sujet = `Documents ${context.type_document}`
  else if (userMessage.length < 50) sujet = userMessage.substring(0, 30)
  
  // 3. Déterminer la conclusion de l'échange
  let conclusion = ''
  if (context.documents_trouves !== undefined) {
    if (context.documents_trouves > 0) {
      conclusion = `${context.documents_trouves} doc(s) trouvé(s)`
      if (context.client) conclusion += ` pour ${context.client}`
    } else {
      conclusion = 'Aucun document trouvé'
      if (context.client) conclusion += ` pour ${context.client}`
    }
  }
  
  // 4. Mettre à jour la mémoire structurée
  const updatedMemory = updateStructuredMemory(currentMemory, {
    client: context.client,
    annee: context.annee,
    risque: context.risque,
    type_document: context.type_document,
    sujet: sujet || undefined,
    conclusion: conclusion || undefined,
    etat: context.etat,
    objectif: context.client ? `Recherche documentaire ${context.client}` : currentMemory.objectif_principal,
    resultat_trouve: context.documents_trouves && context.documents_trouves > 0 
      ? `${context.documents_trouves} documents` 
      : undefined,
    resultat_absent: context.documents_trouves === 0 
      ? (context.type_document || 'documents') 
      : undefined,
  })
  
  // 5. Sauvegarder en cache local
  setStructuredMemory(sessionId, updatedMemory)
  
  // 6. Persister en base de données (en arrière-plan)
  if (token) {
    const memoryPrompt = structuredMemoryToPrompt(updatedMemory)
    updateConversationMemoryPersistent(token, sessionId, {
      memoire_resume: memoryPrompt,
      memoire_etat: updatedMemory as unknown as Record<string, unknown>,
    }).catch(err => {
      console.warn('Échec de la mise à jour de la mémoire:', err)
    })
  }
}
