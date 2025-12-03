export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

function resolveTargetUrl(rawUrl: string): string {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api'
  const base = apiBase.replace(/\/?api\/?$/, '/')
  const sanitizedPath = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl
  return new URL(sanitizedPath, base).toString()
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const targetParam = url.searchParams.get('url')

  if (!targetParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  const targetUrl = resolveTargetUrl(targetParam)

  const headers = new Headers()
  const authorization = request.headers.get('authorization')
  if (authorization) {
    headers.set('Authorization', authorization)
  }
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('Cookie', cookie)
  }
  headers.set('Accept', 'application/pdf')

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
