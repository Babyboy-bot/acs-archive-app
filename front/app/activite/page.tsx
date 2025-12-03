'use client'

import { useEffect } from 'react'
import { notFound } from 'next/navigation'

export default function PageActivite() {
  useEffect(() => {
    notFound()
  }, [])

  return null
}
