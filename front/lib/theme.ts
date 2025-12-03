export type ThemeMode = 'light' | 'dark' | null

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return null
  try {
    return (localStorage.getItem('theme') as ThemeMode) || null
  } catch {
    return null
  }
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  if (mode) {
    try {
      localStorage.setItem('theme', mode)
    } catch {}
  }
}
