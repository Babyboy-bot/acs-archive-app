'use client'

import { useEffect, useState } from 'react'

interface PropsSplashScreen {
  surTermine: () => void
  duree?: number
}

export function SplashScreen({ surTermine, duree = 3000 }: PropsSplashScreen) {
  const [phase, setPhase] = useState<'entree' | 'affichage' | 'sortie'>('entree')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Animation du progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + (100 / (duree / 50))
      })
    }, 50)

    // Phase d'entrée: 0-800ms
    const timerAffichage = setTimeout(() => {
      setPhase('affichage')
    }, 800)

    // Phase de sortie: duree-500ms
    const timerSortie = setTimeout(() => {
      setPhase('sortie')
    }, duree - 500)

    // Fin et callback
    const timerFin = setTimeout(() => {
      surTermine()
    }, duree)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(timerAffichage)
      clearTimeout(timerSortie)
      clearTimeout(timerFin)
    }
  }, [surTermine, duree])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-700 ${
        phase === 'sortie' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%)'
      }}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(211, 32, 39, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 102, 179, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }} />
      </div>

      {/* Glowing orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute w-96 h-96 rounded-full blur-3xl -top-48 -left-48 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(211, 32, 39, 0.3) 0%, transparent 70%)',
            animationDuration: '3s'
          }}
        />
        <div 
          className="absolute w-96 h-96 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(0, 102, 179, 0.3) 0%, transparent 70%)',
            animationDuration: '3s',
            animationDelay: '1.5s'
          }}
        />
        <div 
          className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(139, 69, 177, 0.15) 0%, transparent 70%)',
            animationDuration: '4s',
            animationDelay: '0.75s'
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-4">
        {/* Title with staggered animation */}
        <div
          className={`mt-10 text-center transition-all duration-1000 ${
            phase === 'entree'
              ? 'opacity-0 translate-y-6'
              : phase === 'affichage'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-6'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-white via-slate-200 to-white bg-clip-text text-transparent">
              ACS ARCHIVE
            </span>
          </h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-[#D32027] to-transparent" />
            <p className="text-sm tracking-[0.3em] uppercase text-slate-400 font-medium">
              Gestion Intelligente
            </p>
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-[#0066B3] to-transparent" />
          </div>
          <p className="text-xs text-slate-500 tracking-wider">
            Document Management System
          </p>
        </div>

        {/* Modern progress bar */}
        <div
          className={`mt-12 transition-all duration-700 ${
            phase === 'entree'
              ? 'opacity-0 scale-95'
              : phase === 'affichage'
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95'
          }`}
          style={{ transitionDelay: '500ms' }}
        >
          <div className="w-72 md:w-96">
            {/* Progress percentage */}
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs text-slate-400 font-mono">Chargement</span>
              <span className="text-xs text-slate-400 font-mono">{Math.round(progress)}%</span>
            </div>
            
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out relative"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #D32027 0%, #8B45B1 50%, #0066B3 100%)',
                  boxShadow: '0 0 20px rgba(211, 32, 39, 0.5)'
                }}
              >
                {/* Shimmer effect */}
                <div 
                  className="absolute inset-0 opacity-50"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    animation: 'shimmer 1.5s infinite'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading dots */}
        <div
          className={`mt-6 flex gap-1.5 transition-opacity duration-500 ${
            phase === 'sortie' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-slate-500"
              style={{
                animation: 'bounce 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.16}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className={`absolute bottom-6 md:bottom-8 text-center transition-all duration-500 px-4 ${
          phase === 'sortie' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        <p className="text-xs text-slate-500 mb-1">
          Développé par <span className="text-slate-400 font-medium">KASSI ELIE EMMANUEL</span> & <span className="text-slate-400 font-medium">ASSINYO RODRIGUE</span>
        </p>
        <p className="text-xs text-slate-600">
          © 2025 ACS - Assureurs Conseils Service
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        @keyframes bounce {
          0%, 80%, 100% { 
            transform: scale(0);
            opacity: 0.5;
          }
          40% { 
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

// Demo wrapper
export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  if (showSplash) {
    return <SplashScreen surTermine={() => setShowSplash(false)} duree={4000} />
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Application chargée!</h1>
        <button
          onClick={() => setShowSplash(true)}
          className="px-6 py-3 bg-gradient-to-r from-[#D32027] to-[#0066B3] text-white rounded-lg font-medium hover:shadow-lg transition-all"
        >
          Revoir le Splash Screen
        </button>
      </div>
    </div>
  )
}