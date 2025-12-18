'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUtilisateurActif } from '@/lib/session'
import { RoleUtilisateur } from '@/types'

interface PrivateRouteProps {
  children: React.ReactNode
  /** Si défini, redirige les consultants vers cette URL (par défaut: /assistant-demo) */
  redirectConsultantTo?: string
  /** Si true, bloque complètement les consultants de cette page */
  bloquerConsultant?: boolean
}

/**
 * Composant wrapper qui protège les pages nécessitant une authentification.
 * Redirige vers /connexion si l'utilisateur n'est pas connecté.
 */
export function PrivateRoute({ 
  children, 
  redirectConsultantTo = '/assistant-demo',
  bloquerConsultant = false 
}: PrivateRouteProps) {
  const router = useRouter()
  const [estAutorise, setEstAutorise] = useState(false)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    const verifierAuthentification = () => {
      const utilisateur = getUtilisateurActif()

      // Pas d'utilisateur en session = non connecté
      // Note: L'authentification repose sur les cookies httpOnly, pas sur un token localStorage
      if (!utilisateur) {
        router.replace('/connexion')
        return
      }

      // Gestion des consultants
      if (utilisateur.role === RoleUtilisateur.CONSULTANT && bloquerConsultant) {
        router.replace(redirectConsultantTo)
        return
      }

      setEstAutorise(true)
      setChargement(false)
    }

    verifierAuthentification()
  }, [router, redirectConsultantTo, bloquerConsultant])

  // Afficher un loader pendant la vérification
  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-base">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-theme-secondary text-sm">Vérification de l'authentification...</p>
        </div>
      </div>
    )
  }

  if (!estAutorise) {
    return null
  }

  return <>{children}</>
}
