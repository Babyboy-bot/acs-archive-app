'use client'

import { useState } from 'react'
import { Icon } from './Icon'
import { motion, AnimatePresence } from 'framer-motion'

interface PreviewPDFProps {
  ouvert: boolean
  onFermer: () => void
  titre: string
  urlDocument?: string
}

export function PreviewPDF({ ouvert, onFermer, titre, urlDocument }: PreviewPDFProps) {
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(100)

  return (
    <AnimatePresence>
      {ouvert && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onFermer}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white">
                    <Icon name="document" size="sm" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">{titre}</h2>
                    <p className="text-sm text-gray-500">Prévisualisation du document</p>
                  </div>
                </div>
                <button
                  onClick={onFermer}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon name="close" className="text-gray-500" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-gray-200"
                  >
                    <Icon name="arrow-left" size="sm" />
                  </button>
                  <span className="px-4 py-2 bg-white rounded-lg border border-gray-200 text-sm font-medium">
                    Page {page} / 10
                  </span>
                  <button
                    onClick={() => setPage(Math.min(10, page + 1))}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-gray-200"
                  >
                    <Icon name="arrow-right" size="sm" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoom(Math.max(50, zoom - 25))}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-gray-200"
                  >
                    <span className="text-sm font-bold">-</span>
                  </button>
                  <span className="px-4 py-2 bg-white rounded-lg border border-gray-200 text-sm font-medium">
                    {zoom}%
                  </span>
                  <button
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-gray-200"
                  >
                    <span className="text-sm font-bold">+</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    <Icon name="download" size="sm" />
                    Télécharger
                  </motion.button>
                </div>
              </div>

              {/* Viewer */}
              <div className="flex-1 overflow-auto bg-gray-100 p-4">
                <div className="max-w-4xl mx-auto">
                  {/* Demo PDF Preview */}
                  <div 
                    className="bg-white shadow-2xl rounded-lg p-12 mx-auto"
                    style={{ 
                      width: `${zoom}%`,
                      minHeight: '1000px',
                      transition: 'width 0.3s ease'
                    }}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                          ACS
                        </div>
                        <div>
                          <h1 className="text-3xl font-bold text-gray-900">ACS - Assureurs Conseils Service</h1>
                          <p className="text-gray-600">Document d'assurance</p>
                        </div>
                      </div>

                      <div className="border-t-4 border-red-600 pt-6 mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">{titre}</h2>
                      </div>

                      <div className="space-y-4 text-gray-700">
                        <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString('fr-FR')}</p>
                        
                        <div className="bg-gray-50 p-6 rounded-lg">
                          <h3 className="font-bold mb-3">Informations du document</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Référence</p>
                              <p className="font-semibold">POL-AUTO-2025-001</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Type</p>
                              <p className="font-semibold">Police d'assurance</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Client</p>
                              <p className="font-semibold">Entreprise ABC</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Exercice</p>
                              <p className="font-semibold">2025</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-bold mb-3">Contenu du document</h3>
                          <p className="leading-relaxed">
                            Ceci est une prévisualisation du document. Le contenu réel du PDF sera affiché ici
                            lorsque le document sera chargé depuis le serveur.
                          </p>
                          <p className="leading-relaxed mt-4">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
                            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud 
                            exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                          </p>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-lg mt-6">
                          <h3 className="font-bold mb-3 text-blue-900">Conditions générales</h3>
                          <ul className="space-y-2 text-sm text-blue-800">
                            <li>• Couverture tous risques</li>
                            <li>• Franchise de 500 €</li>
                            <li>• Protection juridique incluse</li>
                            <li>• Assistance 24h/24 7j/7</li>
                          </ul>
                        </div>
                      </div>

                      <div className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                        <p>Page {page} sur 10</p>
                        <p className="mt-2">© 2025 ACS - Assureurs Conseils Service</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
