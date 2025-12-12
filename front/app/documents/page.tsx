'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { hasPermission } from '@/lib/permissions'
import Link from 'next/link'
import { motion } from 'framer-motion'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { PreviewPDF } from '@/components/PreviewPDF'
import { apiFetchJson, buildApiUrl } from '@/lib/api'
import { getToken } from '@/lib/session'
import { printBlob } from '@/lib/print'
import { exporterCSV, exporterExcel, exporterPDF } from '@/lib/export'

type DocumentUI = {
  id: string
  titre: string
  reference: string
  client: string
  exercice: string
  risque: string
  risqueKey: string
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
  RETRAITE: '#6366F1',
  RETRAITE_COMPLEMENTAIRE: '#7C3AED',
  TEMPORAIRE_DECES: '#F43F5E',
  SINISTRE: '#DC2626',
  SANTE: '#10B981',
  HABITATION: '#F59E0B',
  VIE: '#9333EA',
  RESPONSABILITE_CIVILE: '#2563EB',
  PREVOYANCE_DECES: '#F59E0B',
  INDIVIDUELLE_ACCIDENTS: '#DC2626',
  MRP: '#7C3AED',
  TRANSPORT: '#0284C7',
  TRANSPORT_FACULTES: '#0891B2',
  CAUTION: '#EA580C',
  TOUS_RISQUES_CHANTIER: '#F97316',
  AUTRE: '#4B5563',
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

const hashString = (input: string) => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) & 0x7fffffff
  }
  return hash
}

const hslToHex = (h: number, s: number, l: number) => {
  const hue = h % 360
  const saturation = Math.max(0, Math.min(100, s)) / 100
  const lightness = Math.max(0, Math.min(100, l)) / 100

  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lightness - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = c
    g = x
    b = 0
  } else if (hue < 120) {
    r = x
    g = c
    b = 0
  } else if (hue < 180) {
    r = 0
    g = c
    b = x
  } else if (hue < 240) {
    r = 0
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    g = 0
    b = c
  } else {
    r = c
    g = 0
    b = x
  }

  const toHex = (value: number) => {
    const hex = Math.round((value + m) * 255).toString(16).padStart(2, '0')
    return hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const genererCouleurRisque = (key: string) => {
  const baseKey = key || 'DEFAULT'
  const hash = hashString(baseKey)
  const hue = hash % 360
  const saturation = 65
  const lightness = 48
  return hslToHex(hue, saturation, lightness)
}

const determinerCouleurRisque = (risque: string) => {
  const key = normalizeRisqueKey(risque)
  if (!key) {
    return '#4B5563'
  }
  if (RISQUE_COLORS[key]) {
    return RISQUE_COLORS[key]
  }
  return genererCouleurRisque(key)
}

const libelleCourrier = (typeCourrier: string) => COURRIER_LABELS[typeCourrier] ?? typeCourrier ?? '—'

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString()
}

const RISQUE_FALLBACK_TYPES = [
  'AUTOMOBILE',
  'RETRAITE',
  'RETRAITE COMPLEMENTAIRE',
  'TEMPORAIRE DECES',
  'SINISTRE',
  'SANTE',
  'HABITATION',
  'VIE',
  'RESPONSABILITE_CIVILE',
  'PREVOYANCE DECES',
  'INDIVIDUELLE ACCIDENTS',
  'TRANSPORT',
  'TRANSPORT FACULTES',
  'CAUTION',
  'TOUS RISQUES CHANTIER',
  'ASSISTANCE FRAIS FUNERAIRES',
  'FRAIS FUNERAIRES',
  'GLOBALE DOMMAGES',
  'GLOBALE BANQUE',
  'ASSURANCE DES STOCKS',
  'PREVOYANCE COLLECTIVE',
  'PREVOYANCE ENTREPRISE',
  'MULTIRISQUE BUREAU',
  'BRIS DE MACHINE',
  'EVACUATION SANITAIRE',
  'VOL ET DETOURNEMENTS',
  'AUTRE',
] as const

