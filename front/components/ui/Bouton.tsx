// Composant Bouton réutilisable
import React from 'react'

type VarianteBouton = 'primaire' | 'secondaire' | 'danger' | 'succes'
type TailleBouton = 'petit' | 'moyen' | 'grand'

interface PropsBouton extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton
  taille?: TailleBouton
  chargement?: boolean
  children: React.ReactNode
}

export function Bouton({
  variante = 'primaire',
  taille = 'moyen',
  chargement = false,
  children,
  className = '',
  disabled,
  ...props
}: PropsBouton) {
  // Classes de base
  const classesBase = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  // Classes selon la variante ACS
  const classesVariante = {
    primaire: 'text-white hover:opacity-90 focus:ring-red-500',
    secondaire: 'bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-500 border-2',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    succes: 'text-white hover:opacity-90 focus:ring-blue-500',
  }
  
  // Styles inline pour les gradients ACS
  const styleVariante = variante === 'primaire' 
    ? { background: 'linear-gradient(135deg, #D32027 0%, #A01820 100%)' }
    : variante === 'succes'
    ? { background: 'linear-gradient(135deg, #0066B3 0%, #004D87 100%)' }
    : variante === 'secondaire'
    ? { borderColor: '#D32027' }
    : {}

  // Classes selon la taille
  const classesTaille = {
    petit: 'px-3 py-1.5 text-sm',
    moyen: 'px-4 py-2 text-base',
    grand: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`${classesBase} ${classesVariante[variante]} ${classesTaille[taille]} ${className}`}
      style={styleVariante}
      disabled={disabled || chargement}
      {...props}
    >
      {chargement ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Chargement...
        </span>
      ) : (
        children
      )}
    </button>
  )
}
