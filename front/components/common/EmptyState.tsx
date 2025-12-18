'use client'

import { motion } from 'framer-motion'
import { Icon, IconName } from '@/components/Icon'
import { ReactNode } from 'react'

interface EmptyStateProps {
  /** Icône à afficher */
  icon?: IconName
  /** Titre */
  title: string
  /** Description */
  description?: string
  /** Action (bouton, lien, etc.) */
  action?: ReactNode
}

/**
 * Composant pour afficher un état vide (aucune donnée)
 */
export function EmptyState({
  icon = 'folder',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        <Icon name={icon} size="xl" className="text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 max-w-md mb-6">{description}</p>
      )}
      {action}
    </motion.div>
  )
}

/**
 * Composant pour afficher un accès restreint
 */
export function AccessDenied({
  title = 'Accès restreint',
  description = "Vous n'avez pas la permission d'accéder à cette page.",
}: {
  title?: string
  description?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="flex items-center gap-3 text-red-600 mb-4">
        <Icon name="shield" size="lg" />
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>
      <p className="text-gray-600 max-w-xl">{description}</p>
    </motion.div>
  )
}
