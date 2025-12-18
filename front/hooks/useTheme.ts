'use client'

import { useState, useEffect } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkTheme = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('theme')
        setIsDark(stored === 'dark')
      }
    }

    checkTheme()

    // Écouter les changements de thème dans le localStorage
    window.addEventListener('storage', checkTheme)

    // Écouter les changements de thème dans la même fenêtre
    const interval = setInterval(checkTheme, 500)

    return () => {
      window.removeEventListener('storage', checkTheme)
      clearInterval(interval)
    }
  }, [])

  return { isDark }
}
