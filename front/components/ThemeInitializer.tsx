'use client'

import { useEffect } from 'react'
import { applyTheme, getStoredTheme } from '../lib/theme'

export function ThemeInitializer() {
  useEffect(() => {
    const mode = getStoredTheme()
    applyTheme(mode)
  }, [])

  return null
}
