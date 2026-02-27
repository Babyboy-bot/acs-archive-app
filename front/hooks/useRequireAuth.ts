import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUtilisateurActif, SessionUtilisateur, verifierSessionServeur, supprimerSession } from '@/lib/session'

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
    let actif = true

    const verifier = async () => {
      const user = getUtilisateurActif()
      const sessionValide = await verifierSessionServeur()

      if (!actif) return

      if (sessionValide && user) {
        setUtilisateur(user)
        setEstAuthentifie(true)
        setChargement(false)
        return
      }

      supprimerSession()
      setUtilisateur(null)
      setEstAuthentifie(false)
      setChargement(false)
      router.replace('/connexion')
    }

    verifier()

    return () => {
      actif = false
    }
  }, [router])

  return { estAuthentifie, chargement, utilisateur }
}
