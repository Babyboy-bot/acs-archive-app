'use client'

import { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { motion } from 'framer-motion'
import { apiFetchJson } from '@/lib/api'

interface StatTempsReel {
  label: string
  valeur: number
  variation: number
  icone: 'folder' | 'users' | 'upload' | 'eye'
  couleur: string
  unite?: string
}

interface StatsTempsReelProps {
  intervalMs?: number
}

export function StatsTempsReel({ intervalMs = 5000 }: StatsTempsReelProps) {
  const [stats, setStats] = useState<StatTempsReel[]>([
    { label: 'Documents', valeur: 0, variation: 0, icone: 'folder', couleur: '#D32027', unite: '' },
    { label: "Uploads aujourd'hui", valeur: 0, variation: 0, icone: 'upload', couleur: '#10B981', unite: '' },
  ])
  
  const [derniereMAJ, setDerniereMAJ] = useState(new Date())
  const [enPause, setEnPause] = useState(false)

  // Charger stats initiales
  useEffect(() => {
    chargerStats()
  }, [])

  const chargerStats = async () => {
    try {
      const { response, data } = await apiFetchJson('/stats/')
      if (!response.ok || !data || typeof data !== 'object') {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors du chargement des statistiques')
      }

      const documents = Number((data as any).documents ?? 0)
      const uploads = Number((data as any).uploadsAujourdhui ?? 0)

      setStats(prevStats => [
        { ...prevStats[0], valeur: documents, variation: documents - prevStats[0].valeur },
        { ...prevStats[1], valeur: uploads, variation: uploads - prevStats[1].valeur },
      ])
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    }
  }

  useEffect(() => {
    if (enPause) return

    const interval = setInterval(() => {
      chargerStats()
      setDerniereMAJ(new Date())
    }, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs, enPause])

  const tempsDepuisMAJ = Math.floor((new Date().getTime() - derniereMAJ.getTime()) / 1000)

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: enPause ? 0 : 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 bg-gradient-to-br from-red-500 to-blue-500 rounded-full flex items-center justify-center"
          >
            <Icon name="bolt" size="sm" className="text-white" />
          </motion.div>
          <div>
            <h3 className="font-bold text-gray-900">Stats en temps réel</h3>
            <p className="text-xs text-gray-500">
              Mis à jour il y a {tempsDepuisMAJ}s
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setEnPause(!enPause)}
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            enPause
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {enPause ? 'Reprendre' : 'Pause'}
        </button>
      </div>

      {/* Cartes stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-gray-200 transition-all relative overflow-hidden"
          >
            {/* Badge variation */}
            {stat.variation !== 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${
                  stat.variation > 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {stat.variation > 0 ? '+' : ''}{stat.variation}
              </motion.div>
            )}

            {/* Icône */}
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: `${stat.couleur}20` }}
            >
              <div style={{ color: stat.couleur }}>
                <Icon name={stat.icone} size="md" />
              </div>
            </div>

            {/* Valeur */}
            <motion.div
              key={stat.valeur}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="mb-2"
            >
              <p className="text-3xl font-bold" style={{ color: stat.couleur }}>
                {stat.valeur.toLocaleString()}
                <span className="text-sm font-normal text-gray-500">{stat.unite}</span>
              </p>
            </motion.div>

            {/* Label */}
            <p className="text-sm text-gray-600 font-medium">{stat.label}</p>

            {/* Barre de progression animée */}
            <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stat.valeur % 100)}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full"
                style={{ backgroundColor: stat.couleur }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Indicateur de mise à jour */}
      {!enPause && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center text-xs text-gray-400 flex items-center justify-center gap-2"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          Mise à jour automatique active
        </motion.div>
      )}
    </div>
  )
}
