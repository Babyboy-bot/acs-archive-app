'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { PreviewPDF } from '@/components/PreviewPDF'
import { apiFetchJson, buildApiUrl } from '@/lib/api'
import { exporterCSV, exporterExcel, exporterPDF } from '@/lib/export'

type DocumentUI = {
  id: string
  titre: string
  reference: string
  client: string
  exercice: string
  risque: string
  typeCourrier: string
  date: string
  taille: string
  color: string
  urlFichier: string | null
  source: any
}

type PreviewState = {
  titre: string
  url?: string | null
} | null

const RISQUE_COLORS: Record<string, string> = {
  AUTOMOBILE: '#D32027',
  SANTE: '#10B981',
  HABITATION: '#F59E0B',
  VIE: '#8B5CF6',
  RESPONSABILITE_CIVILE: '#0066B3',
}

const COURRIER_LABELS: Record<string, string> = {
  ACS_VERS_CLIENT: 'ACS → Client',
  ACS_VERS_COMPAGNIE: 'ACS → Compagnie',
  AVENANT: 'Avenant',
  FACTURE: 'Facture',
  REGLEMENT: 'Règlement',
  DIVERS: 'Divers',
  SINISTRE: 'Sinistre',
}

const formatTaille = (brut?: number | null) => {
  if (!brut || Number.isNaN(brut)) return '—'
  if (brut >= 1024 * 1024) {
    return `${(brut / (1024 * 1024)).toFixed(1)} MB`
  }
  if (brut >= 1024) {
    return `${(brut / 1024).toFixed(1)} KB`
  }
  return `${brut} B`
}

const determinerCouleurRisque = (risque: string) => RISQUE_COLORS[risque] ?? '#4B5563'

const libelleCourrier = (typeCourrier: string) => COURRIER_LABELS[typeCourrier] ?? typeCourrier ?? '—'

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString()
}

