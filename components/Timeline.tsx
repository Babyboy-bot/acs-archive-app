'use client'

import { motion } from 'framer-motion'
import { Icon } from './Icon'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface TimelineEvent {
  id: string
  date: Date
  titre: string
  description: string
  type: 'creation' | 'modification' | 'consultation' | 'telechargement' | 'suppression'
  utilisateur: string
  document?: string
}

interface TimelineProps {
  evenements: TimelineEvent[]
}

const iconesParType = {
  creation: 'upload' as const,
  modification: 'edit' as const,
  consultation: 'eye' as const,
  telechargement: 'download' as const,
  suppression: 'trash' as const,
}

const couleursParType = {
  creation: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  modification: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  consultation: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  telechargement: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  suppression: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
}

export function Timeline({ evenements }: TimelineProps) {
  const evenementsTriees = [...evenements].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon name="clock" size="md" />
          Timeline des activités
        </h3>
        <span className="text-sm text-gray-500">
          {evenements.length} événement{evenements.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="relative">
        {/* Ligne verticale */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500 via-blue-500 to-purple-500" />

        {/* Événements */}
        <div className="space-y-6">
          {evenementsTriees.map((event, index) => {
            const couleurs = couleursParType[event.type]
            const icone = iconesParType[event.type]

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-16"
              >
                {/* Icône */}
                <div className={`absolute left-0 w-12 h-12 ${couleurs.bg} border-4 ${couleurs.border} rounded-full flex items-center justify-center shadow-lg z-10`}>
                  <Icon name={icone} size="sm" className={couleurs.text} />
                </div>

                {/* Contenu */}
                <motion.div
                  whileHover={{ x: 5 }}
                  className={`${couleurs.bg} ${couleurs.border} border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{event.titre}</h4>
                      <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                      {event.document && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <Icon name="document" size="xs" />
                          {event.document}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                    <span className="flex items-center gap-1 font-medium">
                      <Icon name="user" size="xs" />
                      {event.utilisateur}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="clock" size="xs" />
                      {format(event.date, 'dd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {evenements.length === 0 && (
        <div className="text-center py-12">
          <Icon name="clock" size="xl" className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 font-medium">Aucune activité récente</p>
          <p className="text-sm text-gray-400 mt-1">Les événements apparaîtront ici</p>
        </div>
      )}
    </div>
  )
}
