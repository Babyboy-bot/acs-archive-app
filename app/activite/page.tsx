'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { Timeline } from '@/components/Timeline'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function PageActivite() {
  const [evenements, setEvenements] = useState<any[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/activites?limit=50')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEvenements(data.activites.map((act: any) => ({
            ...act,
            date: new Date(act.date)
          })))
        }
        setChargement(false)
      })
      .catch(() => setChargement(false))
  }, [])

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
            <Icon name="clock" size="xl" className="text-red-600" />
            Activités et Historique
          </h1>
          <p className="text-gray-600">
            Suivez toutes les actions effectuées sur les documents
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {chargement ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Chargement des activités...</p>
            </div>
          ) : evenements.length > 0 ? (
            <Timeline evenements={evenements} />
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <Icon name="clock" size="xl" className="mx-auto mb-4 text-gray-300" />
              <p className="text-xl font-semibold text-gray-700 mb-2">Aucune activité récente</p>
              <p className="text-gray-500">Les actions sur les documents apparaîtront ici</p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
