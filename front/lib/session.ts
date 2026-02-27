import { RoleUtilisateur } from '@/types'

export type SessionUtilisateur = {
  id: string
  nomUtilisateur: string
  nom: string
  prenom: string
  email: string | null
  role: RoleUtilisateur
}

export type RoleUtilisateurCode = SessionUtilisateur['role']

const UTILISATEUR_KEY = 'utilisateurActif'
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? (typeof window !== 'undefined' ? '/api' : 'http://backend:8000/api')

const REFRESH_ENDPOINT = '/api/auth/refresh/'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function enregistrerSession(session: {
  utilisateur: SessionUtilisateur
}) {
  if (!isBrowser()) return
  localStorage.setItem(UTILISATEUR_KEY, JSON.stringify(session.utilisateur))
}

export function getToken(): string | null {
  if (!isBrowser()) return null
  // L'authentification repose désormais uniquement sur les cookies httpOnly.
  return null
}

export function getUtilisateurActif(): SessionUtilisateur | null {
  if (!isBrowser()) return null
  const brut = localStorage.getItem(UTILISATEUR_KEY)
  if (!brut) return null
  try {
    return JSON.parse(brut) as SessionUtilisateur
  } catch (error) {
    console.warn('Impossible de parser utilisateurActif:', error)
    return null
  }
}

export function supprimerSession() {
  if (!isBrowser()) return
  localStorage.removeItem(UTILISATEUR_KEY)
}

export async function verifierSessionServeur({ timeoutMs = 8000 }: { timeoutMs?: number } = {}): Promise<boolean> {
  if (!isBrowser()) return false

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    return response.ok
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`Vérification de session expirée après ${timeoutMs}ms`)
    } else {
      console.warn('Impossible de vérifier la session côté serveur:', error)
    }
    return false
  } finally {
    window.clearTimeout(timeoutId)
  }
}
