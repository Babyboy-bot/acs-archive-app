export type SessionUtilisateur = {
  id: string
  nomUtilisateur: string
  nom: string
  prenom: string
  email: string | null
  role: 'ADMIN' | 'GESTIONNAIRE' | 'EMPLOYE' | 'CONSULTANT'
}

const TOKEN_KEY = 'authToken'
const REFRESH_KEY = 'refreshToken'
const UTILISATEUR_KEY = 'utilisateurActif'
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function enregistrerSession(session: {
  token: string
  refresh?: string | null
  utilisateur: SessionUtilisateur
}) {
  if (!isBrowser()) return
  localStorage.setItem(TOKEN_KEY, session.token)
  if (session.refresh) {
    localStorage.setItem(REFRESH_KEY, session.refresh)
  }
  localStorage.setItem(UTILISATEUR_KEY, JSON.stringify(session.utilisateur))
}

export function getToken(): string | null {
  if (!isBrowser()) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null
  return localStorage.getItem(REFRESH_KEY)
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
