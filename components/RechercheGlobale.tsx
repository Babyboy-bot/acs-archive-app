'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'
import { motion, AnimatePresence } from 'framer-motion'

export function RechercheGlobale() {
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const router = useRouter()

  // Données simulées - À remplacer par vraie recherche API
  const toutesLesPages = [
    { titre: 'Tableau de bord', url: '/tableau-de-bord', icone: 'chart' as const, description: 'Vue d\'ensemble' },
    { titre: 'Documents', url: '/documents', icone: 'folder' as const, description: 'Tous les documents' },
    { titre: 'Nouveau document', url: '/documents/nouveau', icone: 'upload' as const, description: 'Téléverser un document' },
    { titre: 'Recherche avancée', url: '/recherche', icone: 'search' as const, description: 'Recherche multicritères' },
    { titre: 'Navigation hiérarchique', url: '/recherche/navigation', icone: 'folder' as const, description: 'Parcourir par arborescence' },
    { titre: 'Catégories', url: '/categories', icone: 'tag' as const, description: 'Gérer les catégories' },
    { titre: 'Utilisateurs', url: '/utilisateurs', icone: 'users' as const, description: 'Gestion utilisateurs' },
    { titre: 'Paramètres', url: '/parametres', icone: 'settings' as const, description: 'Configuration' },
  ]

  const resultats = toutesLesPages.filter(page =>
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
  }

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
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
              >
                {/* Barre de recherche */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Icon name="search" className="text-gray-400" />
                    <input
                      type="text"
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                      placeholder="Rechercher des pages, documents..."
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
                  {recherche === '' ? (
                    <div className="p-8 text-center text-gray-500">
                      <Icon name="search" size="xl" className="mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">Tapez pour rechercher</p>
                      <p className="text-sm mt-2">Pages, documents, catégories...</p>
                    </div>
                  ) : resultats.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Icon name="info" size="xl" className="mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">Aucun résultat</p>
                      <p className="text-sm mt-2">Essayez un autre terme de recherche</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {resultats.map((item, index) => (
                        <motion.button
                          key={item.url}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => naviguer(item.url)}
                          className="w-full flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 rounded-xl transition-all group text-left"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-blue-500 rounded-xl flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Icon name={item.icone} size="sm" />
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
