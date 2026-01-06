'use client'

import { useState } from 'react'
import { Icon } from './Icon'

interface PdfThumbnailProps {
  url: string
  alt?: string
  className?: string
  fallbackIcon?: boolean
}

/**
 * Composant qui affiche une miniature d'un PDF via embed HTML natif
 * Utilise les paramètres PDF pour masquer la toolbar et afficher uniquement le contenu
 */
export function PdfThumbnail({ url, alt = 'PDF', className = '', fallbackIcon = true }: PdfThumbnailProps) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  // URL avec paramètres pour masquer la toolbar et afficher en mode fit
  const embedUrl = `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`

  // Affichage en cas d'erreur (fallback vers icône)
  if (error) {
    if (!fallbackIcon) return null
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}>
        <div className="w-12 h-14 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-500/20">
          <Icon name="document" size="md" className="text-blue-500 dark:text-blue-400" />
        </div>
        <span className="text-[10px] mt-2 font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">
          PDF
        </span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
          <div className="animate-pulse flex flex-col items-center gap-1">
            <Icon name="document" size="md" className="text-slate-400" />
            <span className="text-[8px] text-slate-400">Chargement...</span>
          </div>
        </div>
      )}
      <embed
        src={embedUrl}
        type="application/pdf"
        className="w-full h-full pointer-events-none"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true)
          setLoading(false)
        }}
      />
    </div>
  )
}
