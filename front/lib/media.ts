export function normalizeMediaUrl(url?: string | null): string | null {
  if (!url) return null

  let value = url.trim()
  if (!value) return null

  // Harmoniser les séparateurs
  value = value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(':/', '://')

  const ensureMediaPrefix = (path: string) => {
    if (path.startsWith('/media/')) return path
    if (path.startsWith('media/')) return `/${path}`
    if (path.startsWith('/')) return `/media${path}`
    return `/media/${path}`
  }

  // Cas URLs absolues
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value)
      const pathname = parsed.pathname || ''
      if (pathname.startsWith('/api/media/')) {
        return pathname.replace('/api', '')
      }
      if (pathname.startsWith('/media/')) {
        return pathname
      }
      if (pathname) {
        return ensureMediaPrefix(pathname.replace(/^\//, ''))
      }
    } catch {
      // on continue avec la valeur brute
    }
  }

  if (value.startsWith('/api/media/')) {
    return value.replace('/api', '')
  }

  if (value.startsWith('/media/')) {
    return value
  }

  return ensureMediaPrefix(value.replace(/^\/+/, ''))
}
