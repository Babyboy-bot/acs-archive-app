'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface PropsSplashScreen {
  surTermine: () => void
  duree?: number
}

export function SplashScreen({ surTermine, duree = 3000 }: PropsSplashScreen) {
  const [phase, setPhase] = useState<'entree' | 'affichage' | 'sortie'>('entree')

  useEffect(() => {
    // Phase d'entrée: 0-800ms
    const timerAffichage = setTimeout(() => {
      setPhase('affichage')
    }, 800)

    // Phase d'affichage: 800ms-2500ms
    const timerSortie = setTimeout(() => {
      setPhase('sortie')
    }, duree - 500)

    // Phase de sortie: 2500ms-3000ms puis callback
    const timerFin = setTimeout(() => {
      surTermine()
    }, duree)

    return () => {
      clearTimeout(timerAffichage)
      clearTimeout(timerSortie)
      clearTimeout(timerFin)
    }
  }, [surTermine, duree])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        phase === 'sortie' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
      }}
    >
      {/* Particules d'arrière-plan ACS */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full blur-3xl -top-48 -left-48 animate-pulse" style={{ backgroundColor: 'rgba(211, 32, 39, 0.12)' }} />
        <div className="absolute w-96 h-96 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse" style={{ backgroundColor: 'rgba(0, 102, 179, 0.12)', animationDelay: '1s' }} />
      </div>

      {/* Contenu central */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo avec animation */}
        <div
          className={`transform transition-all duration-1000 ${
            phase === 'entree'
              ? 'scale-50 opacity-0 translate-y-10'
              : phase === 'affichage'
              ? 'scale-100 opacity-100 translate-y-0'
              : 'scale-110 opacity-0'
          }`}
        >
          <div className="relative">
            {/* Glow effect ACS */}
            <div className="absolute inset-0 blur-2xl animate-pulse" style={{ background: 'linear-gradient(135deg, rgba(211, 32, 39, 0.15) 0%, rgba(0, 102, 179, 0.15) 100%)' }} />
            
            {/* Logo */}
            <div className="relative bg-white rounded-3xl p-12 border-2 shadow-2xl" style={{ borderColor: '#e5e7eb' }}>
              <Image
                src="/acs-logo.svg"
                alt="ACS Logo"
                width={300}
                height={120}
                priority
                className="drop-shadow-lg"
              />
            </div>
          </div>
        </div>

        {/* Texte animé */}
        <div
          className={`mt-8 text-center transition-all duration-1000 delay-300 ${
            phase === 'entree'
              ? 'opacity-0 translate-y-4'
              : phase === 'affichage'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-4'
          }`}
        >
          <h1 className="text-3xl font-bold mb-2 tracking-wider" style={{ color: '#1F2937' }}>
            ACS ARCHIVE
          </h1>
          <p className="text-sm tracking-widest uppercase" style={{ color: '#6B7280' }}>
            Gestion Intelligente de Documents
          </p>
        </div>

        {/* Barre de chargement ACS */}
        <div
          className={`mt-12 w-64 h-1 rounded-full overflow-hidden transition-opacity duration-500`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-[2800ms] ease-out"
            style={{
              width: phase === 'entree' ? '0%' : '100%',
              background: 'linear-gradient(90deg, #D32027 0%, #0066B3 100%)',
            }}
          />
        </div>
      </div>

      {/* Signature */}
      <div
        className={`absolute bottom-8 text-center transition-opacity duration-500 ${
          phase === 'sortie' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          Développé par KASSI ELIE EMMANUEL & ASSINYO RODRIGUE
        </p>
        <p className="text-xs mt-1" style={{ color: '#D1D5DB' }}>© 2025 ACS - Assureurs Conseils Service</p>
      </div>
    </div>
  )
}
