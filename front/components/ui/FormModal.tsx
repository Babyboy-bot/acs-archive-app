'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { Icon } from '@/components/Icon'

type FormModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  isDark?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | '5xl'
}

export function FormModal({
  isOpen,
  onClose,
  title,
  children,
  isDark = false,
  size = 'md',
}: FormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

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

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    ['5xl']: 'max-w-5xl',
  }

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
        ref={modalRef}
        className={`relative rounded-2xl shadow-2xl w-full ${sizeClasses[size]} p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-slate-800' : 'bg-white'
          }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3
            id="form-modal-title"
            className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDark
                ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            aria-label="Fermer"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  )
}
