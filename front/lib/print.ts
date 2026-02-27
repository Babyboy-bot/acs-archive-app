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

/**
 * Imprime un Blob (PDF ou image) en ouvrant une fenêtre dédiée.
 *
 * Stratégie :
 * - PDF  : ouvre le blob dans un nouvel onglet (le viewer natif du navigateur
 *          gère l'impression via Ctrl+P ou le bouton intégré).
 * - Image : ouvre une page HTML minimale contenant l'image et déclenche
 *          window.print() automatiquement après chargement.
 * - Autre : ouvre le fallback URL dans un nouvel onglet.
 */
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

  const type = (mimeType ?? '').toLowerCase()
  const guessedUrl = sourceUrl ?? ''

  const isPdf =
    knownType === 'pdf' ||
    type.includes('pdf') ||
    ((!type || type === 'application/octet-stream') && /\.pdf(?:$|[#?])/.test(guessedUrl))

  const isImage =
    knownType === 'image' ||
    type.startsWith('image/') ||
    ((!type || type === 'application/octet-stream') && /\.(png|jpe?g|gif|bmp|webp|tiff?)(?:$|[#?])/i.test(guessedUrl))

  if (!isPdf && !isImage) {
    const target = fallbackUrl ?? sourceUrl
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
    return
  }

  const blobUrl = URL.createObjectURL(blob)

  if (isPdf) {
    // Ouvrir le PDF dans un nouvel onglet : le viewer PDF natif du navigateur
    // offre un bouton d'impression intégré, fiable sur tous les navigateurs.
    const printWindow = window.open(blobUrl, '_blank')
    if (!printWindow) {
      // Popup bloquée par le navigateur : fallback téléchargement
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${title}.pdf`
      a.click()
      URL.revokeObjectURL(blobUrl)
    }
    // Note : on ne révoque pas immédiatement le blobUrl car la fenêtre en a
    // besoin. Le GC le libérera à la fermeture de l'onglet.
    return
  }

  // Image : générer une page HTML avec impression automatique
  const safeTitle = sanitize(title)
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      @media print {
        @page { margin: 1cm; }
        body { margin: 0; }
      }
      html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
      img {
        display: block;
        max-width: 100%;
        max-height: 100vh;
        margin: 0 auto;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <img id="img" src="${blobUrl}" alt="${safeTitle}" />
    <script>
      var img = document.getElementById('img');
      img.onload = function() { window.print(); };
      img.onerror = function() { document.body.textContent = 'Erreur de chargement'; };
    </script>
  </body>
</html>`

  const htmlBlob = new Blob([html], { type: 'text/html' })
  const htmlUrl = URL.createObjectURL(htmlBlob)
  const printWindow = window.open(htmlUrl, '_blank')

  if (!printWindow) {
    // Popup bloquée : ouvrir directement l'image
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
    URL.revokeObjectURL(htmlUrl)
  }
}
