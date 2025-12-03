import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUtilisateurCourant } from './useUtilisateurCourant'
import { RoleUtilisateur } from '@/types'

/**
 * Redirige automatiquement l'utilisateur consultant vers l'expérience Assistant IA.
 */
export function useEnforceNonConsultant() {
  const router = useRouter()
  const utilisateur = useUtilisateurCourant()

  useEffect(() => {
    if (utilisateur?.role === RoleUtilisateur.CONSULTANT) {
      router.replace('/assistant-demo')
    }
  }, [utilisateur?.role, router])
}
