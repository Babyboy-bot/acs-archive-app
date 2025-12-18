'use client'

import { ReactNode } from 'react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { AuthLoadingScreen } from './LoadingSpinner'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * Composant qui protège les pages nécessitant une authentification.
 * Affiche un écran de chargement pendant la vérification.
 * Redirige vers /connexion si non authentifié.
 * 
 * Usage:
 * ```tsx
 * export default function MaPage() {
 *   return (
 *     <AuthGuard>
 *       <ContenuDeLaPage />
 *     </AuthGuard>
 *   )
 * }
 * ```
 * 
 * Ou avec le hook directement pour plus de contrôle:
 * ```tsx
 * const { estAuthentifie, chargement, utilisateur } = useRequireAuth()
 * if (chargement || !estAuthentifie) return <AuthLoadingScreen />
 * ```
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { estAuthentifie, chargement } = useRequireAuth()

  if (chargement || !estAuthentifie) {
    return <AuthLoadingScreen />
  }

  return <>{children}</>
}