const normalizeRisqueKey = (value?: string | null) => {
  if (!value) return ''
  return value
    .toString()
    .normalize('NFD')
    .replace(/[^0-9a-zA-Z\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .normalize('NFC')
    .toUpperCase()
}

const formatRisqueLabel = (value?: string | null) => {
  if (!value) return 'Autre'
  const sanitized = value.toString().trim().replace(/[_\s]+/g, ' ')
  if (!sanitized) return 'Autre'
  return sanitized
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
}

export default function PageDocuments() {
  useEnforceNonConsultant()
  const utilisateur = useUtilisateurCourant()
  const role = utilisateur?.role ?? null
  const peutVoirDocuments = hasPermission(role, 'documents', 'voir')
  const peutCreerDocuments = hasPermission(role, 'documents', 'creer')
  const peutModifierDocuments = hasPermission(role, 'documents', 'modifier')
  const peutSupprimerDocuments = hasPermission(role, 'documents', 'supprimer')

  const [recherche, setRecherche] = useState('')
  const [filtreRisque, setFiltreRisque] = useState('')
  const [filtreCourrier, setFiltreCourrier] = useState('')
  const VUE_MODE_KEY = 'acs-documents-vue-mode'
  const [vueMode, setVueMode] = useState<'grille' | 'liste'>('grille')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Relire la vue à chaque navigation vers cette page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(VUE_MODE_KEY)
        if (saved === 'grille' || saved === 'liste') setVueMode(saved)
      } catch {}
    }
  }, [typeof window !== 'undefined' && window.location.pathname])
  const [documents, setDocuments] = useState<DocumentUI[]>([])
  const [menuExportOuvert, setMenuExportOuvert] = useState(false)
  const [previewOuvert, setPreviewOuvert] = useState(false)
  const [documentPreview, setDocumentPreview] = useState<PreviewState>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [documentEdite, setDocumentEdite] = useState<DocumentUI | null>(null)
  const [titreEdition, setTitreEdition] = useState('')
  const [referenceEdition, setReferenceEdition] = useState('')
  const [typeCourrierEdition, setTypeCourrierEdition] = useState('')
  const [chargementEdition, setChargementEdition] = useState(false)

  // Persister le mode d’affichage dans localStorage à chaque changement
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(VUE_MODE_KEY, vueMode)
      } catch {}
    }
  }, [vueMode, mounted])

  useEffect(() => {
    let annule = false

    if (!peutVoirDocuments) {
      setChargement(false)
      setDocuments([])
      return () => {
        annule = true
      }
    }

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
          const typeRisqueBrut = (risqueDetail?.type ?? doc.risque ?? 'AUTRE') as string
          const risqueKey = normalizeRisqueKey(typeRisqueBrut) || 'AUTRE'
          const risqueLabel = formatRisqueLabel(typeRisqueBrut || 'Autre')
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
            risque: risqueLabel,
            risqueKey,
            typeCourrier,
            date: formatDate(creeLe),
            taille: formatTaille(typeof tailleBrute === 'number' ? tailleBrute : Number(tailleBrute)),
            color: determinerCouleurRisque(risqueKey),
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
  }, [peutVoirDocuments])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('documents/vue-mode')
      if (stored === 'liste' || stored === 'grille') {
        setVueMode(stored)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('documents/vue-mode', vueMode)
    }
  }, [vueMode])

  const documentsFiltres = useMemo(() => {
    const rechercheNorm = recherche.trim().toLowerCase()
    return documents.filter((doc) => {
      const matchRecherche =
        !rechercheNorm ||
        doc.titre.toLowerCase().includes(rechercheNorm) ||
        doc.client.toLowerCase().includes(rechercheNorm) ||
        doc.reference.toLowerCase().includes(rechercheNorm)

      const matchRisque = !filtreRisque || doc.risqueKey === filtreRisque
      const matchCourrier = !filtreCourrier || doc.typeCourrier === filtreCourrier

      return matchRecherche && matchRisque && matchCourrier
    })
  }, [documents, recherche, filtreCourrier, filtreRisque])

  const risqueOptions = useMemo(() => {
    const uniques = new Map<string, string>()

    for (const base of RISQUE_FALLBACK_TYPES) {
      const key = normalizeRisqueKey(base)
      if (!key || uniques.has(key)) continue
      uniques.set(key, formatRisqueLabel(base))
    }

    for (const doc of documents) {
      if (!doc.risqueKey) continue
      if (!uniques.has(doc.risqueKey)) {
        uniques.set(doc.risqueKey, doc.risque || formatRisqueLabel(doc.risqueKey))
      }
    }

    return Array.from(uniques.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  }, [documents])

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

  const imprimerDocument = (doc: DocumentUI) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreur('Document introuvable sur le serveur')
      return
    }

    setErreur('')
    if (typeof window === 'undefined') {
      return
    }

    const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : buildApiUrl(url)
    const proxyUrl = `/api/proxy/document?url=${encodeURIComponent(resolvedUrl)}`

    const startPrint = async () => {
      try {
        const headers = new Headers({ Accept: 'application/pdf,image/*' })

        const response = await fetch(proxyUrl, {
          credentials: 'include',
          headers,
        })

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`)
        }

        const blob = await response.blob()

        await printBlob({
          blob,
          title: doc.titre || 'Document',
          mimeType: response.headers.get('content-type'),
          sourceUrl: doc.urlFichier ?? resolvedUrl ?? null,
          fallbackUrl: resolvedUrl,
        })
      } catch (error: any) {
        console.error('Impression document', error)
        setErreur(error?.message ?? "Impossible d'imprimer le document")
        if (error instanceof Error && error.name === 'SecurityError') {
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
          return
        }
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
      }
    }

    void startPrint()
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
    if (!peutSupprimerDocuments) {
      setErreur("Vous n'avez pas la permission de supprimer ce document")
      return
    }
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

  const ouvrirEditionDocument = (doc: DocumentUI) => {
    if (!peutModifierDocuments) {
      setErreur("Vous n'avez pas la permission de modifier ce document")
      return
    }

    setDocumentEdite(doc)
    setTitreEdition(doc.titre)
    setReferenceEdition(doc.reference)
    setTypeCourrierEdition(doc.typeCourrier)
    setErreur('')
  }

  const annulerEditionDocument = () => {
    if (chargementEdition) return
    setDocumentEdite(null)
    setTitreEdition('')
    setReferenceEdition('')
    setTypeCourrierEdition('')
  }

  const soumettreEditionDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!documentEdite) return

    if (!peutModifierDocuments) {
      setErreur("Vous n'avez pas la permission de modifier ce document")
      return
    }

    const nouveauTitre = titreEdition.trim()
    const nouvelleReference = referenceEdition.trim()
    const nouveauTypeCourrier = typeCourrierEdition || documentEdite.typeCourrier

    if (!nouveauTitre) {
      setErreur('Le titre du document est obligatoire.')
      return
    }

    setChargementEdition(true)
    setErreur('')

    try {
      const payload: any = {
        titre: nouveauTitre,
        reference: nouvelleReference || null,
        type_courrier: nouveauTypeCourrier,
      }

      const { response, data } = await apiFetchJson(`/documents/${documentEdite.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(
          (data as any)?.erreur ?? (data as any)?.detail ?? 'Impossible de modifier le document',
        )
      }

      setDocuments((precedent) =>
        precedent.map((item) =>
          item.id === documentEdite.id
            ? {
                ...item,
                titre: nouveauTitre,
                reference: nouvelleReference,
                typeCourrier: nouveauTypeCourrier,
              }
            : item,
        ),
      )

      setDocumentEdite(null)
      setTitreEdition('')
      setReferenceEdition('')
      setTypeCourrierEdition('')
    } catch (error: any) {
      console.error('Erreur modification document', error)
      setErreur(error?.message ?? 'Erreur lors de la modification du document')
    } finally {
      setChargementEdition(false)
    }
  }

  const courriers = [
    { value: '', label: 'Tous les types' },
    ...Object.entries(COURRIER_LABELS).map(([value, label]) => ({ value, label })),
  ]

  const handleExport = (type: 'pdf' | 'excel' | 'csv') => {
    if (!peutVoirDocuments) {
      setErreur("Vous n'avez pas la permission d'exporter ces documents")
      return
    }
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

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary">
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
            {peutVoirDocuments ? (
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
            ) : null}
            {peutCreerDocuments ? (
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
            ) : null}
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
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
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
              <option value="">Tous les risques</option>
              {risqueOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

          </div>

          <div className="flex items-center gap-4">
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

        {documentEdite && peutModifierDocuments && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Icon name="edit" size="sm" />
                  Modifier le document
                </h2>
                <p className="text-sm text-gray-500 mt-1 truncate max-w-xl">{documentEdite.titre}</p>
              </div>
              <button
                type="button"
                onClick={annulerEditionDocument}
                disabled={chargementEdition}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={soumettreEditionDocument}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
            >
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Titre</label>
                <input
                  type="text"
                  value={titreEdition}
                  onChange={(e) => setTitreEdition(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm outline-none"
                  placeholder="Titre du document"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Référence</label>
                <input
                  type="text"
                  value={referenceEdition}
                  onChange={(e) => setReferenceEdition(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm outline-none"
                  placeholder="Référence (facultatif)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type de courrier</label>
                <select
                  value={typeCourrierEdition || documentEdite.typeCourrier || ''}
                  onChange={(e) => setTypeCourrierEdition(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm outline-none"
                >
                  <option value="">(inchangé)</option>
                  {Object.entries(COURRIER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>


              <div className="md:col-span-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={annulerEditionDocument}
                  disabled={chargementEdition}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={chargementEdition}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {chargementEdition ? (
                    <span>Enregistrement...</span>
                  ) : (
                    <>
                      <Icon name="check" size="sm" />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.section>
        )}

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
                        onClick={() => imprimerDocument(doc)}
                        disabled={!fichierUrl}
                        className="flex-1 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Icon name="print" size="sm" />
                        Imprimer
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
                      {peutModifierDocuments && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => ouvrirEditionDocument(doc)}
                          className="flex-1 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Icon name="edit" size="sm" />
                          Modifier
                        </motion.button>
                      )}
                      {peutSupprimerDocuments ? (
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
                      ) : null}
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
                              onClick={() => imprimerDocument(doc)}
                              disabled={!fichierUrl}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Imprimer"
                            >
                              <Icon name="print" size="sm" />
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
                            {peutModifierDocuments && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => ouvrirEditionDocument(doc)}
                                disabled={chargementEdition && documentEdite?.id === doc.id}
                                className="p-2 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-60"
                                title="Modifier"
                              >
                                <Icon name="edit" size="sm" className="text-blue-600" />
                              </motion.button>
                            )}
                            {peutSupprimerDocuments ? (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => supprimerDocument(doc)}
                                disabled={suppressionEnCours === doc.id}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                                title="Supprimer"
                              >
                                <Icon name="trash" size="sm" className="text-red-600" />
                              </motion.button>
                            ) : null}
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
