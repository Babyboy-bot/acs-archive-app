'use client'

import { ReactNode } from 'react'
import { Navigation } from '@/components/Navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { AuthLoadingScreen } from '@/components/common/LoadingSpinner'

interface PageLayoutProps {
  children: ReactNode
  /** Titre de la page (pour le SEO/accessibilité) */
  title?: string
  /** Bloquer l'accès aux consultants */
  bloquerConsultant?: boolean
  /** Classe CSS additionnelle pour le conteneur principal */
  className?: string
  /** Afficher la navigation */
  showNavigation?: boolean
}

/**
 * Layout de page avec authentification et navigation
 * 
 * Usage:
 * ```tsx
 * export default function MaPage() {
 *   return (
 *     <PageLayout title="Ma Page" bloquerConsultant>
 *       <MonContenu />
 *     </PageLayout>
 *   )
 * }
 * ```
 */
export function PageLayout({
  children,
  title,
  bloquerConsultant = false,
  className = '',
  showNavigation = true,
}: PageLayoutProps) {
  const { estAuthentifie, chargement } = useRequireAuth()
  
  // Appeler le hook même si bloquerConsultant est false pour respecter les règles des hooks
  useEnforceNonConsultant({ skip: !bloquerConsultant })

  if (chargement || !estAuthentifie) {
    return <AuthLoadingScreen />
  }

  return (
    <div className={`min-h-screen bg-theme-base text-theme-primary ${className}`}>
      {showNavigation && <Navigation />}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}

/**
 * Layout de page sans authentification (pages publiques)
 */
export function PublicPageLayout({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`min-h-screen bg-theme-base text-theme-primary ${className}`}>
      {children}
    </div>
  )
}
