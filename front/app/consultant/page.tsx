'use client'

import { FormEvent, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { getToken, getUtilisateurActif, SessionUtilisateur, supprimerSession } from '@/lib/session'
import { apiFetchJson } from '@/lib/api'
import { RoleUtilisateur } from '@/types'

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
}

interface AssistantConversationSummary {
  id: string
  titre: string
  cree_le: string
  modifie_le: string
  dernier_message_le?: string | null
  nombre_messages?: number
}

const SUGGESTIONS = [
  'Quels sont les derniers avenants de 2025 ?',
  'Montre-moi les documents du client SANLAM',
  'Quels contrats arrivent à échéance ce mois ?',
]

const LOCAL_STORAGE_KEY = 'acs-assistant-conversation-v1'
const ACTIVE_CONVERSATION_KEY = 'acs-assistant-active-conversation-id'

export default function ConsultantChatPage() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [utilisateur, setUtilisateur] = useState<SessionUtilisateur | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
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

    const chargerConversations = async () => {
      try {
        const { data } = await apiFetchJson<any>('assistant/conversations/')
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
  }, [])

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

      const token = getToken()
      const headers: Record<string, string> = {
        'Accept': 'application/octet-stream, application/pdf, image/*, */*',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(finalUrl, { method: 'GET', headers })
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
          const { data } = await apiFetchJson<any>(`documents/${piece.id}/`)
          fichierUrl = (data?.fichier_url as string | undefined) ?? null
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

  const imprimerPiece = (piece: PieceJustificative) => {
    const fichierUrl = piece.metadata?.fichier_url
    if (!fichierUrl) {
      alert("Ce document n'a pas de fichier imprimable")
      return
    }

    const finalUrl = buildFileUrl(fichierUrl)

    const printWindow = window.open(finalUrl, '_blank')
    if (!printWindow) {
      alert("Impossible d'ouvrir le document pour impression")
      return
    }

    printWindow.onload = () => {
      try {
        printWindow.print()
      } catch (error) {
        console.error("Erreur lors de l'impression :", error)
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
      const token = getToken()
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
          const { data } = await apiFetchJson<any>('assistant/conversations/', {
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
          await apiFetchJson<any>('assistant/messages/', {
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
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(utilisateur?.role && { 'x-user-role': utilisateur.role }),
        },
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
        pieces,
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
              metadata: { pieces },
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
      await apiFetchJson<any>(`assistant/conversations/${id}/`, {
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

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  const chargerConversation = async (id: string) => {
    if (!id || id === conversationId) return

    setIsLoading(true)
    try {
      const { data } = await apiFetchJson<any>(`assistant/messages/?conversation=${id}`)
      const items = Array.isArray(data) ? data : data?.results ?? []

      const nouveauxMessages: Message[] = items.map((m: any) => {
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

              {/* Suggestions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl w-full">
                {SUGGESTIONS.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`p-4 rounded-xl text-left text-sm transition-colors ${
                      isDark
                        ? 'border border-white/20 text-gray-300 hover:bg-theme-card/5'
                        : 'border border-theme bg-theme-card text-theme-primary hover:bg-theme-card'
                    }`}
                  >
                    <Icon
                      name="sparkles"
                      size="xs"
                      className={isDark ? 'text-gray-400 mb-2' : 'text-gray-500 mb-2'}
                    />
                    <p>{suggestion}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Conversation
            <div className="max-w-3xl mx-auto w-full py-8 px-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`py-6 -mx-4 px-4 rounded-lg mb-4 ${
                    message.role === 'assistant'
                      ? isDark
                        ? 'bg-[#444654]'
                        : 'bg-theme-card'
                      : 'bg-transparent'
                  }`}
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
                      <p
                        className={`${
                          isDark ? 'text-white' : 'text-theme-primary'
                        } whitespace-pre-wrap leading-relaxed`}
                      >
                        {message.content}
                      </p>

                      {/* Pièces justificatives */}
                      {message.pieces && message.pieces.length > 0 && (
                        <div
                          className={`mt-4 space-y-3 border-t pt-3 ${
                            isDark ? 'border-white/10' : 'border-theme'
                          }`}
                        >
                          <p
                            className={`text-sm flex items-center gap-2 ${
                              isDark ? 'text-gray-400' : 'text-theme-secondary'
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
                                className={`rounded-lg p-4 border cursor-pointer ${
                                  isDark
                                    ? 'bg-[#2d2d3a] border-white/10 hover:bg-theme-card/5'
                                    : 'bg-theme-card border-theme hover:bg-theme-card'
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
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                          {piece.metadata.client}
                                        </span>
                                      )}
                                      {piece.metadata?.type && (
                                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                          {piece.metadata.type}
                                        </span>
                                      )}
                                      {piece.metadata?.date_document_formatee && (
                                        <span className="text-xs bg-theme-card0/20 text-gray-400 px-2 py-1 rounded">
                                          {piece.metadata.date_document_formatee}
                                        </span>
                                      )}
                                    </div>
                                    {piece.content && (
                                      <p
                                        className={`text-sm mt-2 line-clamp-2 ${
                                          isDark ? 'text-gray-400' : 'text-theme-secondary'
                                        }`}
                                      >
                                        {piece.content}
                                      </p>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-2">
                                    {piece.metadata?.fichier_url && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            ouvrirPiece(piece)
                                          }}
                                          className={`p-2 rounded transition-colors ${
                                            isDark
                                              ? 'text-gray-400 hover:text-white hover:bg-theme-card/10'
                                              : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                          }`}
                                          title="Ouvrir"
                                        >
                                          <Icon name="arrow-right" size="sm" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            void telechargerPiece(piece)
                                          }}
                                          className={`p-2 rounded transition-colors ${
                                            isDark
                                              ? 'text-gray-400 hover:text-white hover:bg-theme-card/10'
                                              : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                          }`}
                                          title="Télécharger"
                                        >
                                          <Icon name="download" size="sm" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            imprimerPiece(piece)
                                          }}
                                          className={`p-2 rounded transition-colors ${
                                            isDark
                                              ? 'text-gray-400 hover:text-white hover:bg-theme-card/10'
                                              : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                          }`}
                                          title="Imprimer"
                                        >
                                          <Icon name="print" size="sm" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

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
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
              placeholder="Envoyez un message..."
              disabled={isLoading}
              className={`w-full rounded-xl py-4 pl-4 pr-12 outline-none border transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-[#40414f] text-white placeholder-gray-400 border-white/10 focus:border-white/30'
                  : 'bg-theme-card text-theme-primary placeholder-gray-400 border-theme focus:border-blue-500'
              }`}
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
            Assistant Archives ACS - Recherche dans vos documents
          </p>
        </div>
      </div>
    </div>
  )
}
