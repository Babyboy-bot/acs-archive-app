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

  // Timeout plus long pour les uploads de fichiers (120s), sinon 20s
  const isUpload = rest.body instanceof FormData
  const timeoutMs = isUpload ? 120000 : 20000
  
  // Créer un contrôleur d'abandon avec timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('Request timeout'), timeoutMs)

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
      const timeoutSec = timeoutMs / 1000
      console.error(`La requête a expiré après ${timeoutSec} secondes`, { path })
      throw new Error('La requête a pris trop de temps. Veuillez réessayer.')
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
