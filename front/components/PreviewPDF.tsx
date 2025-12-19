'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { buildApiUrl } from '@/lib/api'
import { getToken } from '@/lib/session'
import { printBlob } from '@/lib/print'
import { motion, AnimatePresence } from 'framer-motion'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'

interface PreviewPDFProps {
  ouvert: boolean
  onFermer: () => void
  titre: string
  urlDocument?: string
}

export function PreviewPDF({ ouvert, onFermer, titre, urlDocument }: PreviewPDFProps) {
  const utilisateur = useUtilisateurCourant()
  const canDownload = utilisateur?.role !== 'CONSULTANT' // 🔒 PDG: Consultants ne peuvent pas télécharger
  
  const [zoom, setZoom] = useState(40)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resourceType, setResourceType] = useState<'pdf' | 'image' | 'unknown'>('unknown')

  const resolvedUrl = useMemo(() => {
    if (!urlDocument) return null
    if (urlDocument.startsWith('http://') || urlDocument.startsWith('https://')) {
      return urlDocument
    }
    return buildApiUrl(urlDocument)
  }, [urlDocument])

  const fetchUrl = useMemo(() => {
    if (!resolvedUrl) return null
    return `/api/proxy/document?url=${encodeURIComponent(resolvedUrl)}`
  }, [resolvedUrl])

  useEffect(() => {
    let isMounted = true
    let currentObjectUrl: string | null = null

    const chargerPdf = async () => {
      if (!resolvedUrl || !fetchUrl || !ouvert) {
        setPreviewUrl(null)
        setError(null)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const headers = new Headers()
        const token = getToken()
        if (token) {
          headers.set('Authorization', `Bearer ${token}`)
        }
        headers.set('Accept', 'application/pdf')

        const response = await fetch(fetchUrl, {
          headers,
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`)
        }

        const contentType = response.headers.get('content-type') ?? ''

        setResourceType(contentType.includes('pdf') ? 'pdf' : contentType.startsWith('image/') ? 'image' : 'unknown')

        const blob = await response.blob()
        if (!isMounted) return

        currentObjectUrl = URL.createObjectURL(blob)
        setPreviewUrl(currentObjectUrl)
      } catch (err: any) {
        console.warn('Prévisualisation PDF — utilisation d\'une URL alternative', err)
        if (isMounted) {
          const fallbackPreview = fetchUrl ?? resolvedUrl ?? null
          setResourceType('unknown')
          if (err instanceof TypeError) {
            setError(null)
            setPreviewUrl(fallbackPreview)
          } else {
            setError(err?.message ?? "Impossible de charger le PDF")
            setPreviewUrl(fallbackPreview)
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void chargerPdf()

    return () => {
      isMounted = false
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
      }
    }
  }, [resolvedUrl, fetchUrl, ouvert])

  useEffect(() => {
    setZoom(40)
    setResourceType('unknown')
  }, [previewUrl])

  const hasDocument = Boolean(previewUrl)

  const handleDownload = useCallback(async () => {
    const source = fetchUrl ?? resolvedUrl ?? previewUrl ?? urlDocument
    if (!source) return

    try {
      const headers = new Headers()
      const token = getToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      headers.set('Accept', 'application/pdf')

      const response = await fetch(source, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const lien = document.createElement('a')
      lien.href = objectUrl
      lien.download = titre || 'document.pdf'
      document.body.appendChild(lien)
      lien.click()
      document.body.removeChild(lien)
      URL.revokeObjectURL(objectUrl)
    } catch (error: any) {
      console.error('Téléchargement PDF', error)
      setError(error?.message ?? "Impossible de télécharger le document")
      if (resolvedUrl) {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
      }
    }
  }, [fetchUrl, resolvedUrl, previewUrl, urlDocument, titre])

  const handlePrint = useCallback(async () => {
    if (typeof window === 'undefined') return

    const source = fetchUrl ?? resolvedUrl ?? previewUrl ?? urlDocument
    if (!source) return

    try {
      const headers = new Headers()
      const token = getToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      headers.set('Accept', 'application/pdf,image/*')

      const response = await fetch(source, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`)
      }

      const blob = await response.blob()

      await printBlob({
        blob,
        title: titre || 'Document',
        mimeType: response.headers.get('content-type'),
        sourceUrl: resolvedUrl ?? urlDocument ?? null,
        fallbackUrl: resolvedUrl ?? urlDocument ?? null,
        knownType: resourceType,
      })
    } catch (error: any) {
      console.error('Impression document', error)
      setError(error?.message ?? "Impossible d'imprimer le document")
      if (resolvedUrl) {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
      }
    }
  }, [fetchUrl, resolvedUrl, previewUrl, urlDocument, titre, resourceType])

  const scale = zoom / 100
  const viewerWrapperStyle = useMemo<CSSProperties>(() => ({
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: `${100 / scale}%`,
    height: `${100 / scale}%`,
  }), [scale])

  return (
    <AnimatePresence>
      {ouvert && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onFermer}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white">
                    <Icon name="document" size="sm" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 truncate max-w-[26rem]" title={titre}>
                      {titre}
                    </h2>
                    <p className="text-sm text-gray-500">Prévisualisation du document PDF</p>
                  </div>
                </div>
                <button
                  onClick={onFermer}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon name="close" className="text-gray-500" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-200 bg-gray-50 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoom((prev) => Math.max(40, prev - 10))}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-gray-200 disabled:opacity-50"
                    disabled={!hasDocument}
                    title="Zoom -"
                  >
                    <span className="text-sm font-bold">-</span>
                  </button>
                  <span className="px-4 py-2 bg-white rounded-lg border border-gray-200 text-sm font-medium min-w-[4.5rem] text-center">
                    {zoom}%
                  </span>
                  <button
                    onClick={() => setZoom((prev) => Math.min(300, prev + 10))}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-gray-200 disabled:opacity-50"
                    disabled={!hasDocument}
                    title="Zoom +"
                  >
                    <span className="text-sm font-bold">+</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePrint}
                    disabled={!hasDocument}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    <Icon name="print" size="sm" />
                    Imprimer
                  </motion.button>
                  {canDownload && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDownload}
                      disabled={!hasDocument}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-60"
                    >
                      <Icon name="download" size="sm" />
                      Télécharger
                    </motion.button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-gray-100 p-4">
                <div className="h-full bg-white rounded-xl shadow-inner flex items-center justify-center p-4">
                  {loading ? (
                    <div className="text-center text-gray-500 space-y-3">
                      <Icon name="document" className="mx-auto animate-pulse" />
                      <p className="text-sm">Chargement du document…</p>
                    </div>
                  ) : hasDocument ? (
                    resourceType === 'image' ? (
                      <div className="w-full h-full overflow-auto">
                        <img
                          src={previewUrl ?? undefined}
                          alt={titre}
                          className="max-w-full h-auto mx-auto rounded-lg border border-gray-200 shadow-sm"
                          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full overflow-auto">
                        <div style={viewerWrapperStyle}>
                          <object
                            data={previewUrl ?? undefined}
                            type="application/pdf"
                            className="w-full h-full rounded-lg border border-gray-200 shadow-sm"
                          >
                            <p className="p-6 text-center text-sm text-gray-500">
                              Impossible d'afficher le PDF dans votre navigateur. Vous pouvez le télécharger ou l'ouvrir dans un nouvel onglet.
                            </p>
                          </object>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-center text-gray-500 space-y-3">
                      <Icon name="document" size="lg" className="mx-auto text-gray-400" />
                      <p className="font-medium">Aucune prévisualisation disponible</p>
                      <p className="text-sm">
                        Le document n'a pas d'URL accessible ou le fichier n'est pas encore prêt pour la lecture.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
