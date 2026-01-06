export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

function resolveTargetUrl(rawUrl: string): string {
  // Base URL du backend (sans /api) - utiliser INTERNAL_API_BASE_URL pour les appels serveur
  const apiBase = process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api'
  const backendBase = apiBase.replace(/\/api\/?$/, '')
  const dockerMediaBase = apiBase.includes('backend:') ? 'http://nginx' : backendBase

  const rewriteMediaIfNeeded = (candidate: string) => {
    // En Docker, on sert /media via nginx (alias /var/www/media) pour garder un content-type correct.
    // Si on fetch /media via Django (backend), certains fichiers peuvent être renvoyés en octet-stream
    // ou avec des headers qui empêchent l'aperçu.
    try {
      const u = new URL(candidate)
      if (u.pathname.startsWith('/media/')) {
        // Si candidate pointe vers le backend docker, le réécrire vers nginx.
        if (u.hostname === 'backend' || u.host === 'backend:8000') {
          return `${dockerMediaBase}${u.pathname}${u.search}${u.hash}`
        }
      }
    } catch {
      // ignore
    }

    if (candidate.startsWith(`${backendBase}/media/`)) {
      return candidate.replace(backendBase, dockerMediaBase)
    }

    return candidate
  }

  // Si l'URL est absolue avec localhost:8000, la réécrire pour utiliser le hostname Docker
  if (rawUrl.startsWith('http://localhost:8000')) {
    return rewriteMediaIfNeeded(rawUrl.replace('http://localhost:8000', backendBase))
  }

  // Dans Docker, "localhost" depuis ce route handler = le conteneur frontend.
  // Or les URLs de fichiers peuvent être générées en http://localhost/media/... côté UI.
  // On les réécrit vers le backend pour éviter les 502.
  if (rawUrl.startsWith('http://localhost/')) {
    const rewritten = rawUrl.replace('http://localhost', backendBase)
    return rewriteMediaIfNeeded(rewritten)
  }

  if (rawUrl.startsWith('http://127.0.0.1/')) {
    const rewritten = rawUrl.replace('http://127.0.0.1', backendBase)
    return rewriteMediaIfNeeded(rewritten)
  }
  
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rewriteMediaIfNeeded(rawUrl)
  }
  
  // Si l'URL commence par /media ou /api, utiliser la base du backend
  if (rawUrl.startsWith('/media/') || rawUrl.startsWith('/api/')) {
    if (rawUrl.startsWith('/media/')) {
      return `${dockerMediaBase}${rawUrl}`
    }
    return `${backendBase}${rawUrl}`
  }
  
  // Sinon, construire l'URL relative au backend
  const sanitizedPath = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl
  return `${backendBase}/${sanitizedPath}`
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const targetParam = url.searchParams.get('url')

  if (!targetParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  const targetUrl = resolveTargetUrl(targetParam)
  console.log('[proxy/document] target', targetUrl)

  const headers = new Headers()
  const authorization = request.headers.get('authorization')
  if (authorization) {
    headers.set('Authorization', authorization)
  }
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('Cookie', cookie)
  }
  headers.set('Accept', 'application/pdf, image/*, application/octet-stream, */*')

  try {
    const backendResponse = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!backendResponse.ok) {
      const message = await backendResponse.text()
      return new NextResponse(message, {
        status: backendResponse.status,
        headers: {
          'Content-Type': backendResponse.headers.get('content-type') ?? 'text/plain',
        },
      })
    }

    const arrayBuffer = await backendResponse.arrayBuffer()

    const responseHeaders = new Headers()
    const contentType = backendResponse.headers.get('content-type') ?? 'application/pdf'
    responseHeaders.set('Content-Type', contentType)

    const contentDisposition = backendResponse.headers.get('content-disposition')
    if (contentDisposition) {
      responseHeaders.set('Content-Disposition', contentDisposition)
    }

    responseHeaders.set('Content-Length', String(arrayBuffer.byteLength))

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Document proxy error', error)
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 502 })
  }
}
