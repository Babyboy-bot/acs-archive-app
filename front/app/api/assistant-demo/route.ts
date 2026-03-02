import { NextResponse } from 'next/server'
import { verifierRateLimit, generateSessionId } from './security'
import type { AssistantResponse } from './types'
import { extraireCriteresRecherche } from './criteria'

const ASSISTANT_ENABLED = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? 'true').toLowerCase() !== 'false'

export async function POST(request: Request) {
  let payload: { question?: string; conversationId?: string | null }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ erreur: 'Corps de requête invalide' }, { status: 400 })
  }

  const question = payload.question?.trim()
  if (!question) {
    return NextResponse.json({ erreur: 'La question est requise' }, { status: 400 })
  }

  if (!ASSISTANT_ENABLED) {
    return NextResponse.json({ erreur: 'Assistant désactivé' }, { status: 503 })
  }

  // Rate limit par IP
  const rateLimit = verifierRateLimit(request)
  if (!rateLimit.ok) {
    return NextResponse.json({ erreur: 'Trop de requêtes, réessayez dans quelques instants.' }, { status: 429 })
  }

  // Extraire les critères de recherche pour les logs
  const criteres = extraireCriteresRecherche(question)

  // Vérifier le rôle de l'utilisateur
  const role = request.headers.get('x-user-role')?.trim().toUpperCase()
  if (!role || !['ADMIN', 'ARCHIVISTE', 'CONSULTANT'].includes(role)) {
    return NextResponse.json({ erreur: 'Rôle utilisateur manquant ou invalide.' }, { status: 401 })
  }

  // conversationId requis côté backend → fallback stable si absent
  const cookieHeader = request.headers.get('cookie')
  const conversationId = payload.conversationId ?? generateSessionId(cookieHeader, null)

  try {
    const backendBaseUrlRaw = process.env.INTERNAL_API_BASE_URL ?? 'http://backend:8000/api'
    const backendBaseUrl = backendBaseUrlRaw.startsWith('http://') || backendBaseUrlRaw.startsWith('https://')
      ? backendBaseUrlRaw
      : `http://nginx${backendBaseUrlRaw.startsWith('/') ? '' : '/'}${backendBaseUrlRaw}`

    const response = await fetch(`${backendBaseUrl}/assistant/chat/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': role,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        question,
        conversation_id: conversationId,
        criteres_extraits: criteres,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let asJson: Record<string, unknown> | null = null
      try {
        asJson = text ? (JSON.parse(text) as Record<string, unknown>) : null
      } catch {
        asJson = null
      }

      console.error('assistant-demo backend error', {
        status: response.status,
        body: text,
      })

      const detail = (asJson?.detail ?? asJson?.erreur ?? asJson?.error) as string | undefined
      return NextResponse.json(
        { erreur: detail || (text ? text.slice(0, 500) : 'Erreur lors du traitement') },
        { status: response.status }
      )
    }

    const data: AssistantResponse = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur assistant-demo route:', error)
    return NextResponse.json({ erreur: 'Erreur serveur lors du traitement' }, { status: 500 })
  }
}
