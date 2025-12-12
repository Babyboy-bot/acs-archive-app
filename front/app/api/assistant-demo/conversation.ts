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
  messages: ConversationMessage[]
  creeLe: string
  modifieLe: string
}

// Cache local pour éviter trop d'appels API
const localCache = new Map<string, ConversationMessage[]>()
const conversationIdCache = new Map<string, string>() // sessionId -> conversationId

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
    const conversations = Array.isArray(data) ? data : data?.results ?? []

    // Utiliser la conversation la plus récente ou en créer une nouvelle
    if (conversations.length > 0) {
      const latestConversation = conversations[0]
      conversationIdCache.set(sessionId, latestConversation.id)
      return latestConversation.id
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
