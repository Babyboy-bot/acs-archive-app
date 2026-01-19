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

const TOKEN_KEY = 'authToken'
const REFRESH_KEY = 'refreshToken'
const UTILISATEUR_KEY = 'utilisateurActif'
const DEFAULT_BROWSER_API_BASE_URL = process.env.NODE_ENV === 'development' ? 'http://backend:8000/api' : '/api'
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? (typeof window !== 'undefined' ? DEFAULT_BROWSER_API_BASE_URL : 'http://backend:8000/api')

function isBrowser() {
  return typeof window !== 'undefined'
}

export function enregistrerSession(session: {
  utilisateur: SessionUtilisateur
}) {
  if (!isBrowser()) return
  try {
    // Nettoyage défensif d'anciens tokens éventuels
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  } catch {
    // Ignorer les erreurs de quota ou d'accès
  }
  localStorage.setItem(UTILISATEUR_KEY, JSON.stringify(session.utilisateur))
}

export function getToken(): string | null {
  if (!isBrowser()) return null
  // L'authentification repose désormais uniquement sur les cookies httpOnly.
  return null
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null
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
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(UTILISATEUR_KEY)
}
