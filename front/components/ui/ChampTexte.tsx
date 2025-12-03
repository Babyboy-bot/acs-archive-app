// Composant Champ de texte réutilisable
import React from 'react'

interface PropsChampTexte extends React.InputHTMLAttributes<HTMLInputElement> {
  etiquette?: string
  erreur?: string
  obligatoire?: boolean
  theme?: 'clair' | 'sombre'
}

export function ChampTexte({
  etiquette,
  erreur,
  obligatoire = false,
  theme = 'clair',
  className = '',
  id,
  ...props
}: PropsChampTexte) {
  const identifiant = id || `champ-${etiquette?.toLowerCase().replace(/\s/g, '-')}`

  const stylesTheme = theme === 'sombre' 
    ? {
        label: 'text-white/90',
        input: 'bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15 focus:border-white/40',
        erreur: 'text-red-300'
      }
    : {
        label: 'text-gray-700',
        input: 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400',
        erreur: 'text-red-600'
      }

  return (
    <div className="w-full">
      {etiquette && (
        <label
          htmlFor={identifiant}
          className={`block text-sm font-medium mb-1 ${stylesTheme.label}`}
        >
          {etiquette}
          {obligatoire && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={identifiant}
        className={`
          w-full px-4 py-3 border rounded-lg 
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          ${erreur ? 'border-red-500' : ''}
          ${stylesTheme.input}
          ${className}
        `}
        {...props}
      />
      {erreur && (
        <p className={`mt-1 text-sm ${stylesTheme.erreur}`}>{erreur}</p>
      )}
    </div>
  )
}
