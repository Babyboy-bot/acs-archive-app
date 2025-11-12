'use client'

import { Navigation } from '@/components/Navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

export default function PageRecherche() {
  const [client, setClient] = useState('')
  const [exercice, setExercice] = useState('')
  const [risque, setRisque] = useState('')
  const [typeCourrier, setTypeCourrier] = useState('')
  const [motCle, setMotCle] = useState('')
  const [afficherResultats, setAfficherResultats] = useState(false)

  const typesRisque = [
    { value: '', label: 'Tous les risques', color: '#6B7280', icon: '📋' },
    { value: 'AUTOMOBILE', label: 'Automobile', color: '#D32027', icon: '🚗' },
    { value: 'SANTE', label: 'Santé', color: '#10B981', icon: '🏥' },
    { value: 'HABITATION', label: 'Habitation', color: '#F59E0B', icon: '🏠' },
    { value: 'VIE', label: 'Vie', color: '#8B5CF6', icon: '❤️' },
    { value: 'RESPONSABILITE_CIVILE', label: 'RC', color: '#0066B3', icon: '🛡️' },
  ]

  const typesCourrier = [
    { value: '', label: 'Tous les courriers' },
    { value: 'ACS_VERS_CLIENT', label: '📧 ACS → Client' },
    { value: 'ACS_VERS_COMPAGNIE', label: '📨 ACS → Compagnie' },
  ]

  // Résultats simulés
  const resultats = [
    {
      id: 1,
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'AUTOMOBILE',
      typeCourrier: 'ACS_VERS_CLIENT',
      titre: 'Police Auto - Contrat 2025',
      reference: 'POL-AUTO-2025-001',
      date: '2025-11-01',
      chemin: 'ABC / 2025 / Automobile / ACS→Client',
      taille: '2.4 MB',
    },
    {
      id: 2,
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'AUTOMOBILE',
      typeCourrier: 'ACS_VERS_COMPAGNIE',
      titre: 'Demande cotation - Compagnie XYZ',
      reference: 'COT-AUTO-2025-012',
      date: '2025-10-28',
      chemin: 'ABC / 2025 / Automobile / ACS→Compagnie',
      taille: '850 KB',
    },
    {
      id: 3,
      client: 'SARL Transport CI',
      exercice: 2025,
      risque: 'SANTE',
      typeCourrier: 'ACS_VERS_CLIENT',
      titre: 'Attestation santé collective',
      reference: 'ATT-SANTE-2025-045',
      date: '2025-11-10',
      chemin: 'Transport CI / 2025 / Santé / ACS→Client',
      taille: '1.2 MB',
    },
  ]

  const gererRecherche = (e: React.FormEvent) => {
    e.preventDefault()
    setAfficherResultats(true)
  }

  const reinitialiser = () => {
    setClient('')
    setExercice('')
    setRisque('')
    setTypeCourrier('')
    setMotCle('')
    setAfficherResultats(false)
  }

  const getRisqueInfo = (type: string) => typesRisque.find(r => r.value === type) || typesRisque[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2">
            🔍 Recherche Avancée
          </h1>
          <p className="text-gray-600">Trouvez rapidement vos documents par Client → Exercice → Risque</p>
        </motion.div>

        {/* Formulaire de recherche */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Critères de recherche</h2>
            <Link href="/recherche/navigation">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-medium hover:bg-blue-200 transition-colors flex items-center gap-2"
              >
                📂 Vue hiérarchique
              </motion.button>
            </Link>
          </div>

          <form onSubmit={gererRecherche} className="space-y-6">
            {/* Niveau 1: Client */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#D32027' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold">1</span>
                Client
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nom du client..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
              />
            </motion.div>

            {/* Niveau 2: Exercice */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#0066B3' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">2</span>
                Exercice (Année)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[2025, 2024, 2023, 2022].map((annee) => (
                  <motion.button
                    key={annee}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setExercice(String(annee))}
                    className={`py-3 px-4 rounded-xl font-bold transition-all ${
                      exercice === String(annee)
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    📅 {annee}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Niveau 3: Risque */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#D32027' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold">3</span>
                Type de Risque
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {typesRisque.map((type) => (
                  <motion.button
                    key={type.value}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRisque(type.value)}
                    className={`py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      risque === type.value
                        ? 'text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={risque === type.value ? { backgroundColor: type.color } : {}}
                  >
                    <span className="text-xl">{type.icon}</span>
                    {type.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Niveau 4: Type Courrier */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#0066B3' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">4</span>
                Type de Courrier
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                {typesCourrier.slice(1).map((type) => (
                  <motion.button
                    key={type.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTypeCourrier(type.value)}
                    className={`py-4 px-6 rounded-xl font-medium transition-all text-left ${
                      typeCourrier === type.value
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Mot-clé supplémentaire */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6"
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-xl">🔎</span>
                Mot-clé supplémentaire (optionnel)
              </label>
              <input
                type="text"
                value={motCle}
                onChange={(e) => setMotCle(e.target.value)}
                placeholder="Référence, titre du document..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none"
              />
            </motion.div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
              >
                🔍 Rechercher
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={reinitialiser}
                className="px-8 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                ↺ Réinitialiser
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Résultats */}
        {afficherResultats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                📁 Résultats ({resultats.length} document{resultats.length > 1 ? 's' : ''})
              </h2>
            </div>

            <div className="space-y-4">
              {resultats.map((doc, index) => {
                const risqueInfo = getRisqueInfo(doc.risque)
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ x: 5 }}
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-red-300 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Chemin */}
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                          <span>📂</span>
                          <span className="font-mono">{doc.chemin}</span>
                        </div>

                        {/* Titre */}
                        <h3 className="font-bold text-xl text-gray-900 mb-3 hover:text-red-600 transition-colors">
                          {doc.titre}
                        </h3>

                        {/* Infos */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span 
                            className="px-4 py-2 rounded-full font-semibold text-white text-sm flex items-center gap-2"
                            style={{ backgroundColor: risqueInfo.color }}
                          >
                            {risqueInfo.icon} {risqueInfo.label}
                          </span>
                          <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                            📋 {doc.reference}
                          </span>
                          <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            📅 {doc.date}
                          </span>
                          <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                            📦 {doc.taille}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          className="p-3 hover:bg-gray-100 rounded-xl transition-colors" 
                          title="Voir"
                        >
                          <span className="text-2xl">👁️</span>
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          className="p-3 hover:bg-blue-100 rounded-xl transition-colors" 
                          title="Télécharger"
                        >
                          <span className="text-2xl">⬇️</span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Message vide */}
        {!afficherResultats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-2xl shadow-lg"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-6xl mb-4"
            >
              🔍
            </motion.div>
            <p className="text-xl font-semibold text-gray-700 mb-2">Utilisez les critères ci-dessus pour rechercher</p>
            <p className="text-sm text-gray-500">Navigation: Client → Exercice → Risque → Documents</p>
          </motion.div>
        )}
      </main>
    </div>
  )
}
