'use client'

import { motion } from 'framer-motion'
import { Icon, IconName } from '@/components/Icon'
import { ReactNode } from 'react'

interface PageHeaderProps {
  /** Titre de la page */
  title: string
  /** Sous-titre ou description */
  subtitle?: string
  /** Icône à afficher */
  icon?: IconName
  /** Actions à afficher à droite (boutons, etc.) */
  actions?: ReactNode
  /** Désactiver l'animation */
  noAnimation?: boolean
}

/**
 * En-tête de page réutilisable avec titre, icône et actions
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  noAnimation = false,
}: PageHeaderProps) {
  const content = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
          {icon && <Icon name={icon} size="xl" className="text-red-600" />}
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-600 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  )

  if (noAnimation) {
    return content
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {content}
    </motion.div>
  )
}
