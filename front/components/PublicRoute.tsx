'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUtilisateurActif, verifierSessionServeur, supprimerSession } from '@/lib/session'
import { RoleUtilisateur } from '@/types'

interface PublicRouteProps {
  children: React.ReactNode
}

/**
 * Composant wrapper pour les pages publiques (connexion, mot de passe oublié, etc.)
 * Redirige automatiquement les utilisateurs déjà connectés vers leur espace approprié.
 * Cela garantit la séparation des responsabilités (SoD) en empêchant un utilisateur
 * connecté d'accéder aux pages d'authentification.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const router = useRouter()
  const [peutAfficher, setPeutAfficher] = useState(false)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    let actif = true

    const verifierSession = async () => {
      const utilisateur = getUtilisateurActif()
      const sessionValide = await verifierSessionServeur()

      if (utilisateur && sessionValide) {
        const destination = utilisateur.role === RoleUtilisateur.CONSULTANT 
          ? '/assistant-demo' 
          : '/tableau-de-bord'
        router.replace(destination)
        return
      }

      if (utilisateur && !sessionValide) {
        supprimerSession()
      }

      if (!actif) return
      setPeutAfficher(true)
      setChargement(false)
    }

    verifierSession()

    return () => {
      actif = false
    }
  }, [router])

  // Afficher un loader pendant la vérification
  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!peutAfficher) {
    return null
  }

  return <>{children}</>
}
