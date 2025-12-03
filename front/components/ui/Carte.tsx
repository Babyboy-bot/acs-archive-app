// Composant Carte réutilisable
import React from 'react'

interface PropsCarte {
  titre?: string
  sousTitre?: string
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function Carte({
  titre,
  sousTitre,
  children,
  actions,
  className = '',
}: PropsCarte) {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {(titre || sousTitre || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            {titre && <h3 className="text-lg font-semibold text-gray-900">{titre}</h3>}
            {sousTitre && <p className="text-sm text-gray-600 mt-1">{sousTitre}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  )
}
