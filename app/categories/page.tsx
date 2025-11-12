'use client'

import { Navigation } from '@/components/Navigation'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function PageCategories() {
  const [recherche, setRecherche] = useState('')
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)
  
  // Formulaire nouvelle catégorie
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleCouleur, setNouvelleCouleur] = useState('#D32027')

  // Données catégories (basées sur les risques)
  const categories = [
    {
      id: 1,
      nom: 'Automobile',
      description: 'Assurances véhicules, flottes et transport',
      couleur: '#D32027',
      icon: '🚗',
      nombreDocuments: 435,
      tendance: '+12%'
    },
    {
      id: 2,
      nom: 'Santé',
      description: 'Assurances santé individuelle et collective',
      couleur: '#10B981',
      icon: '🏥',
      nombreDocuments: 312,
      tendance: '+8%'
    },
    {
      id: 3,
      nom: 'Habitation',
      description: 'Assurances multirisque habitation',
      couleur: '#F59E0B',
      icon: '🏠',
      nombreDocuments: 245,
      tendance: '+15%'
    },
    {
      id: 4,
      nom: 'Vie',
      description: 'Assurances vie et garanties décès',
      couleur: '#8B5CF6',
      icon: '❤️',
      nombreDocuments: 156,
      tendance: '+5%'
    },
    {
      id: 5,
      nom: 'Responsabilité Civile',
      description: 'RC professionnelle et générale',
      couleur: '#0066B3',
      icon: '🛡️',
      nombreDocuments: 99,
      tendance: '+3%'
    },
    {
      id: 6,
      nom: 'Entreprise',
      description: 'Assurances multirisques entreprises',
      couleur: '#EC4899',
      icon: '🏢',
      nombreDocuments: 78,
      tendance: '+10%'
    },
  ]

  const categoriesFiltrees = categories.filter(cat =>
    cat.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    cat.description.toLowerCase().includes(recherche.toLowerCase())
  )

  const ajouterCategorie = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implémenter l'ajout réel
    setNouveauNom('')
    setAfficherFormulaire(false)
  }

  const couleursPredefinies = [
    '#D32027', '#0066B3', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
    '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2">
                🏷️ Catégories
              </h1>
              <p className="text-gray-600">{categoriesFiltrees.length} catégorie{categoriesFiltrees.length > 1 ? 's' : ''} de documents</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAfficherFormulaire(!afficherFormulaire)}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <span className="text-xl">{afficherFormulaire ? '✕' : '+'}</span>
              {afficherFormulaire ? 'Annuler' : 'Nouvelle catégorie'}
            </motion.button>
          </div>
        </motion.div>

        {/* Barre de recherche */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="relative">
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="🔍 Rechercher une catégorie..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">
              🔍
            </div>
          </div>
        </motion.div>

        {/* Formulaire nouvelle catégorie */}
        {afficherFormulaire && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl shadow-lg p-8 mb-8 border-2 border-red-200"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6">➕ Nouvelle Catégorie</h3>
            <form onSubmit={ajouterCategorie} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nom de la catégorie *
                  </label>
                  <input
                    type="text"
                    value={nouveauNom}
                    onChange={(e) => setNouveauNom(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Ex: Transport Maritime"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Couleur *
                  </label>
                  <div className="flex gap-2">
                    {couleursPredefinies.map((couleur) => (
                      <motion.button
                        key={couleur}
                        type="button"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setNouvelleCouleur(couleur)}
                        className={`w-10 h-10 rounded-full shadow-lg transition-all ${
                          nouvelleCouleur === couleur ? 'ring-4 ring-offset-2 ring-gray-400' : ''
                        }`}
                        style={{ backgroundColor: couleur }}
                      />
                    ))}
                    <input
                      type="color"
                      value={nouvelleCouleur}
                      onChange={(e) => setNouvelleCouleur(e.target.value)}
                      className="w-10 h-10 rounded-full cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg flex items-center gap-2"
                >
                  ✅ Créer la catégorie
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setAfficherFormulaire(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Grille de catégories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoriesFiltrees.map((cat, index) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer group"
            >
              {/* Header avec couleur */}
              <div 
                className="h-24 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${cat.couleur}dd 0%, ${cat.couleur} 100%)` }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div 
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    className="text-5xl"
                  >
                    {cat.icon}
                  </motion.div>
                </div>
                <div className="absolute top-4 right-4">
                  <motion.span 
                    whileHover={{ scale: 1.1 }}
                    className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-semibold"
                  >
                    {cat.tendance}
                  </motion.span>
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                  {cat.nom}
                </h3>
                <p className="text-sm text-gray-600 mb-4 h-10">
                  {cat.description}
                </p>

                {/* Stats */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-3xl font-bold" style={{ color: cat.couleur }}>
                      {cat.nombreDocuments}
                    </p>
                    <p className="text-sm text-gray-500">Documents</p>
                  </div>
                  <div className="text-4xl opacity-20 group-hover:opacity-30 transition-opacity">
                    {cat.icon}
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.nombreDocuments / 435) * 100}%` }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.couleur }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors"
                  >
                    📊 Voir stats
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 py-2 rounded-lg font-medium text-sm text-white transition-all hover:shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${cat.couleur}dd 0%, ${cat.couleur} 100%)` }}
                  >
                    ✏️ Modifier
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats globales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8 bg-white rounded-2xl shadow-lg p-8"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-6">📊 Statistiques Globales</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent mb-2">
                {categories.length}
              </p>
              <p className="text-sm text-gray-600">Catégories</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">
                {categories.reduce((sum, cat) => sum + cat.nombreDocuments, 0)}
              </p>
              <p className="text-sm text-gray-600">Total Documents</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent mb-2">
                {Math.round(categories.reduce((sum, cat) => sum + cat.nombreDocuments, 0) / categories.length)}
              </p>
              <p className="text-sm text-gray-600">Moyenne/Catégorie</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-2">
                {categories[0].nom}
              </p>
              <p className="text-sm text-gray-600">Plus Populaire</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
