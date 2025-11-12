// Composant Alerte réutilisable
import React from 'react'

type TypeAlerte = 'info' | 'succes' | 'avertissement' | 'erreur'

interface PropsAlerte {
  type?: TypeAlerte
  titre?: string
  message: string
  surFermeture?: () => void
}

export function Alerte({
  type = 'info',
  titre,
  message,
  surFermeture,
}: PropsAlerte) {
  const configurations = {
    info: {
      couleurFond: 'border-2',
      couleurBordure: '',
      couleurTexte: '',
      style: { borderColor: '#0066B3', backgroundColor: 'rgba(0, 102, 179, 0.05)', color: '#004D87' },
      icone: (
        <svg className="w-5 h-5" style={{ color: '#0066B3' }} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    succes: {
      couleurFond: 'border-2',
      couleurBordure: '',
      couleurTexte: '',
      style: { borderColor: '#0066B3', backgroundColor: 'rgba(0, 102, 179, 0.05)', color: '#004D87' },
      icone: (
        <svg className="w-5 h-5" style={{ color: '#0066B3' }} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    avertissement: {
      couleurFond: 'bg-yellow-50 border-2',
      couleurBordure: 'border-yellow-200',
      couleurTexte: 'text-yellow-800',
      style: {},
      icone: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    erreur: {
      couleurFond: 'border-2',
      couleurBordure: '',
      couleurTexte: '',
      style: { borderColor: '#D32027', backgroundColor: 'rgba(211, 32, 39, 0.05)', color: '#A01820' },
      icone: (
        <svg className="w-5 h-5" style={{ color: '#D32027' }} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  }

  const config = configurations[type]

  return (
    <div
      className={`${config.couleurFond} ${config.couleurBordure} ${config.couleurTexte} rounded-lg p-4`}
      style={config.style}
    >
      <div className="flex">
        <div className="flex-shrink-0">{config.icone}</div>
        <div className="ml-3 flex-1">
          {titre && <h3 className="text-sm font-medium">{titre}</h3>}
          <div className={`text-sm ${titre ? 'mt-1' : ''}`}>{message}</div>
        </div>
        {surFermeture && (
          <div className="ml-auto pl-3">
            <button
              onClick={surFermeture}
              className="hover:opacity-75 focus:outline-none"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
