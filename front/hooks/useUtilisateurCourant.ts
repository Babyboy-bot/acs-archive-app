import { useEffect, useState } from 'react'
import { getUtilisateurActif, SessionUtilisateur } from '@/lib/session'

export function useUtilisateurCourant() {
  const [utilisateur, setUtilisateur] = useState<SessionUtilisateur | null>(null)

  useEffect(() => {
    setUtilisateur(getUtilisateurActif())

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'utilisateurActif') {
        setUtilisateur(getUtilisateurActif())
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return utilisateur
}
