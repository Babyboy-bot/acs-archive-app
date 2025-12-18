'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, IconName } from '@/components/Icon'

type AlertType = 'success' | 'error' | 'warning' | 'info'

interface AlertMessageProps {
  /** Type d'alerte */
  type: AlertType
  /** Message à afficher */
  message: string
  /** Callback pour fermer l'alerte */
  onClose?: () => void
  /** Afficher ou non */
  show?: boolean
}

const ALERT_CONFIG: Record<AlertType, {
  icon: IconName
  bgClass: string
  borderClass: string
  textClass: string
}> = {
  success: {
    icon: 'check',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    textClass: 'text-green-700',
  },
  error: {
    icon: 'warning',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    textClass: 'text-red-700',
  },
  warning: {
    icon: 'warning',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-200',
    textClass: 'text-yellow-700',
  },
  info: {
    icon: 'info',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700',
  },
}

/**
 * Composant d'alerte réutilisable
 */
export function AlertMessage({
  type,
  message,
  onClose,
  show = true,
}: AlertMessageProps) {
  const config = ALERT_CONFIG[type]

  return (
    <AnimatePresence>
      {show && message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`mb-6 rounded-xl border ${config.borderClass} ${config.bgClass} px-4 py-3 ${config.textClass} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            <Icon name={config.icon} size="sm" />
            <span>{message}</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:opacity-70 transition-opacity"
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Hook pour gérer les messages d'alerte
 */
export function useAlertMessage() {
  const [message, setMessage] = useState<{ type: AlertType; text: string } | null>(null)

  const showSuccess = (text: string) => setMessage({ type: 'success', text })
  const showError = (text: string) => setMessage({ type: 'error', text })
  const showWarning = (text: string) => setMessage({ type: 'warning', text })
  const showInfo = (text: string) => setMessage({ type: 'info', text })
  const clear = () => setMessage(null)

  return {
    message,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clear,
  }
}
