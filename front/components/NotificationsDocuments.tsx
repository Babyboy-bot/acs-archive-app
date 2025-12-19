'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetchJson } from '@/lib/api'
import { Icon } from './Icon'

type DocumentRecent = {
  id: string
  titre: string
  type_courrier: string
  type_courrier_label: string
  client: string | null
  client_code: string | null
  cree_le: string | null
  fichier_url: string | null
}

interface NotificationsDocumentsProps {
  isDark?: boolean
  onDocumentClick?: (doc: DocumentRecent) => void
}

const LAST_CHECK_KEY = 'acs-notifications-last-check'
const POLL_INTERVAL = 60000 // 1 minute

/**
 * 🔔 Composant de notifications pour les nouveaux documents
 * Vérifie périodiquement les nouveaux documents et affiche une notification
 */
export function NotificationsDocuments({ isDark = false, onDocumentClick }: NotificationsDocumentsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [documents, setDocuments] = useState<DocumentRecent[]>([])
  const [newCount, setNewCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchRecentDocuments = useCallback(async (checkNew = false) => {
    setLoading(true)
    try {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
      const params = new URLSearchParams({ limit: '10' })
      
      if (checkNew && lastCheck) {
        params.set('since', lastCheck)
      }

      const { data } = await apiFetchJson<{ count: number; results: DocumentRecent[] }>(
        `/documents/recents/?${params.toString()}`
      )

      if (data && data.results) {
        if (checkNew && lastCheck) {
          // Compter les nouveaux documents depuis la dernière vérification
          setNewCount(data.count)
        }
        setDocuments(data.results)
      }
    } catch (error) {
      console.error('Erreur récupération documents récents:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Charger les documents au montage
  useEffect(() => {
    fetchRecentDocuments(true)
  }, [fetchRecentDocuments])

  // Polling périodique
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentDocuments(true)
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchRecentDocuments])

  const handleOpen = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      // Marquer comme lu
      setNewCount(0)
      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())
      fetchRecentDocuments(false)
    }
  }

  const handleDocumentClick = (doc: DocumentRecent) => {
    setIsOpen(false)
    onDocumentClick?.(doc)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (hours < 1) return "À l'instant"
    if (hours < 24) return `Il y a ${hours}h`
    if (days === 1) return 'Hier'
    if (days < 7) return `Il y a ${days}j`
    return date.toLocaleDateString('fr-FR')
  }

  return (
    <div className="relative">
      {/* Bouton notification */}
      <button
        onClick={handleOpen}
        className={`relative p-2 rounded-lg transition-colors ${
          isDark 
            ? 'text-slate-400 hover:text-white hover:bg-white/10' 
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }`}
        title="Notifications"
      >
        <Icon name="bell" size="sm" />
        {newCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {newCount > 9 ? '9+' : newCount}
          </span>
        )}
      </button>

      {/* Dropdown notifications */}
      {isOpen && (
        <div className={`absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl z-50 overflow-hidden ${
          isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
        }`}>
          <div className={`px-4 py-3 flex items-center justify-between ${
            isDark ? 'bg-slate-700/50' : 'bg-slate-50'
          }`}>
            <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
              🔔 Documents récents
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className={`text-xs ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Fermer
            </button>
          </div>

          <div className="max-h-80 overflow-auto">
            {loading && documents.length === 0 ? (
              <div className={`p-4 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Chargement...
              </div>
            ) : documents.length === 0 ? (
              <div className={`p-4 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Aucun document récent
              </div>
            ) : (
              documents.map((doc, index) => (
                <button
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  } ${index !== documents.length - 1 ? (isDark ? 'border-b border-slate-700' : 'border-b border-slate-100') : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
                    }`}>
                      <Icon name="document" size="xs" className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {doc.titre || 'Document sans titre'}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {doc.client && <span>{doc.client} • </span>}
                        {doc.type_courrier_label && <span>{doc.type_courrier_label} • </span>}
                        <span>{formatDate(doc.cree_le)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {documents.length > 0 && (
            <div className={`px-4 py-2 text-center ${isDark ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {documents.length} document{documents.length > 1 ? 's' : ''} récent{documents.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
