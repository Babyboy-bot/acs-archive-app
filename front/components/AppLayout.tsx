'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Icon } from './Icon'

interface AppLayoutProps {
  children: React.ReactNode
}

/**
 * Wrapper de mise en page principale avec sidebar responsive.
 * - Desktop : sidebar fixe 256px à gauche, contenu décalé de ml-64
 * - Mobile  : sidebar masquée par défaut, s'ouvre via bouton hamburger en overlay
 */
export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Fermer le menu mobile à chaque changement de page
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Empêcher le scroll du body quand le menu mobile est ouvert
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary flex">

      {/* Overlay backdrop (mobile uniquement) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar : masquée sur mobile par défaut, slide-in quand ouverte */}
      <div
        className={`fixed left-0 top-0 h-screen z-40 transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Bouton fermeture mobile (X) en haut à droite de la sidebar */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden absolute top-3 right-3 z-50 p-1.5 rounded-lg bg-theme-muted text-theme-secondary hover:text-theme-primary transition-colors"
            aria-label="Fermer le menu"
          >
            <Icon name="close" size="sm" />
          </button>
        )}
        <Sidebar />
      </div>

      {/* Zone principale */}
      <div className="flex-1 md:ml-64 min-w-0 flex flex-col">

        {/* Barre supérieure mobile avec bouton hamburger */}
        <div className="md:hidden sticky top-0 z-20 bg-theme-card border-b border-theme px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-muted transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Icon name="menu" size="sm" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/acs-logo.svg" alt="ACS" width={28} height={28} className="w-7 h-7 object-contain" />
            <span className="font-bold text-theme-primary text-sm">ACS Archive</span>
          </div>
        </div>

        {/* Contenu de la page */}
        {children}

      </div>
    </div>
  )
}
