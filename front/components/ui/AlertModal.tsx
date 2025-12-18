'use client'

import { useEffect } from 'react'
import { Icon } from '@/components/Icon'

type AlertModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  variant?: 'error' | 'warning' | 'success' | 'info'
  buttonText?: string
  isDark?: boolean
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'error',
  buttonText = 'Fermer',
  isDark = false,
}: AlertModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const variantStyles = {
    error: {
      icon: 'close',
      iconBg: isDark ? 'bg-red-900/30' : 'bg-red-100',
      iconColor: isDark ? 'text-red-400' : 'text-red-600',
      btn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: 'alert',
      iconBg: isDark ? 'bg-amber-900/30' : 'bg-amber-100',
      iconColor: isDark ? 'text-amber-400' : 'text-amber-600',
      btn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    },
    success: {
      icon: 'check',
      iconBg: isDark ? 'bg-green-900/30' : 'bg-green-100',
      iconColor: isDark ? 'text-green-400' : 'text-green-600',
      btn: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    },
    info: {
      icon: 'info',
      iconBg: isDark ? 'bg-blue-900/30' : 'bg-blue-100',
      iconColor: isDark ? 'text-blue-400' : 'text-blue-600',
      btn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 ${
          isDark ? 'bg-slate-800' : 'bg-white'
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-title"
      >
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}>
            <Icon name={styles.icon as any} size="lg" className={styles.iconColor} />
          </div>

          {/* Content */}
          <h3
            id="alert-title"
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            {title}
          </h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            {message}
          </p>

          {/* Button */}
          <button
            type="button"
            onClick={onClose}
            className={`w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.btn}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}