export default function PageDocuments() {
  const [recherche, setRecherche] = useState('')
  const [filtreRisque, setFiltreRisque] = useState('')
  const [filtreCourrier, setFiltreCourrier] = useState('')
  const [vueMode, setVueMode] = useState<'grille' | 'liste'>('grille')
  const [documents, setDocuments] = useState<DocumentUI[]>([])
  const [menuExportOuvert, setMenuExportOuvert] = useState(false)
  const [previewOuvert, setPreviewOuvert] = useState(false)
  const [documentPreview, setDocumentPreview] = useState<PreviewState>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let annule = false

    const chargerDocuments = async () => {
      setChargement(true)
      setErreur('')
      try {
        const { response, data } = await apiFetchJson('/documents/')
        if (!response.ok) {
          throw new Error((data as any)?.detail ?? 'Impossible de charger les documents')
        }

        const bruts: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.results)
            ? (data as any).results
            : []

        const normalises = bruts.map((doc) => {
          const risqueDetail = doc.risque_detail ?? doc.risqueDetail ?? null
          const exerciceInfo = risqueDetail?.exercice_info ?? risqueDetail?.exerciceInfo ?? {}
          const clientNom = exerciceInfo?.client ?? doc.client ?? 'Client inconnu'
          const annee = exerciceInfo?.annee ?? doc.exercice ?? '—'
          const typeRisque = (risqueDetail?.type ?? doc.risque ?? 'AUTRE') as string
          const creeLe = doc.cree_le ?? doc.creeLe ?? null
          const fichierUrl = doc.fichier_url ?? doc.fichierUrl ?? null
          const typeCourrier = doc.type_courrier ?? doc.typeCourrier ?? 'AUTRE'
          const tailleBrute = doc.taille_fichier ?? doc.tailleFichier ?? null

          return {
            id: doc.id,
            titre: doc.titre ?? 'Document sans titre',
            reference: doc.reference ?? '',
            client: clientNom,
            exercice: String(annee),
            risque: typeRisque,
            typeCourrier,
            date: formatDate(creeLe),
            taille: formatTaille(typeof tailleBrute === 'number' ? tailleBrute : Number(tailleBrute)),
            color: determinerCouleurRisque(typeRisque),
            urlFichier: fichierUrl,
            source: doc,
          } as DocumentUI
        })

        if (!annule) {
          setDocuments(normalises)
        }
      } catch (error: any) {
        console.error('Erreur lors du chargement des documents', error)
        if (!annule) {
          setErreur(error?.message ?? 'Erreur lors du chargement des documents')
        }
      } finally {
        if (!annule) {
          setChargement(false)
        }
      }
    }

    void chargerDocuments()

    return () => {
      annule = true
    }
  }, [])

  const documentsFiltres = useMemo(() => {
    const rechercheNorm = recherche.trim().toLowerCase()
    return documents.filter((doc) => {
      const matchRecherche =
        !rechercheNorm ||
        doc.titre.toLowerCase().includes(rechercheNorm) ||
        doc.client.toLowerCase().includes(rechercheNorm) ||
        doc.reference.toLowerCase().includes(rechercheNorm)

      const matchRisque = !filtreRisque || doc.risque === filtreRisque
      const matchCourrier = !filtreCourrier || doc.typeCourrier === filtreCourrier

      return matchRecherche && matchRisque && matchCourrier
    })
  }, [documents, recherche, filtreCourrier, filtreRisque])

  const extraireUrlDocument = (doc: DocumentUI) =>
    doc.source?.fichier_url ?? doc.source?.fichierUrl ?? doc.urlFichier ?? null

  const ouvrirPreview = (doc: DocumentUI) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreur('Aucune prévisualisation disponible pour ce document')
      return
    }
    setErreur('')
    setDocumentPreview({ titre: doc.titre, url })
    setPreviewOuvert(true)
  }

  const ouvrirDansNouvelOnglet = (doc: DocumentUI) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreur('Aucune prévisualisation disponible pour ce document')
      return
    }

    setErreur('')
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const telechargerDocument = (doc: DocumentUI) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreur('Document introuvable sur le serveur')
      return
    }

    setErreur('')
    if (typeof window !== 'undefined') {
      const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : buildApiUrl(url)
      const proxyUrl = `/api/proxy/document?url=${encodeURIComponent(resolvedUrl)}`

      const startDownload = async () => {
        try {
          const response = await fetch(proxyUrl, {
            credentials: 'include',
            headers: { Accept: 'application/pdf' },
          })

          if (!response.ok) {
            throw new Error(`Erreur ${response.status}`)
          }

          const blob = await response.blob()
          const objectUrl = URL.createObjectURL(blob)

          const lien = document.createElement('a')
          lien.href = objectUrl
          lien.download = doc.titre || 'document'
          document.body.appendChild(lien)
          lien.click()
          document.body.removeChild(lien)
          URL.revokeObjectURL(objectUrl)
        } catch (error) {
          console.error('Téléchargement direct', error)
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
        }
      }

      void startDownload()
    }
  }

  const supprimerDocument = async (doc: DocumentUI) => {
    const confirmation = window.confirm(`Supprimer définitivement « ${doc.titre} » ?`)
    if (!confirmation) return

    setSuppressionEnCours(doc.id)
    setErreur('')

    try {
      const { response, data } = await apiFetchJson(`/documents/${doc.id}/`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error((data as any)?.erreur ?? (data as any)?.detail ?? 'Suppression impossible')
      }

      setDocuments((precedent) => precedent.filter((item) => item.id !== doc.id))
      if (documentPreview?.titre === doc.titre) {
        setDocumentPreview(null)
        setPreviewOuvert(false)
      }
    } catch (error: any) {
      console.error('Erreur suppression document', error)
      setErreur(error?.message ?? 'Erreur lors de la suppression du document')
    } finally {
      setSuppressionEnCours(null)
    }
  }

  const risques = [
    { value: '', label: 'Tous les risques' },
    { value: 'AUTOMOBILE', label: 'Automobile' },
    { value: 'SANTE', label: 'Santé' },
    { value: 'HABITATION', label: 'Habitation' },
    { value: 'VIE', label: 'Vie' },
    { value: 'RESPONSABILITE_CIVILE', label: 'Responsabilité civile' },
  ]

  const courriers = [
    { value: '', label: 'Tous les types' },
    ...Object.entries(COURRIER_LABELS).map(([value, label]) => ({ value, label })),
  ]

  const handleExport = (type: 'pdf' | 'excel' | 'csv') => {
    if (!documentsFiltres.length) {
      setErreur('Aucun document à exporter avec les filtres actuels')
      return
    }
    switch (type) {
      case 'pdf':
        exporterPDF(documentsFiltres, 'Liste des documents')
        break
      case 'excel':
        exporterExcel(documentsFiltres, 'documents')
        break
      case 'csv':
        exporterCSV(documentsFiltres, 'documents')
        break
    }
    setMenuExportOuvert(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <Icon name="folder" size="xl" className="text-red-600" />
              Documents
            </h1>
            <p className="text-gray-600">
              {documentsFiltres.length} document{documentsFiltres.length > 1 ? 's' : ''} disponible
              {documentsFiltres.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMenuExportOuvert((prev) => !prev)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <Icon name="download" size="sm" />
                Exporter
              </motion.button>
              {menuExportOuvert && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10"
                >
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-3 hover:bg-red-50 transition-colors text-left flex items-center gap-2"
                  >
                    <Icon name="document" size="sm" className="text-red-600" />
                    <span className="font-medium">Export PDF</span>
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full px-4 py-3 hover:bg-green-50 transition-colors text-left flex items-center gap-2"
                  >
                    <Icon name="card" size="sm" className="text-green-600" />
                    <span className="font-medium">Export Excel</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left flex items-center gap-2"
                  >
                    <Icon name="document" size="sm" className="text-blue-600" />
                    <span className="font-medium">Export CSV</span>
                  </button>
                </motion.div>
              )}
            </div>
            <Link href="/documents/nouveau">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <Icon name="upload" size="sm" />
                Nouveau document
              </motion.button>
            </Link>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher par titre, client, référence..."
                  className="w/full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icon name="search" size="sm" />
                </span>
              </div>
            </div>

            <select
              value={filtreRisque}
              onChange={(e) => setFiltreRisque(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            >
              {risques.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={filtreCourrier}
              onChange={(e) => setFiltreCourrier(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            >
              {courriers.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Affichage :</span>
            <button
              onClick={() => setVueMode('grille')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                vueMode === 'grille'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon name="card" size="sm" />
              Grille
            </button>
            <button
              onClick={() => setVueMode('liste')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                vueMode === 'liste'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon name="document" size="sm" />
              Liste
            </button>
          </div>
        </motion.section>

        {erreur && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          >
            {erreur}
          </motion.div>
        )}

        {chargement ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 bg-white rounded-2xl shadow-lg animate-pulse" />
            ))}
          </motion.div>
        ) : vueMode === 'grille' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentsFiltres.map((doc, index) => {
              const fichierUrl = extraireUrlDocument(doc)
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col"
                >
                  <div
                    className="h-32 relative flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${doc.color}dd 0%, ${doc.color} 100%)` }}
                  >
                    <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-semibold">
                      {doc.exercice}
                    </span>
                    <Icon name="document-solid" size="xl" className="text-white opacity-90" />
                  </div>

                  <div className="p-6 space-y-4 flex-1 flex flex-col">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{doc.titre}</h3>
                      <p className="text-sm text-gray-500 font-mono">{doc.reference || '—'}</p>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Icon name="building" size="xs" />
                        <span>{doc.client}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon name="calendar" size="xs" />
                        <span>{doc.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon name="inbox" size="xs" />
                        <span>{doc.taille}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon name="tag" size="xs" />
                        <span className="text-xs font-semibold" style={{ color: doc.color }}>
                          {doc.risque}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span
                        className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700"
                        style={{ backgroundColor: `${doc.color}20`, color: doc.color }}
                      >
                        {libelleCourrier(doc.typeCourrier)}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2 mt-auto flex-wrap">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => telechargerDocument(doc)}
                        disabled={!fichierUrl}
                        className="flex-1 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Icon name="download" size="sm" />
                        Télécharger
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => ouvrirDansNouvelOnglet(doc)}
                        disabled={!fichierUrl}
                        className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Icon name="eye" size="sm" />
                        Voir
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => supprimerDocument(doc)}
                        disabled={suppressionEnCours === doc.id}
                        className="py-2 px-3 bg-white border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <Icon name="trash" size="sm" />
                        {suppressionEnCours === doc.id ? 'Suppression…' : 'Supprimer'}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Document</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Client</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Risque</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Taille</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documentsFiltres.map((doc, index) => {
                    const fichierUrl = extraireUrlDocument(doc)
                    return (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.04 }}
                        className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                              <Icon name="document-solid" className="text-gray-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{doc.titre}</p>
                              <p className="text-sm text-gray-500 font-mono">{doc.reference || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{doc.client}</td>
                        <td className="px-6 py-4">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: `${doc.color}20`, color: doc.color }}
                          >
                            {doc.risque}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                            {libelleCourrier(doc.typeCourrier)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">{doc.date}</td>
                        <td className="px-6 py-4 text-gray-600 text-sm">{doc.taille}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              onClick={() => telechargerDocument(doc)}
                              disabled={!fichierUrl}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Télécharger"
                            >
                              <Icon name="download" size="sm" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              onClick={() => ouvrirDansNouvelOnglet(doc)}
                              disabled={!fichierUrl}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Voir"
                            >
                              <Icon name="eye" size="sm" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              onClick={() => supprimerDocument(doc)}
                              disabled={suppressionEnCours === doc.id}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                              title="Supprimer"
                            >
                              <Icon name="trash" size="sm" className="text-red-600" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!chargement && documentsFiltres.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-2xl shadow-lg"
          >
            <Icon name="folder" size="xl" className="mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-semibold text-gray-700 mb-2">Aucun document trouvé</p>
            <p className="text-gray-500 mb-6">Modifiez vos filtres ou ajoutez un nouveau document</p>
            <Link href="/documents/nouveau">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg inline-flex items-center gap-2"
              >
                <Icon name="upload" size="sm" />
                Ajouter un document
              </motion.button>
            </Link>
          </motion.div>
        )}

        <PreviewPDF
          ouvert={previewOuvert}
          onFermer={() => {
            setPreviewOuvert(false)
            setDocumentPreview(null)
          }}
          titre={documentPreview?.titre ?? ''}
          urlDocument={documentPreview?.url ?? undefined}
        />
      </main>
    </div>
  )
}
