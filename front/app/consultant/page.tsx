'use client'

import { FormEvent, useEffect, useState, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { getToken, getUtilisateurActif, SessionUtilisateur, supprimerSession } from '@/lib/session'
import { apiFetchJson } from '@/lib/api'
import { printBlob } from '@/lib/print'
import { RoleUtilisateur } from '@/types'
import { OnboardingGuide } from '@/components/OnboardingGuide'

interface PieceJustificativeMetadata extends Record<string, unknown> {
  url?: string
  nom_fichier?: string
  titre?: string
  description?: string
  date_document?: string
  date_document_formatee?: string
  client?: string
  exercice?: string
  type?: string
  highlights?: string[]
  fichier_url?: string
  type_fichier?: string
  risque?: string
}

interface PieceJustificative {
  id: string
  source: string
  content: string
  metadata: PieceJustificativeMetadata
  score: number
  isFallback?: boolean
  url?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  pieces?: PieceJustificative[]
  isError?: boolean
    interactionId?: string  // Pour le système de feedback 👍/👎
  feedbackGiven?: 'like' | 'dislike' | null
}

interface AssistantConversationSummary {
  id: string
  titre: string
  cree_le: string
  modifie_le: string
  dernier_message_le?: string | null
  nombre_messages?: number
}

// Réponses API typées pour l'assistant
type AssistantConversationListResponse =
  | AssistantConversationSummary[]
  | {
      results: AssistantConversationSummary[]
    }

interface AssistantMessageApi {
  id: string
  role: 'USER' | 'ASSISTANT' | string
  contenu: string
  cree_le?: string
  metadata?: Record<string, unknown> | null
}

type AssistantMessageListResponse =
  | AssistantMessageApi[]
  | {
      results: AssistantMessageApi[]
    }

interface DocumentListeApi {
  results?: Array<{
    id: string
    titre: string
    cree_le: string
    risque_detail?: {
      exercice_info?: {
        client?: string
      }
    } | null
  }>
}

interface DocumentDetailApi {
  fichier_url?: string | null
}


const LOCAL_STORAGE_KEY = 'acs-assistant-conversation-v1'
const ACTIVE_CONVERSATION_KEY = 'acs-assistant-active-conversation-id'

export default function ConsultantChatPage() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [typingIndicator, setTypingIndicator] = useState(false)
  const [utilisateur, setUtilisateur] = useState<SessionUtilisateur | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [dbExampleQuestion, setDbExampleQuestion] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme')
      if (stored === 'dark' || stored === 'light') return stored
    }
    return 'light'
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const isDark = theme === 'dark'

  useEffect(() => {
    setMounted(true);
    // Synchroniser le thème avec le localStorage dès le montage ou navigation
    const syncTheme = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('theme')
        if (stored === 'dark' || stored === 'light') setTheme(stored)
      }
    }
    syncTheme()
    window.addEventListener('storage', syncTheme)
    return () => window.removeEventListener('storage', syncTheme)
  }, [])

  useEffect(() => {
    const user = getUtilisateurActif()
    setUtilisateur(user)

    if (!user) return

    // Vérifier si c'est la première visite de l'assistant
    const hasSeenOnboarding = localStorage.getItem('acs-assistant-onboarding-seen')
    if (!hasSeenOnboarding) {
      setShowOnboarding(true)
    }

    const chargerConversations = async () => {
      try {
        const { data } = await apiFetchJson<AssistantConversationListResponse>('assistant/conversations/')
        const items = Array.isArray(data) ? data : data?.results ?? []
        setConversations(items)

        // Tenter de restaurer la conversation active depuis le localStorage
        if (typeof window !== 'undefined') {
          try {
            const savedId = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY)
            if (savedId && items.some((c: AssistantConversationSummary) => c.id === savedId)) {
              setConversationId(savedId)
            }
          } catch (error) {
            console.error("Erreur lors du chargement de la conversation active de l'assistant:", error)
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des conversations de l'assistant:", error)
      }
    }

    void chargerConversations()
  }, [router])

  // Charger une question d'exemple basée sur un client réel de la base (documents récents)
  useEffect(() => {
    const chargerExempleDepuisBdd = async () => {
      try {
        const { data } = await apiFetchJson<DocumentListeApi>('documents/?page_size=10&ordering=-cree_le')
        const docs = (data?.results ?? []) as NonNullable<DocumentListeApi['results']>
        const docAvecClient = docs.find(
          (d) => d?.risque_detail?.exercice_info && typeof d.risque_detail.exercice_info.client === 'string',
        )
        if (docAvecClient && docAvecClient.risque_detail && docAvecClient.risque_detail.exercice_info) {
          const clientNom = docAvecClient.risque_detail.exercice_info.client
          if (clientNom && typeof clientNom === 'string') {
            setDbExampleQuestion(`Montre-moi les documents concernant le client ${clientNom}.`)
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la question d\'exemple depuis la BDD:', error)
      }
    }

    void chargerExempleDepuisBdd()
  }, [])

  const handleCloseOnboarding = () => {
    setShowOnboarding(false)
    localStorage.setItem('acs-assistant-onboarding-seen', 'true')
  }

  // Charger l'historique de conversation depuis localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as Array<
        Omit<Message, 'timestamp'> & { timestamp: string }
      >

      const restored: Message[] = parsed.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }))

      if (restored.length > 0) {
        setMessages(restored)
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique de conversation:', error)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Sauvegarder l'historique à chaque mise à jour des messages
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const serialisable = messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }))
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serialisable))
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'historique de conversation:', error)
    }
  }, [messages])

  const handleLogout = () => {
    supprimerSession()
    router.push('/connexion')
  }

  const buildFileUrl = (fichierUrl: string): string => {
    if (!fichierUrl) return fichierUrl
    if (!fichierUrl.startsWith('/')) return fichierUrl

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api'
    const backendOrigin = apiBase.replace(/\/+$/, '').replace(/\/api$/, '')
    return `${backendOrigin}${fichierUrl}`
  }

  const telechargerPiece = async (piece: PieceJustificative) => {
    try {
      const fichierUrl = piece.metadata?.fichier_url
      if (!fichierUrl) {
        alert('Ce document n\'a pas de fichier téléchargeable')
        return
      }

      const finalUrl = buildFileUrl(fichierUrl)

      const headers: Record<string, string> = {
        'Accept': 'application/octet-stream, application/pdf, image/*, */*',
      }

      const response = await fetch(finalUrl, { method: 'GET', headers, credentials: 'include' })
      if (!response.ok) throw new Error(`Erreur ${response.status}`)

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = piece.metadata?.titre || `document-${piece.id}`
      document.body.appendChild(lien)
      lien.click()
      document.body.removeChild(lien)
      setTimeout(() => window.URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error('Erreur téléchargement:', error)
      alert('Erreur lors du téléchargement')
    }
  }

  const ouvrirPiece = async (piece: PieceJustificative) => {
    try {
      let fichierUrl = piece.metadata?.fichier_url as string | undefined | null

      // Fallback : si l'URL n'est pas présente dans les métadonnées (anciennes conversations),
      // on récupère le document complet via l'API /documents/<id>/
      if (!fichierUrl) {
        try {
          const { data } = await apiFetchJson<DocumentDetailApi>(`documents/${piece.id}/`)
          fichierUrl = data?.fichier_url ?? null
        } catch (error) {
          console.error("Erreur lors de la récupération du document pour ouverture:", error)
        }
      }

      if (!fichierUrl) {
        alert("Ce document n'a pas de fichier à ouvrir")
        return
      }

      const finalUrl = buildFileUrl(fichierUrl)

      window.open(finalUrl, '_blank')
    } catch (error) {
      console.error("Erreur lors de l'ouverture du document:", error)
      alert("Impossible d'ouvrir ce document pour le moment")
    }
  }

  const imprimerPiece = async (piece: PieceJustificative) => {
    try {
      const fichierUrl = piece.metadata?.fichier_url
      if (!fichierUrl) {
        alert("Ce document n'a pas de fichier imprimable")
        return
      }

      const finalUrl = buildFileUrl(fichierUrl)
      const proxyUrl = `/api/proxy/document?url=${encodeURIComponent(finalUrl)}`

      const headers = new Headers({ Accept: 'application/pdf,image/*' })

      const response = await fetch(proxyUrl, {
        method: 'GET',
        credentials: 'include',
        headers,
      })

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`)
      }

      const blob = await response.blob()

      await printBlob({
        blob,
        title: (piece.metadata?.titre as string) || 'Document',
        mimeType: response.headers.get('content-type'),
        sourceUrl: finalUrl,
        fallbackUrl: finalUrl,
      })
    } catch (error) {
      console.error("Erreur lors de l'impression :", error)
      alert("Impossible d'imprimer ce document pour le moment")
      const fichierUrl = piece.metadata?.fichier_url
      if (fichierUrl) {
        const finalUrl = buildFileUrl(fichierUrl)
        window.open(finalUrl, '_blank', 'noopener,noreferrer')
      }
    }
  }

  const envoyerMessage = async (e: FormEvent) => {
    e.preventDefault()
    const question = input.trim()
    if (!question || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const utilisateur = getUtilisateurActif()

      let currentConversationId = conversationId

      // Si l'ID de conversation n'est pas en mémoire (ex : rechargement / hot reload),
      // essayer de le récupérer depuis le localStorage.
      if (!currentConversationId && typeof window !== 'undefined') {
        try {
          const savedId = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY)
          if (savedId) {
            currentConversationId = savedId
            setConversationId(savedId)
          }
        } catch (error) {
          console.error("Erreur lors de la restauration de la conversation active de l'assistant:", error)
        }
      }
      try {
        const titrePropose = userMessage.content.length > 100 ? userMessage.content.slice(0, 100) : userMessage.content

        if (!currentConversationId) {
          const { data } = await apiFetchJson<AssistantConversationSummary>('assistant/conversations/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titre: titrePropose }),
          })

          if (data && data.id) {
            currentConversationId = data.id as string
            setConversationId(currentConversationId)
            if (typeof window !== 'undefined') {
              try {
                window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, currentConversationId)
              } catch (error) {
                console.error("Erreur lors de la sauvegarde de la conversation active de l'assistant:", error)
              }
            }
            setConversations((prev) => {
              const existe = prev.find((c) => c.id === currentConversationId)
              if (existe) return prev
              return [data as AssistantConversationSummary, ...prev]
            })
          }
        } else if (titrePropose && !conversations.find((c) => c.id === currentConversationId && c.titre)) {
          setConversations((prev) =>
            prev.map((c) => (c.id === currentConversationId ? { ...c, titre: c.titre || titrePropose } : c))
          )
        }

        if (currentConversationId) {
          await apiFetchJson<unknown>('assistant/messages/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversation: currentConversationId,
              role: 'USER',
              contenu: question,
              metadata: {},
            }),
          })
        }
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de la conversation de l'assistant (message utilisateur):", error)
      }

      const response = await fetch('/api/assistant-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(utilisateur?.role && { 'x-user-role': utilisateur.role }),
        },
        credentials: 'include',
        body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        throw new Error('Erreur serveur')
      }

      const data = await response.json()

      // Normaliser les pièces justificatives
      let pieces: PieceJustificative[] = []
      if (data.pieces && Array.isArray(data.pieces)) {
        pieces = data.pieces.map((p: any, i: number) => ({
          id: p.id || `piece-${i}`,
          source: p.source || '',
          content: p.content || '',
          metadata: p.metadata || {},
          score: p.score || 0,
          isFallback: p.isFallback || false,
        }))
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.narration?.texte || data.resume || 'Je n\'ai pas trouvé de résultat.',
        timestamp: new Date(),
        // N'inclure les pièces que si elles existent vraiment
        ...(pieces && pieces.length > 0 ? { pieces } : {}),
                // ID pour le système de feedback/apprentissage
        interactionId: data.interactionId,
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (currentConversationId) {
        try {
          await apiFetchJson<any>('assistant/messages/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversation: currentConversationId,
              role: 'ASSISTANT',
              contenu: assistantMessage.content,
              metadata: {
                pieces,
                trace: data.trace,
                interactionId: data.interactionId,
              },
            }),
          })
        } catch (error) {
          console.error("Erreur lors de la sauvegarde de la conversation de l'assistant (réponse):", error)
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        timestamp: new Date(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const supprimerConversation = async (id: string) => {
    if (!id) return

    const confirmation = window.confirm('Supprimer cette conversation ?')
    if (!confirmation) return

    try {
      await apiFetchJson<unknown>(`assistant/conversations/${id}/`, {
        method: 'DELETE',
      })

      setConversations((prev) => prev.filter((c) => c.id !== id))

      if (conversationId === id) {
        setConversationId(null)
        setMessages([])
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY)
            window.localStorage.removeItem(LOCAL_STORAGE_KEY)
          } catch (error) {
            console.error("Erreur lors du nettoyage de la conversation active de l'assistant:", error)
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la conversation de l\'assistant:', error)
      alert('Impossible de supprimer cette conversation pour le moment.')
    }
  }

  
  // Fonction pour envoyer le feedback sur une réponse de l'assistant
  const handleFeedback = async (messageId: string, interactionId: string, feedback: 'like' | 'dislike') => {
    try {
      const response = await fetch('/api/assistant-demo/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          interactionId,
          feedback,
        }),
      })
      
      if (response.ok) {
        // Mettre à jour le message pour afficher le feedback
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, feedbackGiven: feedback }
            : msg
        ))
        console.log(`Feedback ${feedback} envoyé pour ${interactionId}`)
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du feedback:', error)
    }
  }

  // Générer des suggestions rapides basées sur la réponse de l'assistant
  
  const chargerConversation = async (id: string) => {
    if (!id || id === conversationId) return

    setIsLoading(true)
    try {
      const { data } = await apiFetchJson<AssistantMessageListResponse>(`assistant/messages/?conversation=${id}`)
      const items = Array.isArray(data) ? data : data?.results ?? []

      const nouveauxMessages: Message[] = items.map((m: AssistantMessageApi) => {
        const apiRole = (m.role as string) || 'ASSISTANT'
        const role: 'user' | 'assistant' = apiRole === 'USER' ? 'user' : 'assistant'
        const timestamp = m.cree_le ? new Date(m.cree_le as string) : new Date()
        const metadata = (m.metadata as Record<string, unknown> | null) ?? {}

        let pieces: PieceJustificative[] | undefined
        const rawPieces = (metadata as any).pieces as any[] | undefined
        if (Array.isArray(rawPieces) && rawPieces.length > 0) {
          pieces = rawPieces.map((p: any, index: number) => ({
            id: p.id || `piece-${index}`,
            source: p.source || '',
            content: p.content || '',
            metadata: p.metadata || {},
            score: p.score || 0,
            isFallback: p.isFallback || false,
          }))
        }

        return {
          id: (m.id as string) || `${role}-${timestamp.getTime()}`,
          role,
          content: (m.contenu as string) || '',
          timestamp,
          ...(pieces ? { pieces } : {}),
        }
      })

      setConversationId(id)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, id)
        } catch (error) {
          console.error("Erreur lors de la sauvegarde de la conversation active de l'assistant:", error)
        }
      }
      setMessages(nouveauxMessages)
    } catch (error) {
      console.error("Erreur lors du chargement de la conversation de l'assistant:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const nouvelleConversation = () => {
    setMessages([])
    setConversationId(null)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY)
        window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY)
      } catch (error) {
        console.error('Erreur lors de la réinitialisation de l\'historique de conversation:', error)
      }
    }
  }

  if (!mounted) return null;
  return (
    <div className={`flex h-screen ${isDark ? 'bg-[#343541] text-white' : 'bg-theme-base text-theme-primary'}`}>
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } flex-shrink-0 overflow-hidden transition-all duration-300 ${
          isDark ? 'bg-[#202123]' : 'bg-theme-card border-r border-theme'
        }`}
      >
        <div className="flex flex-col h-full p-2">
          {/* Nouveau chat */}
          <button
            onClick={nouvelleConversation}
            className={`flex items-center gap-3 w-full px-3 py-3 rounded-md text-sm mb-2 border transition-colors ${
              isDark
                ? 'border-white/20 text-white hover:bg-theme-card/10'
                : 'border-theme text-theme-primary bg-theme-card hover:bg-theme-card'
            }`}
          >
            <Icon name="plus" size="sm" />
            Nouvelle conversation
          </button>

          {/* Historique (placeholder) */}
          <div className="flex-1 overflow-y-auto">
            <div className="text-xs text-gray-500 px-3 py-2">Conversations</div>
            {conversations.map((conv) => (
              <div key={conv.id} className="px-2 mb-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => chargerConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      chargerConversation(conv.id)
                    }
                  }}
                  className={`group w-full flex items-center justify-between gap-2 px-2 py-2 text-sm rounded ${
                    conv.id === conversationId
                      ? isDark
                        ? 'bg-theme-card/10 text-white'
                        : 'bg-theme-base text-theme-primary'
                      : isDark
                        ? 'text-gray-300 hover:bg-theme-card/10'
                        : 'text-theme-secondary hover:bg-theme-card'
                  }`}
                >
                  <span className="flex-1 truncate text-left">{conv.titre || 'Nouvelle conversation'}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void supprimerConversation(conv.id)
                    }}
                    className={`p-1 rounded transition-colors ${
                      isDark
                        ? 'text-gray-400 hover:text-red-400 hover:bg-theme-card/5'
                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                    aria-label="Supprimer la conversation"
                  >
                    <Icon name="trash" size="xs" />
                  </button>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className={isDark ? 'px-3 py-2 text-xs text-gray-500' : 'px-3 py-2 text-xs text-gray-400'}>
                Aucune conversation pour le moment.
              </div>
            )}
          </div>

          {/* Utilisateur */}
          <div className={isDark ? 'border-t border-white/20 pt-2' : 'border-t border-theme pt-2'}>
            <div
              className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors ${
                isDark ? 'hover:bg-theme-card/10' : 'hover:bg-theme-base'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                {(utilisateur?.prenom?.[0] || utilisateur?.nom?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isDark ? 'text-white' : 'text-theme-primary'}`}>
                  {utilisateur?.prenom} {utilisateur?.nom}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {utilisateur?.role === 'ADMIN' ? 'Administrateur' : 'Consultant'}
                </p>
              </div>
            </div>

            {utilisateur?.role === 'ADMIN' && (
              <button
                onClick={() => router.push('/tableau-de-bord')}
                className={`mt-1 flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md transition-colors ${
                  isDark
                    ? 'text-gray-300 hover:text-white hover:bg-theme-card/10'
                    : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-base'
                }`}
              >
                <Icon name="home" size="sm" />
                Retour au tableau de bord
              </button>
            )}

            <button
              onClick={handleLogout}
              className={`mt-1 flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md transition-colors ${
                isDark
                  ? 'text-gray-400 hover:text-white hover:bg-theme-card/10'
                  : 'text-gray-500 hover:text-theme-primary hover:bg-theme-base'
              }`}
            >
              <Icon name="logout" size="sm" />
              Se déconnecter
            </button>
          </div>
        </div>
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col relative">
        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute top-4 left-4 z-10 p-2 rounded-md transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-white hover:bg-theme-card/10'
              : 'text-gray-500 hover:text-theme-primary hover:bg-theme-base'
          }`}
        >
          <Icon name={sidebarOpen ? 'chevron-left' : 'menu'} size="sm" />
        </button>

        {/* Bouton Aide */}
        <button
          onClick={() => setShowOnboarding(true)}
          className={`absolute top-4 right-16 z-10 p-2 rounded-md transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-white hover:bg-theme-card/10'
              : 'text-gray-500 hover:text-theme-primary hover:bg-theme-base'
          }`}
          aria-label="Aide"
          title="Guide d'utilisation"
        >
          <Icon name="bell" size="sm" />
        </button>

        {/* Toggle thème clair/sombre */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={`absolute top-4 right-4 z-10 p-2 rounded-md transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-white hover:bg-theme-card/10'
              : 'text-gray-500 hover:text-theme-primary hover:bg-theme-base'
          }`}
          aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size="sm" />
        </button>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            // Écran de bienvenue
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-blue-600 flex items-center justify-center mb-6">
                <Icon name="sparkles" size="lg" className="text-white" />
              </div>
              <h1
                className={`text-3xl font-semibold mb-2 ${
                  isDark ? 'text-white' : 'text-theme-primary'
                }`}
              >
                Assistant Archives ACS
              </h1>
              <p
                className={`text-center max-w-md mb-8 ${
                  isDark ? 'text-gray-400' : 'text-theme-secondary'
                }`}
              >
                Posez-moi une question sur vos documents, contrats ou pièces justificatives.
                Je suis là pour vous aider !
              </p>
              {/* Suggestions de questions */}
              <div className="flex flex-col items-stretch gap-3 w-full max-w-xl">
                <p className={isDark ? 'text-gray-400 text-sm mb-1' : 'text-gray-500 text-sm mb-1'}>
                  Idées de questions que vous pouvez poser :
                </p>

                {/* 1) Question sur documents ACS, basée si possible sur un vrai client extrait de la BDD */}
                <button
                  type="button"
                  onClick={() => setInput(dbExampleQuestion ?? 'Montre-moi les documents récents pour un client précis.')} 
                  className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'border-gray-600 bg-[#2a2b32] hover:bg-[#343541] text-gray-100'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
                  }`}
                  disabled={!dbExampleQuestion}
                >
                  <span className="font-medium block mb-1">Rechercher des documents ACS pour un client réel</span>
                  <span className="block text-xs opacity-80">
                    {dbExampleQuestion
                      ? dbExampleQuestion
                      : "Chargement d'un exemple de client depuis la base..."}
                  </span>
                </button>

                {/* 2) Question sur le fonctionnement d'ACS (hors documents précis) */}
                <button
                  type="button"
                  onClick={() => setInput('Comment ACS classe les documents d\'un nouveau client et par quel critère je peux les retrouver facilement ?')}
                  className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'border-gray-600 bg-[#2a2b32] hover:bg-[#343541] text-gray-100'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span className="font-medium block mb-1">Comprendre le fonctionnement des archives ACS</span>
                  <span className="block text-xs opacity-80">Par exemple : comment les documents sont organisés et retrouvés dans ACS.</span>
                </button>

                {/* 3) Question métier assurance / courtage */}
                <button
                  type="button"
                  onClick={() => setInput('Explique-moi simplement la différence entre une franchise absolue et une franchise relative en assurance.')}
                  className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'border-gray-600 bg-[#2a2b32] hover:bg-[#343541] text-gray-100'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span className="font-medium block mb-1">Poser une question métier assurance / courtage</span>
                  <span className="block text-xs opacity-80">Par exemple : demander une explication sur un concept d\'assurance.</span>
                </button>
              </div>

            </div>
          ) : (
            // Conversation
            <div className="max-w-3xl mx-auto w-full py-8 px-4">
              <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="py-3 mb-2"
                  data-message-id={message.id}
                >
                  <div className="flex gap-4 max-w-3xl mx-auto">
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-sm flex-shrink-0 flex items-center justify-center ${
                        message.role === 'user'
                          ? 'bg-blue-600'
                          : 'bg-gradient-to-br from-red-500 to-blue-600'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <span className="text-white text-sm font-medium">
                          {(utilisateur?.prenom?.[0] || 'U').toUpperCase()}
                        </span>
                      ) : (
                        <Icon name="sparkles" size="sm" className="text-white" />
                      )}
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`rounded-2xl px-4 py-3 transition-colors border ${
                          message.role === 'assistant'
                            ? isDark
                              ? 'bg-[#444654] border-white/10 text-white'
                              : 'bg-white border-gray-200 shadow-sm text-theme-primary'
                            : isDark
                              ? 'bg-[#343541] border-white/5 text-gray-100'
                              : 'bg-[#f9fafb] border-gray-200 text-gray-900'
                        }`}
                      >
                        <p
                          className={
                            'whitespace-pre-wrap leading-relaxed text-sm sm:text-[15px]'
                          }
                        >
                          {message.content}
                        </p>

                        {/* Pièces justificatives */}
                        {message.pieces && message.pieces.length > 0 && (
                          <div
                            className={`mt-4 space-y-3 border-t pt-3 ${
                              isDark ? 'border-white/10' : 'border-gray-200'
                            }`}
                          >
                            <p
                              className={`text-sm flex items-center gap-2 ${
                                isDark ? 'text-gray-300' : 'text-gray-600'
                              }`}
                            >
                              <Icon name="document" size="xs" />
                              {message.pieces.length} pièce{message.pieces.length > 1 ? 's' : ''} justificative{message.pieces.length > 1 ? 's' : ''}
                            </p>
                            <div className="grid gap-3">
                              {message.pieces.map((piece) => (
                                <div
                                  key={piece.id}
                                  onClick={() => {
                                    void ouvrirPiece(piece)
                                  }}
                                  className={`rounded-xl p-4 border cursor-pointer transition-colors ${
                                    isDark
                                      ? 'bg-[#2d2d3a] border-white/10 hover:bg-[#3a3b46]'
                                      : 'bg-white border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h4
                                        className={`font-medium truncate ${
                                          isDark ? 'text-white' : 'text-theme-primary'
                                        }`}
                                      >
                                        {piece.metadata?.titre || piece.source || 'Document'}
                                      </h4>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {piece.metadata?.client && (
                                          <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-1 rounded-full">
                                            {piece.metadata.client}
                                          </span>
                                        )}
                                        {piece.metadata?.risque && (
                                          <span className="text-xs bg-purple-500/15 text-purple-400 px-2 py-1 rounded-full">
                                            {piece.metadata.risque}
                                          </span>
                                        )}
                                        {piece.metadata?.type && (
                                          <span className="text-xs bg-green-500/15 text-green-400 px-2 py-1 rounded-full">
                                            {piece.metadata.type}
                                          </span>
                                        )}
                                        {piece.metadata?.date_document_formatee && (
                                          <span className="text-xs bg-gray-500/10 text-gray-400 px-2 py-1 rounded-full">
                                            {piece.metadata.date_document_formatee}
                                          </span>
                                        )}
                                      </div>
                                      {(() => {
                                        const brut = piece.content || ''
                                        const lignesFiltrees = brut
                                          .split('\n')
                                          .filter((ligne) => {
                                            const trimmed = ligne.trim()
                                            if (!trimmed) return false
                                            if (trimmed.startsWith('Client :')) return false
                                            if (trimmed.startsWith('Type de courrier :')) return false
                                            return true
                                          })
                                        const contenuAffiche = lignesFiltrees.join('\n').trim()
                                        if (!contenuAffiche) return null
                                        return (
                                          <p
                                            className={`text-sm mt-2 line-clamp-2 ${
                                              isDark ? 'text-gray-300' : 'text-gray-600'
                                            }`}
                                          >
                                            {contenuAffiche}
                                          </p>
                                        )
                                      })()}
                                    </div>

                                    {/* Actions supprimées pour épurer l'interface des cartes de pièces justificatives */}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Feedback Buttons - Système d'apprentissage */}
                        {message.role === 'assistant' && message.interactionId && !message.isError && (
                          <div className={`mt-4 pt-3 border-t flex flex-wrap items-center gap-3 ${
                            isDark ? 'border-white/10' : 'border-gray-200'
                          }`}>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Cette réponse vous a-t-elle aidé ?
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleFeedback(message.id, message.interactionId!, 'like')}
                                disabled={message.feedbackGiven !== undefined && message.feedbackGiven !== null}
                                className={`p-1.5 rounded-md transition-all ${
                                  message.feedbackGiven === 'like'
                                    ? 'bg-green-500/20 text-green-500'
                                    : message.feedbackGiven
                                      ? 'opacity-30 cursor-not-allowed text-gray-400'
                                      : isDark
                                        ? 'hover:bg-green-500/20 text-gray-400 hover:text-green-500'
                                        : 'hover:bg-green-100 text-gray-400 hover:text-green-600'
                                }`}
                                title="Bonne réponse"
                              >
                                  👍
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, message.interactionId!, 'dislike')}
                                disabled={message.feedbackGiven !== undefined && message.feedbackGiven !== null}
                                className={`p-1.5 rounded-md transition-all ${
                                  message.feedbackGiven === 'dislike'
                                    ? 'bg-red-500/20 text-red-500'
                                    : message.feedbackGiven
                                      ? 'opacity-30 cursor-not-allowed text-gray-400'
                                      : isDark
                                        ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-500'
                                        : 'hover:bg-red-100 text-gray-400 hover:text-red-600'
                                }`}
                                title="Mauvaise réponse"
                              >
                                  👎
                              </button>
                            </div>
                            {message.feedbackGiven && (
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                Merci pour votre retour !
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>

              {/* Loading indicator */}
              {isLoading && (
                <div
                  className={`py-6 -mx-4 px-4 rounded-lg ${
                    isDark ? 'bg-[#444654]' : 'bg-theme-card'
                  }`}
                >
                  <div className="flex gap-4 max-w-3xl mx-auto">
                    <div className="w-8 h-8 rounded-sm flex-shrink-0 bg-gradient-to-br from-red-500 to-blue-600 flex items-center justify-center">
                      <Icon name="sparkles" size="sm" className="text-white" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <div className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5 }}
                        >
                          L'assistant réfléchit...
                        </motion.span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Zone de saisie */}
        <div
          className={`border-t p-4 ${
            isDark ? 'border-white/20 bg-[#343541]' : 'border-theme bg-theme-card'
          }`}
        >
          <form onSubmit={envoyerMessage} className="max-w-3xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isLoading ? "L'assistant réfléchit..." : "Envoyez un message..."}
              disabled={isLoading}
              className={`w-full rounded-xl py-4 pl-4 pr-12 outline-none border transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-[#40414f] text-white placeholder-gray-400 border-white/10 focus:border-white/30'
                  : 'bg-theme-card text-theme-primary placeholder-gray-400 border-theme focus:border-blue-500'
              }`}
              onFocus={() => {
                // Scroll to bottom when input is focused
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              onKeyDown={(e) => {
                // Scroll to bottom when typing
                if (e.key !== 'Tab' && e.key !== 'Shift') {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }, 100)
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-500 hover:text-theme-primary'
              }`}
            >
              <Icon name="arrow-right" size="sm" />
            </button>
          </form>
          <p className="text-xs text-gray-500 text-center mt-2">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            >
              Assistant Archives ACS - Recherche intelligente dans vos documents
            </motion.span>
          </p>
        </div>
      </div>

      {/* Guide d'onboarding */}
      {showOnboarding && (
        <OnboardingGuide onClose={handleCloseOnboarding} autoShow={showOnboarding} />
      )}
    </div>
  )
}
