'use client'

import { useEffect } from 'react'
import { applyTheme, getStoredTheme } from '../lib/theme'

export function ThemeInitializer() {
  useEffect(() => {
    const stored = getStoredTheme() || 'light'
    applyTheme(stored)
  }, [])

  return null
}
