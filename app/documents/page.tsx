'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

export default function PageDocuments() {
  const [recherche, setRecherche] = useState('')
  const [filtreRisque, setFiltreRisque] = useState('')
  const [filtreCourrier, setFiltreCourrier] = useState('')
  const [vueMode, setVueMode] = useState<'liste' | 'grille'>('grille')

  const documents = [
    {
      id: 1,
      titre: 'Police Automobile 2025',
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'AUTOMOBILE',
      typeCourrier: 'ACS_VERS_CLIENT',
      date: '2025-11-12',
      taille: '2.4 MB',
      reference: 'DOC-2025-001',
      color: '#D32027'
    },
    {
      id: 2,
      titre: 'Cotation Compagnie XYZ',
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'AUTOMOBILE',
      typeCourrier: 'ACS_VERS_COMPAGNIE',
      date: '2025-11-10',
      taille: '850 KB',
      reference: 'DOC-2025-002',
      color: '#0066B3'
    },
    {
      id: 3,
      titre: 'Attestation Santé Collective',
      client: 'SARL Transport CI',
      exercice: 2025,
      risque: 'SANTE',
      typeCourrier: 'ACS_VERS_CLIENT',
      date: '2025-11-01',
      taille: '1.2 MB',
      reference: 'DOC-2025-003',
      color: '#10B981'
    },
    {
      id: 4,
      titre: 'Contrat Habitation',
      client: 'Kouassi Jean',
      exercice: 2025,
      risque: 'HABITATION',
      typeCourrier: 'ACS_VERS_CLIENT',
      date: '2025-10-15',
      taille: '1.5 MB',
      reference: 'DOC-2025-005',
      color: '#F59E0B'
    },
    {
      id: 5,
      titre: 'Police Vie - Garantie Décès',
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'VIE',
      typeCourrier: 'ACS_VERS_CLIENT',
      date: '2025-10-05',
      taille: '1.8 MB',
      reference: 'DOC-2025-006',
      color: '#8B5CF6'
    },
  ]

  const risques = [
    { value: '', label: 'Tous les risques' },
    { value: 'AUTOMOBILE', label: 'Automobile' },
    { value: 'SANTE', label: 'Santé' },
    { value: 'HABITATION', label: 'Habitation' },
    { value: 'VIE', label: 'Vie' },
    { value: 'RESPONSABILITE_CIVILE', label: 'RC' },
  ]

  const courriers = [
    { value: '', label: 'Tous types' },
    { value: 'ACS_VERS_CLIENT', label: 'ACS → Client' },
    { value: 'ACS_VERS_COMPAGNIE', label: 'ACS → Compagnie' },
  ]

  const documentsFiltres = documents.filter(doc => {
    const matchRecherche = doc.titre.toLowerCase().includes(recherche.toLowerCase()) ||
                          doc.client.toLowerCase().includes(recherche.toLowerCase()) ||
                          doc.reference.toLowerCase().includes(recherche.toLowerCase())
    const matchRisque = !filtreRisque || doc.risque === filtreRisque
    const matchCourrier = !filtreCourrier || doc.typeCourrier === filtreCourrier
    return matchRecherche && matchRisque && matchCourrier
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <Icon name="folder" size="xl" className="text-red-600" />
                Documents
              </h1>
              <p className="text-gray-600">{documentsFiltres.length} document{documentsFiltres.length > 1 ? 's' : ''} trouvé{documentsFiltres.length > 1 ? 's' : ''}</p>
            </div>
            <Link href="/documents/nouveau">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <Icon name="upload" size="sm" />
                Nouveau document
              </motion.button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher par titre, client, référence..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Icon name="search" className="text-gray-400" />
                </div>
              </div>
            </div>

            <select
              value={filtreRisque}
              onChange={(e) => setFiltreRisque(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            >
              {risques.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <select
              value={filtreCourrier}
              onChange={(e) => setFiltreCourrier(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            >
              {courriers.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-gray-600 mr-2">Affichage :</span>
            <button
              onClick={() => setVueMode('grille')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                vueMode === 'grille'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon name="card" size="sm" />
              Grille
            </button>
            <button
              onClick={() => setVueMode('liste')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                vueMode === 'liste'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon name="document" size="sm" />
              Liste
            </button>
          </div>
        </motion.div>

        {vueMode === 'grille' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentsFiltres.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer group"
              >
                <div 
                  className="h-32 relative overflow-hidden flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${doc.color}dd 0%, ${doc.color} 100%)` }}
                >
                  <div className="absolute top-4 right-4">
                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-semibold">
                      {doc.exercice}
                    </span>
                  </div>
                  <Icon name="document-solid" size="xl" className="text-white opacity-90 group-hover:scale-110 transition-transform" />
                </div>

                <div className="p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                    {doc.titre}
                  </h3>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Icon name="building" size="xs" />
                      <span>{doc.client}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="calendar" size="xs" />
                      <span>{doc.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="inbox" size="xs" />
                      <span>{doc.taille}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="tag" size="xs" />
                      <span className="text-xs font-mono">{doc.reference}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      doc.typeCourrier === 'ACS_VERS_CLIENT'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {doc.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="eye" size="sm" />
                      Voir
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Icon name="download" size="sm" />
                      Télécharger
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {vueMode === 'liste' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Document</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Client</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Risque</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Taille</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documentsFiltres.map((doc, index) => (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Icon name="document-solid" className="text-gray-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{doc.titre}</p>
                            <p className="text-sm text-gray-500 font-mono">{doc.reference}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{doc.client}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${doc.color}20`, color: doc.color }}>
                          {doc.risque}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          doc.typeCourrier === 'ACS_VERS_CLIENT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {doc.typeCourrier === 'ACS_VERS_CLIENT' ? 'Client' : 'Compagnie'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{doc.date}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{doc.taille}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Voir">
                            <Icon name="eye" size="sm" />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger">
                            <Icon name="download" size="sm" />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                            <Icon name="trash" size="sm" className="text-red-600" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {documentsFiltres.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-2xl shadow-lg"
          >
            <Icon name="folder" size="xl" className="mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-semibold text-gray-700 mb-2">Aucun document trouvé</p>
            <p className="text-gray-500 mb-6">Modifiez vos filtres ou ajoutez un nouveau document</p>
            <Link href="/documents/nouveau">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg inline-flex items-center gap-2"
              >
                <Icon name="upload" size="sm" />
                Ajouter un document
              </motion.button>
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  )
}
