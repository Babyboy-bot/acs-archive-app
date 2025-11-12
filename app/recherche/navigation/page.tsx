'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function PageNavigationHierarchique() {
  const [niveau, setNiveau] = useState<'clients' | 'exercices' | 'risques' | 'documents'>('clients')
  const [clientSelectionne, setClientSelectionne] = useState<string | null>(null)
  const [exerciceSelectionne, setExerciceSelectionne] = useState<string | null>(null)
  const [risqueSelectionne, setRisqueSelectionne] = useState<string | null>(null)

  const clients = [
    { id: '1', nom: 'Entreprise ABC', type: 'ENTREPRISE', nombreExercices: 3 },
    { id: '2', nom: 'SARL Transport CI', type: 'ENTREPRISE', nombreExercices: 2 },
    { id: '3', nom: 'Kouassi Jean-Marie', type: 'PARTICULIER', nombreExercices: 1 },
  ]

  const exercices = [
    { id: '1', annee: 2025, statut: 'ACTIF', nombreRisques: 3 },
    { id: '2', annee: 2024, statut: 'ARCHIVE', nombreRisques: 2 },
    { id: '3', annee: 2023, statut: 'CLOTURE', nombreRisques: 1 },
  ]

  const risques = [
    { id: '1', type: 'AUTOMOBILE', description: 'Assurance véhicules', couleur: '#D32027', nombreDocuments: 5 },
    { id: '2', type: 'SANTE', description: 'Assurance santé collective', couleur: '#10B981', nombreDocuments: 3 },
    { id: '3', type: 'HABITATION', description: 'Multirisque habitation', couleur: '#F59E0B', nombreDocuments: 2 },
  ]

  const documents = [
    { id: '1', titre: 'Police Auto - Contrat 2025', typeCourrier: 'ACS_VERS_CLIENT', date: '2025-11-01', taille: '2.4 MB' },
    { id: '2', titre: 'Demande cotation Compagnie', typeCourrier: 'ACS_VERS_COMPAGNIE', date: '2025-10-28', taille: '850 KB' },
    { id: '3', titre: 'Attestation assurance', typeCourrier: 'ACS_VERS_CLIENT', date: '2025-10-15', taille: '1.2 MB' },
  ]

  const retour = () => {
    if (niveau === 'documents') {
      setNiveau('risques')
      setRisqueSelectionne(null)
    } else if (niveau === 'risques') {
      setNiveau('exercices')
      setExerciceSelectionne(null)
    } else if (niveau === 'exercices') {
      setNiveau('clients')
      setClientSelectionne(null)
    }
  }

  const filAriane = () => {
    const items = []
    if (clientSelectionne) items.push(clients.find(c => c.id === clientSelectionne)?.nom || '')
    if (exerciceSelectionne) items.push(exercices.find(e => e.id === exerciceSelectionne)?.annee.toString() || '')
    if (risqueSelectionne) items.push(risques.find(r => r.id === risqueSelectionne)?.type || '')
    return items
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
            <Icon name="folder" size="xl" className="text-red-600" />
            Navigation Hiérarchique
          </h1>
          <p className="text-gray-600">Parcourez vos documents par arborescence</p>
        </motion.div>

        {/* Fil d'Ariane */}
        {filAriane().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 mb-6"
          >
            <div className="flex items-center gap-2 text-sm">
              <Icon name="home" size="sm" className="text-gray-400" />
              <span className="text-gray-400">/</span>
              {filAriane().map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">{item}</span>
                  {index < filAriane().length - 1 && (
                    <Icon name="chevron-right" size="sm" className="text-gray-400" />
                  )}
                </div>
              ))}
            </div>
            {niveau !== 'clients' && (
              <motion.button
                whileHover={{ x: -5 }}
                onClick={retour}
                className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Icon name="arrow-left" size="sm" />
                Retour
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Niveau 1 : Clients */}
        {niveau === 'clients' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client, index) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => {
                  setClientSelectionne(client.id)
                  setNiveau('exercices')
                }}
                className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Icon name="building" size="lg" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    client.type === 'ENTREPRISE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {client.type}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                  {client.nom}
                </h3>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Icon name="calendar" size="sm" />
                  {client.nombreExercices} exercice{client.nombreExercices > 1 ? 's' : ''}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Niveau 2 : Exercices */}
        {niveau === 'exercices' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exercices.map((exercice, index) => (
              <motion.div
                key={exercice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => {
                  setExerciceSelectionne(exercice.id)
                  setNiveau('risques')
                }}
                className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Icon name="calendar" size="lg" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    exercice.statut === 'ACTIF' ? 'bg-green-100 text-green-700' :
                    exercice.statut === 'ARCHIVE' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {exercice.statut}
                  </span>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {exercice.annee}
                </h3>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Icon name="shield" size="sm" />
                  {exercice.nombreRisques} risque{exercice.nombreRisques > 1 ? 's' : ''}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Niveau 3 : Risques */}
        {niveau === 'risques' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {risques.map((risque, index) => (
              <motion.div
                key={risque.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => {
                  setRisqueSelectionne(risque.id)
                  setNiveau('documents')
                }}
                className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer group"
              >
                <div 
                  className="h-24 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${risque.couleur}dd 0%, ${risque.couleur} 100%)` }}
                >
                  <Icon name="shield" size="xl" className="text-white group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                    {risque.type}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">{risque.description}</p>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Icon name="document" size="sm" />
                    {risque.nombreDocuments} document{risque.nombreDocuments > 1 ? 's' : ''}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Niveau 4 : Documents */}
        {niveau === 'documents' && (
          <div className="space-y-4">
            {documents.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ x: 5 }}
                className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer border-2 border-transparent hover:border-red-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                      <Icon name="document-solid" size="lg" className="text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{doc.titre}</h3>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`px-3 py-1 rounded-full font-semibold ${
                          doc.typeCourrier === 'ACS_VERS_CLIENT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {doc.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie'}
                        </span>
                        <span className="text-gray-500 flex items-center gap-1">
                          <Icon name="calendar" size="xs" />
                          {doc.date}
                        </span>
                        <span className="text-gray-500 flex items-center gap-1">
                          <Icon name="inbox" size="xs" />
                          {doc.taille}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale: 1.1 }} className="p-3 hover:bg-gray-100 rounded-xl transition-colors">
                      <Icon name="eye" size="md" />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1 }} className="p-3 hover:bg-blue-100 rounded-xl transition-colors">
                      <Icon name="download" size="md" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
