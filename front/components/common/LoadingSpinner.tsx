'use client'

import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  /** Taille du spinner */
  size?: 'sm' | 'md' | 'lg'
  /** Message à afficher sous le spinner */
  message?: string
  /** Afficher en plein écran */
  fullScreen?: boolean
  /** Couleur du spinner (défaut: red-600) */
  color?: string
}

const SIZES = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-4',
  lg: 'w-16 h-16 border-4',
}

/**
 * Composant de chargement réutilisable
 */
export function LoadingSpinner({
  size = 'md',
  message,
  fullScreen = false,
  color = 'border-red-600',
}: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`${SIZES[size]} ${color} border-t-transparent rounded-full animate-spin`}
      />
      {message && (
        <p className="text-theme-secondary text-sm">{message}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-base">
        {spinner}
      </div>
    )
  }

  return spinner
}

/**
 * Écran de chargement pour l'authentification
 */
export function AuthLoadingScreen() {
  return (
    <LoadingSpinner
      fullScreen
      message="Vérification de l'authentification..."
    />
  )
}

/**
 * Écran de chargement générique
 */
export function PageLoadingScreen({ message = 'Chargement...' }: { message?: string }) {
  return (
    <LoadingSpinner
      fullScreen
      message={message}
    />
  )
}

/**
 * Skeleton pour les cartes
 */
export function CardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-theme-card rounded-xl p-6 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </motion.div>
      ))}
    </>
  )
}

/**
 * Skeleton pour les tableaux
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-200 rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-8 bg-gray-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
