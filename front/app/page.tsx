'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SplashScreen } from '@/components/SplashScreen'

export default function Home() {
  const router = useRouter()
  const [splashTermine, setSplashTermine] = useState(false)

  useEffect(() => {
    if (splashTermine) {
      // Redirection vers connexion après la fin du splash
      router.push('/connexion')
    }
  }, [splashTermine, router])

  return (
    <>
      {!splashTermine && <SplashScreen surTermine={() => setSplashTermine(true)} />}
    </>
  );
}
