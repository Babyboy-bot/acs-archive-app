export type KnownResourceType = 'pdf' | 'image' | 'unknown'

interface PrintBlobOptions {
  blob: Blob
  title?: string
  mimeType?: string | null
  sourceUrl?: string | null
  fallbackUrl?: string | null
  knownType?: KnownResourceType
}

const sanitize = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export async function printBlob({
  blob,
  title = 'Document',
  mimeType,
  sourceUrl,
  fallbackUrl,
  knownType = 'unknown',
}: PrintBlobOptions) {
  if (typeof window === 'undefined') {
    return
  }

  const blobUrl = URL.createObjectURL(blob)
  const resolvedFallback = fallbackUrl ?? sourceUrl ?? blobUrl

  const type = (mimeType ?? '').toLowerCase()
  const guessedUrl = sourceUrl ?? ''

  const isPdf =
    knownType === 'pdf' ||
    type.includes('pdf') ||
    (!type || type === 'application/octet-stream') && /\.pdf(?:$|[#?])/.test(guessedUrl)

  const isImage =
    knownType === 'image' ||
    type.startsWith('image/') ||
    (!type || type === 'application/octet-stream') && /\.(png|jpe?g|gif|bmp|webp|tiff?)(?:$|[#?])/i.test(guessedUrl)

  if (!isPdf && !isImage) {
    URL.revokeObjectURL(blobUrl)
    window.open(resolvedFallback, '_blank', 'noopener,noreferrer')
    return
  }

  await new Promise<void>((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const cleanup = () => {
      URL.revokeObjectURL(blobUrl)
      iframe.onload = null
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
      resolve()
    }

    const fallbackOpen = () => {
      window.open(resolvedFallback, '_blank', 'noopener,noreferrer')
      setTimeout(cleanup, 100)
    }

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (error) {
        fallbackOpen()
        return
      }
      setTimeout(cleanup, 600)
    }

    if (isPdf) {
      iframe.onload = triggerPrint
      iframe.onerror = fallbackOpen
      iframe.src = blobUrl
      return
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) {
      fallbackOpen()
      return
    }

    const safeTitle = sanitize(title)
    doc.open()
    doc.write(`<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${safeTitle}</title>
          <style>
            html, body { margin: 0; padding: 0; height: 100%; }
            body { background: #fff; }
            img { width: 100%; height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${blobUrl}" alt="${safeTitle}" />
        </body>
      </html>`)
    doc.close()

    const image = doc.querySelector('img')
    if (!image) {
      fallbackOpen()
      return
    }

    image.addEventListener(
      'load',
      () => {
        triggerPrint()
      },
      { once: true }
    )

    image.addEventListener(
      'error',
      () => {
        fallbackOpen()
      },
      { once: true }
    )
  })
}
