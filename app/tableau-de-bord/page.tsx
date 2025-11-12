'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function DashboardUltraModerne() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const stats = {
    documents: 1247,
    nouveaux: 89,
    stockage: 2.4,
    utilisateurs: 24,
    croissance: 12.5,
  }

  const evolutionDocuments = [
    { mois: 'Jan', total: 145, ACS_Client: 85, ACS_Compagnie: 60 },
    { mois: 'Fév', total: 132, ACS_Client: 75, ACS_Compagnie: 57 },
    { mois: 'Mar', total: 168, ACS_Client: 95, ACS_Compagnie: 73 },
    { mois: 'Avr', total: 154, ACS_Client: 88, ACS_Compagnie: 66 },
    { mois: 'Mai', total: 189, ACS_Client: 110, ACS_Compagnie: 79 },
    { mois: 'Juin', total: 176, ACS_Client: 102, ACS_Compagnie: 74 },
    { mois: 'Juil', total: 195, ACS_Client: 115, ACS_Compagnie: 80 },
    { mois: 'Août', total: 168, ACS_Client: 95, ACS_Compagnie: 73 },
    { mois: 'Sep', total: 182, ACS_Client: 105, ACS_Compagnie: 77 },
    { mois: 'Oct', total: 198, ACS_Client: 118, ACS_Compagnie: 80 },
    { mois: 'Nov', total: 210, ACS_Client: 125, ACS_Compagnie: 85 },
  ]

  const risques = [
    { name: 'Automobile', value: 435, color: '#D32027' },
    { name: 'Santé', value: 312, color: '#10B981' },
    { name: 'Habitation', value: 245, color: '#F59E0B' },
    { name: 'Vie', value: 156, color: '#8B5CF6' },
    { name: 'RC', value: 99, color: '#0066B3' },
  ]

  const documentsRecents = [
    { id: 1, titre: 'Police Auto - Entreprise ABC', client: 'Entreprise ABC', risque: 'Auto', date: 'Il y a 5 min' },
    { id: 2, titre: 'Attestation Santé Collective', client: 'SARL Transport CI', risque: 'Santé', date: 'Il y a 15 min' },
    { id: 3, titre: 'Contrat Habitation', client: 'Kouassi Jean', risque: 'Habitation', date: 'Il y a 1h' },
    { id: 4, titre: 'Cotation Compagnie XYZ', client: 'Entreprise ABC', risque: 'Auto', date: 'Il y a 2h' },
  ]

  const activites = [
    { user: 'Elie K.', action: 'CREATION', doc: 'Police Auto ABC', temps: '5 min', avatar: 'EK', color: '#10B981' },
    { user: 'Rodrigue A.', action: 'CONSULTATION', doc: 'Attestation Santé', temps: '15 min', avatar: 'RA', color: '#0066B3' },
    { user: 'Admin', action: 'MODIFICATION', doc: 'Risque Auto #45', temps: '1h', avatar: 'AA', color: '#F59E0B' },
    { user: 'Elie K.', action: 'TELECHARGEMENT', doc: 'Contrat Habitation', temps: '2h', avatar: 'EK', color: '#8B5CF6' },
  ]

  const actionIcons = {
    CREATION: 'upload',
    CONSULTATION: 'eye',
    MODIFICATION: 'edit',
    TELECHARGEMENT: 'download',
  } as const

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
            Dashboard ACS Archive
          </h1>
          <p className="text-gray-600">Bienvenue ! Voici un aperçu de votre système d'archivage</p>
        </motion.div>

        {/* Cartes statistiques */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {/* Total Documents */}
          <motion.div 
            variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
            whileHover={{ scale: 1.05, y: -5 }} 
            className="relative overflow-hidden"
          >
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon name="folder" size="lg" className="text-white" />
                  </div>
                  <div className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    +{stats.croissance}%
                  </div>
                </div>
                <p className="text-sm opacity-90 mb-1">Total Documents</p>
                <p className="text-4xl font-bold">{stats.documents.toLocaleString()}</p>
                <p className="text-sm opacity-75 mt-2">+{stats.nouveaux} ce mois</p>
              </div>
            </div>
          </motion.div>

          {/* Stockage */}
          <motion.div 
            variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
            whileHover={{ scale: 1.05, y: -5 }} 
            className="relative overflow-hidden"
          >
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon name="inbox" size="lg" className="text-white" />
                  </div>
                  <div className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    24%
                  </div>
                </div>
                <p className="text-sm opacity-90 mb-1">Espace Utilisé</p>
                <p className="text-4xl font-bold">{stats.stockage} GB</p>
                <p className="text-sm opacity-75 mt-2">Sur 10 GB</p>
              </div>
            </div>
          </motion.div>

          {/* Utilisateurs */}
          <motion.div 
            variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
            whileHover={{ scale: 1.05, y: -5 }} 
            className="relative overflow-hidden"
          >
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon name="users" size="lg" className="text-white" />
                  </div>
                  <div className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    Actifs
                  </div>
                </div>
                <p className="text-sm opacity-90 mb-1">Utilisateurs</p>
                <p className="text-4xl font-bold">{stats.utilisateurs}</p>
                <p className="text-sm opacity-75 mt-2">3 en ligne</p>
              </div>
            </div>
          </motion.div>

          {/* Aujourd'hui */}
          <motion.div 
            variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
            whileHover={{ scale: 1.05, y: -5 }} 
            className="relative overflow-hidden"
          >
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon name="upload" size="lg" className="text-white" />
                  </div>
                  <div className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    Aujourd'hui
                  </div>
                </div>
                <p className="text-sm opacity-90 mb-1">Uploads</p>
                <p className="text-4xl font-bold">12</p>
                <p className="text-sm opacity-75 mt-2">Documents ajoutés</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Actions rapides */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="bolt" className="text-red-600" />
            Actions Rapides
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/documents/nouveau">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-gradient-to-br hover:from-red-50 hover:to-blue-50 transition-all border-2 border-transparent hover:border-red-200">
                <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Icon name="upload" size="lg" />
                </div>
                <span className="font-medium text-gray-700">Upload</span>
              </motion.button>
            </Link>

            <Link href="/recherche">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 transition-all border-2 border-transparent hover:border-blue-200">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Icon name="search" size="lg" />
                </div>
                <span className="font-medium text-gray-700">Recherche</span>
              </motion.button>
            </Link>

            <Link href="/categories">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 transition-all border-2 border-transparent hover:border-purple-200">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Icon name="tag" size="lg" />
                </div>
                <span className="font-medium text-gray-700">Catégories</span>
              </motion.button>
            </Link>

            <Link href="/parametres">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-gradient-to-br hover:from-green-50 hover:to-teal-50 transition-all border-2 border-transparent hover:border-green-200">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Icon name="settings" size="lg" />
                </div>
                <span className="font-medium text-gray-700">Paramètres</span>
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="chart" className="text-red-600" />
              Évolution des Documents
            </h3>
            {mounted && (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={evolutionDocuments}>
                  <defs>
                    <linearGradient id="colorClient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D32027" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#D32027" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCompagnie" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066B3" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0066B3" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mois" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="ACS_Client" stroke="#D32027" fillOpacity={1} fill="url(#colorClient)" />
                  <Area type="monotone" dataKey="ACS_Compagnie" stroke="#0066B3" fillOpacity={1} fill="url(#colorCompagnie)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="shield" className="text-blue-600" />
              Répartition par Risques
            </h3>
            {mounted && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={risques}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {risques.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Documents récents et Activités */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="document" className="text-red-600" />
              Documents Récents
            </h3>
            <div className="space-y-3">
              {documentsRecents.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  whileHover={{ x: 5 }}
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-all border border-transparent hover:border-gray-200"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon name="document-solid" className="text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.titre}</p>
                    <p className="text-sm text-gray-500">{doc.client} • {doc.risque}</p>
                  </div>
                  <div className="text-xs text-gray-400">{doc.date}</div>
                </motion.div>
              ))}
            </div>
            <Link href="/documents">
              <motion.button whileHover={{ x: 5 }} className="mt-4 w-full text-center py-3 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2">
                Voir tous les documents
                <Icon name="arrow-right" size="sm" />
              </motion.button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="bolt" className="text-blue-600" />
              Activités Récentes
            </h3>
            <div className="space-y-4">
              {activites.map((act, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg"
                    style={{ backgroundColor: act.color }}
                  >
                    {act.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 flex items-center gap-2">
                      <span className="font-semibold">{act.user}</span>
                      <Icon name={actionIcons[act.action as keyof typeof actionIcons]} size="xs" className="text-gray-400" />
                      <span className="text-gray-600">{act.action}</span>
                    </p>
                    <p className="text-sm text-gray-500 truncate">{act.doc}</p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Icon name="clock" size="xs" />
                      {act.temps}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
