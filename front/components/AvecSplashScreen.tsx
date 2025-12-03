'use client'

import { useState, useEffect } from 'react'
import { SplashScreen } from './SplashScreen'

interface PropsAvecSplashScreen {
  children: React.ReactNode
  afficherSplash?: boolean
}

export function AvecSplashScreen({ children, afficherSplash = true }: PropsAvecSplashScreen) {
  const [splashTermine, setSplashTermine] = useState(false)
  const [montrer, setMontrer] = useState(false)

  useEffect(() => {
    // En mode développement, forcer l'affichage du splash à chaque visite
    const modeDevForceSpash = true // Mettre false en production
    
    // Vérifier si le splash a déjà été affiché dans cette session
    const splashVu = sessionStorage.getItem('splashVu')
    
    if (!afficherSplash || (!modeDevForceSpash && splashVu === 'true')) {
      setSplashTermine(true)
      setMontrer(true)
    } else {
      // Petit délai pour assurer le rendu
      setTimeout(() => setMontrer(true), 100)
    }
  }, [afficherSplash])

  const gererFinSplash = () => {
    sessionStorage.setItem('splashVu', 'true')
    setSplashTermine(true)
  }

  if (!montrer) {
    return null
  }

  return (
    <>
      {!splashTermine && <SplashScreen surTermine={gererFinSplash} />}
      <div className={`transition-opacity duration-500 ${splashTermine ? 'opacity-100' : 'opacity-0'}`}>
        {children}
      </div>
    </>
  )
}
