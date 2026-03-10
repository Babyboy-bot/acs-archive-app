import { verifierRateLimit } from '../security'
import { extraireCriteresRecherche } from '../criteria'

const ASSISTANT_ENABLED = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? 'true').toLowerCase() !== 'false'

export async function POST(request: Request) {
  let payload: { question?: string; conversationId?: string | null }
  try {
    payload = await request.json()
  } catch {
    return new Response(JSON.stringify({ erreur: 'Corps de requête invalide' }), { status: 400 })
  }

  const question = payload.question?.trim()
  if (!question) {
    return new Response(JSON.stringify({ erreur: 'La question est requise' }), { status: 400 })
  }

  if (!ASSISTANT_ENABLED) {
    return new Response(JSON.stringify({ erreur: 'Assistant désactivé' }), { status: 503 })
  }

  const rateLimit = verifierRateLimit(request)
  if (!rateLimit.ok) {
    return new Response(JSON.stringify({ erreur: 'Trop de requêtes, réessayez dans quelques instants.' }), { status: 429 })
  }

  const role = request.headers.get('x-user-role')?.trim().toUpperCase()
  if (!role || !['ADMIN', 'ARCHIVISTE', 'CONSULTANT'].includes(role)) {
    return new Response(JSON.stringify({ erreur: 'Rôle utilisateur manquant ou invalide.' }), { status: 401 })
  }

  const cookieHeader = request.headers.get('cookie') ?? ''
  const conversationId = payload.conversationId ?? null

  if (!conversationId) {
    return new Response(JSON.stringify({ erreur: 'conversationId requis pour le streaming' }), { status: 400 })
  }

  const criteres = extraireCriteresRecherche(question)
  const backendBaseUrlRaw = process.env.INTERNAL_API_BASE_URL ?? 'http://backend:8000/api'
  const backendBaseUrl = backendBaseUrlRaw.startsWith('http://') || backendBaseUrlRaw.startsWith('https://')
    ? backendBaseUrlRaw
    : `http://nginx${backendBaseUrlRaw.startsWith('/') ? '' : '/'}${backendBaseUrlRaw}`

  try {
    const upstreamResponse = await fetch(`${backendBaseUrl}/assistant/chat/stream/`, {
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

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text().catch(() => '')
      return new Response(
        JSON.stringify({ erreur: text || 'Erreur upstream streaming' }),
        { status: upstreamResponse.status }
      )
    }

    // Passer le stream SSE Django directement au navigateur
    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Erreur streaming assistant-demo:', err)
    return new Response(JSON.stringify({ erreur: 'Erreur lors du streaming' }), { status: 500 })
  }
}
