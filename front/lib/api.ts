import { API_BASE_URL, getToken } from './session'

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean
}

export function buildApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  if (path.startsWith('/')) {
    return `${API_BASE_URL}${path}`
  }

  return `${API_BASE_URL}/${path}`
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { skipAuth, headers, signal, ...rest } = options
  const finalHeaders = new Headers(headers ?? {})

  // L'authentification est gérée côté backend via les cookies httpOnly (access_token).

  // Créer un contrôleur d'abandon avec un timeout de 20 secondes
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('Request timeout'), 20000) // 20 secondes

  try {
    const init: RequestInit = {
      // Toujours envoyer les cookies (access_token, refresh_token) pour les appels API
      credentials: rest.credentials ?? 'include',
      ...rest,
      signal: signal || controller.signal, // Utiliser le signal fourni ou notre contrôleur
      headers: finalHeaders,
    }

    const response = await fetch(buildApiUrl(path), init)
    clearTimeout(timeoutId) // Annuler le timeout si la requête réussit
    return response
  } catch (error) {
    clearTimeout(timeoutId) // Nettoyer le timeout en cas d'erreur
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('La requête a expiré après 20 secondes', { path })
      throw new Error('La requête a pris trop de temps. Veuillez réessayer avec des termes de recherche plus précis.')
    }
    throw error // Propager les autres erreurs
  }
}

export async function apiFetchJson<T = unknown>(path: string, options: ApiFetchOptions = {}) {
  const response = await apiFetch(path, options)
  let data: T | undefined
  try {
    data = await response.json()
  } catch (error) {
    data = undefined
  }

  return { response, data }
}
