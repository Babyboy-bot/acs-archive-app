'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { useDebounce } from '@/hooks/useDebounce'

type Onglet = 'documents' | 'pages' | 'actions'

export function RechercheGlobale() {
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [ongletActif, setOngletActif] = useState<Onglet>('documents')
  const [documentsResultats, setDocumentsResultats] = useState<any[]>([])
  const [chargement, setChargement] = useState(false)
  const router = useRouter()
  const rechercheDebounced = useDebounce(recherche, 300)

  // Pages de navigation
  const toutesLesPages = [
    { titre: 'Tableau de bord', url: '/tableau-de-bord', icone: 'chart' as const, description: 'Vue d\'ensemble' },
    { titre: 'Documents', url: '/documents', icone: 'folder' as const, description: 'Tous les documents' },
    { titre: 'Recherche avancée', url: '/recherche', icone: 'search' as const, description: 'Recherche multicritères' },
    { titre: 'Catégories', url: '/categories', icone: 'tag' as const, description: 'Gérer les catégories' },
    { titre: 'Utilisateurs', url: '/utilisateurs', icone: 'users' as const, description: 'Gestion utilisateurs' },
    { titre: 'Paramètres', url: '/parametres', icone: 'settings' as const, description: 'Configuration' },
    { titre: 'Activités', url: '/activite', icone: 'clock' as const, description: 'Historique et timeline' },
  ]

  // Actions rapides
  const actionsRapides = [
    { titre: 'Nouveau document', url: '/documents/nouveau', icone: 'upload' as const, description: 'Téléverser un document' },
    { titre: 'Exporter documents', action: 'export', icone: 'download' as const, description: 'Export PDF/Excel' },
  ]

  // Recherche documents via API
  useEffect(() => {
    if (rechercheDebounced && ongletActif === 'documents' && rechercheDebounced.length >= 2) {
      setChargement(true)
      fetch(`/api/search?q=${encodeURIComponent(rechercheDebounced)}&type=documents`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setDocumentsResultats(data.resultats || [])
          }
          setChargement(false)
        })
        .catch(() => setChargement(false))
    } else {
      setDocumentsResultats([])
    }
  }, [rechercheDebounced, ongletActif])

  const pagesResultats = toutesLesPages.filter(page =>
    page.titre.toLowerCase().includes(recherche.toLowerCase()) ||
    page.description.toLowerCase().includes(recherche.toLowerCase())
  )

  // Raccourci clavier Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOuvert(true)
      }
      if (e.key === 'Escape') {
        setOuvert(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const naviguer = (url: string) => {
    router.push(url)
    setOuvert(false)
    setRecherche('')
    setDocumentsResultats([])
  }

  const obtenirResultats = () => {
    if (ongletActif === 'documents') return documentsResultats
    if (ongletActif === 'pages') return pagesResultats
    if (ongletActif === 'actions') return actionsRapides.filter(a => 
      a.titre.toLowerCase().includes(recherche.toLowerCase())
    )
    return []
  }

  const resultats = obtenirResultats()

  return (
    <>
      {/* Bouton d'ouverture */}
      <button
        onClick={() => setOuvert(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-gray-600 hover:text-gray-900"
      >
        <Icon name="search" size="sm" />
        <span className="text-sm hidden md:inline">Rechercher...</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 bg-white border border-gray-300 rounded">
          <span>Ctrl</span>
          <span>K</span>
        </kbd>
      </button>

      {/* Modal de recherche */}
      <AnimatePresence>
        {ouvert && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOuvert(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
              >
                {/* Onglets */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                  {[
                    { id: 'documents' as Onglet, label: 'Documents', icon: 'document' as const },
                    { id: 'pages' as Onglet, label: 'Pages', icon: 'folder' as const },
                    { id: 'actions' as Onglet, label: 'Actions', icon: 'bolt' as const },
                  ].map((onglet) => (
                    <button
                      key={onglet.id}
                      onClick={() => setOngletActif(onglet.id)}
                      className={`flex-1 px-4 py-3 font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        ongletActif === onglet.id
                          ? 'bg-white text-red-600 border-b-2 border-red-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon name={onglet.icon} size="sm" />
                      {onglet.label}
                    </button>
                  ))}
                </div>

                {/* Barre de recherche */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center gap-3">
                    {chargement ? (
                      <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon name="search" className="text-gray-400" />
                    )}
                    <input
                      type="text"
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                      placeholder={
                        ongletActif === 'documents' ? 'Rechercher des documents (IA)...' :
                        ongletActif === 'pages' ? 'Rechercher des pages...' :
                        'Rechercher une action...'
                      }
                      className="flex-1 text-lg outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => setOuvert(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Icon name="close" size="sm" className="text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Résultats */}
                <div className="max-h-96 overflow-y-auto p-2">
                  {recherche === '' && ongletActif !== 'actions' ? (
                    <div className="p-8 text-center text-gray-500">
                      <Icon name="search" size="xl" className="mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">Tapez pour rechercher</p>
                      <p className="text-sm mt-2">
                        {ongletActif === 'documents' ? 'Recherche IA : tapez "auto ABC" ou "contrat santé"' :
                         ongletActif === 'pages' ? 'Trouvez rapidement une page de l\'application' :
                         'Actions rapides'}
                      </p>
                    </div>
                  ) : recherche !== '' && resultats.length === 0 && !chargement ? (
                    <div className="p-8 text-center text-gray-500">
                      <Icon name="info" size="xl" className="mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">Aucun résultat</p>
                      <p className="text-sm mt-2">Essayez un autre terme de recherche</p>
                    </div>
                  ) : ongletActif === 'actions' && recherche === '' ? (
                    <div className="space-y-1">
                      {actionsRapides.map((item, index) => (
                        <motion.button
                          key={item.url || item.action}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => item.url && naviguer(item.url)}
                          className="w-full flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-green-50 hover:to-blue-50 rounded-xl transition-all group text-left"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Icon name={item.icone} size="sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                              {item.titre}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{item.description}</p>
                          </div>
                          <Icon name="arrow-right" size="sm" className="text-gray-400 group-hover:text-green-600 transition-colors" />
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {resultats.map((item: any, index: number) => (
                        <motion.button
                          key={item.url || item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => item.url && naviguer(item.url)}
                          className="w-full flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 rounded-xl transition-all group text-left"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform ${
                            ongletActif === 'documents' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                            ongletActif === 'actions' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                            'bg-gradient-to-br from-blue-500 to-blue-600'
                          }`}>
                            <Icon name={item.icone || (ongletActif === 'documents' ? 'document' : 'folder')} size="sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                              {item.titre}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{item.description}</p>
                          </div>
                          <Icon name="arrow-right" size="sm" className="text-gray-400 group-hover:text-red-600 transition-colors" />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">↑↓</kbd>
                      Navigation
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Enter</kbd>
                      Sélectionner
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Esc</kbd>
                    Fermer
                  </span>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
