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
  const { skipAuth, headers, ...rest } = options
  const finalHeaders = new Headers(headers ?? {})

  if (!skipAuth) {
    const token = getToken()
    if (token && !finalHeaders.has('Authorization')) {
      finalHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  const init: RequestInit = {
    ...rest,
    headers: finalHeaders
  }

  return fetch(buildApiUrl(path), init)
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
