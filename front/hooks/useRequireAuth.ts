import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUtilisateurActif, SessionUtilisateur } from '@/lib/session'

/**
 * Hook qui vérifie si l'utilisateur est authentifié.
 * Redirige vers /connexion si non connecté.
 * Note: L'authentification repose sur les cookies httpOnly, pas sur un token localStorage.
 * 
 * @returns { estAuthentifie, chargement, utilisateur }
 */
export function useRequireAuth() {
  const router = useRouter()
  const [chargement, setChargement] = useState(true)
  const [estAuthentifie, setEstAuthentifie] = useState(false)
  const [utilisateur, setUtilisateur] = useState<SessionUtilisateur | null>(null)

  useEffect(() => {
    const verifier = () => {
      const user = getUtilisateurActif()

      if (!user) {
        router.replace('/connexion')
        return
      }

      setUtilisateur(user)
      setEstAuthentifie(true)
      setChargement(false)
    }

    verifier()
  }, [router])

  return { estAuthentifie, chargement, utilisateur }
}
