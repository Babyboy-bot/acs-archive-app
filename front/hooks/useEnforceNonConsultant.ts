import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUtilisateurCourant } from './useUtilisateurCourant'
import { RoleUtilisateur } from '@/types'

interface UseEnforceNonConsultantOptions {
  /** Si true, désactive la redirection */
  skip?: boolean
  /** URL de redirection (défaut: /assistant-demo) */
  redirectTo?: string
}

/**
 * Redirige automatiquement l'utilisateur consultant vers l'expérience Assistant IA.
 * 
 * @param options - Options de configuration
 * @param options.skip - Si true, désactive la redirection
 * @param options.redirectTo - URL de redirection personnalisée
 */
export function useEnforceNonConsultant(options: UseEnforceNonConsultantOptions = {}) {
  const { skip = false, redirectTo = '/assistant-demo' } = options
  const router = useRouter()
  const utilisateur = useUtilisateurCourant()

  useEffect(() => {
    if (!skip && utilisateur?.role === RoleUtilisateur.CONSULTANT) {
      router.replace(redirectTo)
    }
  }, [utilisateur?.role, router, skip, redirectTo])
}
