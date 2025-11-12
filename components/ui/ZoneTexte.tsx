// Composant Zone de texte réutilisable
import React from 'react'

interface PropsZoneTexte extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiquette?: string
  erreur?: string
  obligatoire?: boolean
}

export function ZoneTexte({
  etiquette,
  erreur,
  obligatoire = false,
  className = '',
  id,
  rows = 4,
  ...props
}: PropsZoneTexte) {
  const identifiant = id || `zone-${etiquette?.toLowerCase().replace(/\s/g, '-')}`

  return (
    <div className="w-full">
      {etiquette && (
        <label
          htmlFor={identifiant}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {etiquette}
          {obligatoire && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={identifiant}
        rows={rows}
        className={`
          w-full px-3 py-2 border rounded-lg 
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${erreur ? 'border-red-500' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {erreur && (
        <p className="mt-1 text-sm text-red-600">{erreur}</p>
      )}
    </div>
  )
}
