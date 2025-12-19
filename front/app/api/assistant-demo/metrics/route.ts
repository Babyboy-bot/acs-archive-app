import { NextResponse } from 'next/server'
import { metricsSnapshot } from '../telemetry'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api'
const API_BASE = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`

/**
 * GET /api/assistant-demo/metrics
 * Retourne les métriques de l'assistant (réservé aux admins)
 */
export async function GET(request: Request) {
  // Vérifier l'authentification via le cookie
  const cookie = request.headers.get('cookie') ?? ''
  
  if (!cookie) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  // Vérifier le rôle de l'utilisateur via le backend
  try {
    const userResponse = await fetch(`${API_BASE}users/me/`, {
      headers: { cookie },
    })

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Authentification invalide' },
        { status: 401 }
      )
    }

    const userData = await userResponse.json()
    
    // Seuls les admins peuvent voir les métriques
    if (userData.role !== 'ADMIN' && userData.role !== 'ARCHIVISTE') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      )
    }

    return NextResponse.json(metricsSnapshot())
  } catch (error) {
    console.error('Erreur vérification auth metrics:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification des droits' },
      { status: 500 }
    )
  }
}
