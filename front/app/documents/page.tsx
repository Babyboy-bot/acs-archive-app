'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { hasPermission } from '@/lib/permissions'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sidebar, AppLayout } from '@/components'
import { Icon } from '@/components/Icon'
import { PreviewPDF } from '@/components/PreviewPDF'
import { apiFetchJson, buildApiUrl } from '@/lib/api'
import { getToken, normalizeMediaUrl } from '@/lib'
import { printBlob } from '@/lib/print'
import { exporterCSV, exporterExcel, exporterPDF } from '@/lib/export'
import { useTheme } from '@/hooks/useTheme'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FormModal } from '@/components/ui/FormModal'

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
  chunking_status?: 'pending' | 'completed' | 'failed'
  chunking_error?: string | null
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
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  useEnforceNonConsultant()
  const { isDark } = useTheme()
  const utilisateur = useUtilisateurCourant()
  const role = utilisateur?.role ?? null
  const peutVoirDocuments = hasPermission(role, 'documents', 'voir')
  const peutCreerDocuments = hasPermission(role, 'documents', 'creer')
  const peutModifierDocuments = hasPermission(role, 'documents', 'modifier')
  const peutSupprimerDocuments = hasPermission(role, 'documents', 'supprimer')
  const peutTelecharger = role !== 'CONSULTANT'

  const [recherche, setRecherche] = useState('')
  const [filtreRisque, setFiltreRisque] = useState('')
  const [filtreCourrier, setFiltreCourrier] = useState('')
  const [pageDocuments, setPageDocuments] = useState(1)
  const DOCUMENTS_PAR_PAGE = 12
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
  const [relanceChunkingEnCours, setRelanceChunkingEnCours] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [documentEdite, setDocumentEdite] = useState<DocumentUI | null>(null)
  const [titreEdition, setTitreEdition] = useState('')
  const [referenceEdition, setReferenceEdition] = useState('')
  const [typeCourrierEdition, setTypeCourrierEdition] = useState('')
  const [chargementEdition, setChargementEdition] = useState(false)

  // État pour la modale de confirmation suppression
  const [modaleSuppressionDocument, setModaleSuppressionDocument] = useState<{ open: boolean; document: DocumentUI | null }>({
    open: false,
    document: null
  })

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
        // D'abord récupérer la première page pour connaître le total
        const { response: firstResponse, data: firstData } = await apiFetchJson('/documents/?page_size=50&ordering=-cree_le')
        if (!firstResponse.ok) {
          throw new Error((firstData as any)?.detail ?? 'Impossible de charger les documents')
        }

        let allDocuments: any[] = Array.isArray((firstData as any)?.results) ? (firstData as any).results : []
        const total = (firstData as any)?.count || allDocuments.length
        const pageSize = 50
        const totalPages = Math.ceil(total / pageSize)

        // Récupérer les pages suivantes
        for (let page = 2; page <= totalPages; page++) {
          const { response, data } = await apiFetchJson(`/documents/?page=${page}&page_size=50&ordering=-cree_le`)
          if (!response.ok) {
            throw new Error((data as any)?.detail ?? 'Impossible de charger les documents')
          }

          const pageResults = Array.isArray((data as any)?.results) ? (data as any).results : []
          allDocuments = allDocuments.concat(pageResults)
        }

        const bruts = allDocuments

        const normalises = bruts.map((doc) => {
          const risqueDetail = doc.risque_detail ?? doc.risqueDetail ?? null
          const exerciceInfo = risqueDetail?.exercice_info ?? risqueDetail?.exerciceInfo ?? {}
          const clientNom = exerciceInfo?.client ?? doc.client ?? 'Client inconnu'
          const annee = exerciceInfo?.annee ?? doc.exercice ?? '—'
          const typeRisqueBrut = (risqueDetail?.type ?? doc.risque ?? 'AUTRE') as string
          const risqueKey = normalizeRisqueKey(typeRisqueBrut) || 'AUTRE'
          const risqueLabel = formatRisqueLabel(typeRisqueBrut || 'Autre')
          const creeLe = doc.cree_le ?? doc.creeLe ?? null
          const fichierUrl = normalizeMediaUrl(doc.fichier_url ?? doc.fichierUrl ?? null)
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
            chunking_status: doc.chunking_status ?? 'completed',
            chunking_error: doc.chunking_error ?? null,
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

  const documentsPagination = useMemo(() => {
    const total = documentsFiltres.length
    const totalPages = Math.max(1, Math.ceil(total / DOCUMENTS_PAR_PAGE))
    const page = Math.min(Math.max(1, pageDocuments), totalPages)
    const start = (page - 1) * DOCUMENTS_PAR_PAGE
    const end = start + DOCUMENTS_PAR_PAGE
    const items = documentsFiltres.slice(start, end)
    return { items, total, page, totalPages }
  }, [documentsFiltres, pageDocuments])

  // Réinitialiser la page lors du changement de filtres
  useEffect(() => {
    setPageDocuments(1)
  }, [recherche, filtreRisque, filtreCourrier])

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
    normalizeMediaUrl(doc.source?.fichier_url ?? doc.source?.fichierUrl ?? doc.urlFichier ?? null)

  const resoudreUrlDocument = (url: string) => {
    if (!url) return url
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/media/')) {
      return url
    }
    return buildApiUrl(url)
  }

  const construireUrlTelechargement = (url: string) => {
    if (!url) return url
    const resolved = resoudreUrlDocument(url)
    return resolved
  }

  const logConsultation = (doc: DocumentUI) => {
    apiFetchJson(`/documents/${doc.id}/log-view/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'READ' }),
    }).catch(() => {})
  }

  const ouvrirPreview = (doc: DocumentUI) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreur('Aucune prévisualisation disponible pour ce document')
      return
    }
    setErreur('')
    logConsultation(doc)
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
    logConsultation(doc)
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
    apiFetchJson(`/documents/${doc.id}/log-view/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'PRINT' }) }).catch(() => {})
    if (typeof window === 'undefined') {
      return
    }

    // Créer une fenêtre d'impression dédiée qui se ferme automatiquement
    const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')

    if (!printWindow) {
      // Popup bloquée, utiliser le comportement par défaut (ouvrir dans nouvel onglet)
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    // Injecter le contenu dans la fenêtre d'impression
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impression - ${doc.titre}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              background: white;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 10px;
            }
            .print-content {
              text-align: center;
            }
            iframe {
              width: 100%;
              height: 80vh;
              border: none;
            }
            .loading {
              text-align: center;
              padding: 50px;
              font-size: 18px;
              color: #666;
            }
            @media print {
              .print-header { display: none; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${doc.titre}</h1>
            <p>Impression demandée le ${new Date().toLocaleString('fr-FR')}</p>
            <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
              Imprimer maintenant
            </button>
          </div>
          <div class="print-content">
            <div class="loading">Chargement du document...</div>
          </div>
          <script>
            // Charger le document dans un iframe
            const iframe = document.createElement('iframe');
            iframe.src = '${url}';
            iframe.onload = function() {
              document.querySelector('.loading').style.display = 'none';
              // Déclencher l'impression automatiquement après un court délai
              setTimeout(function() {
                window.print();
              }, 1000);
            };
            document.querySelector('.print-content').appendChild(iframe);
          </script>
        </body>
      </html>
    `)

    printWindow.document.close()
  }

  const telechargerDocument = (doc: DocumentUI) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreur('Document introuvable sur le serveur')
      return
    }

    setErreur('')
    apiFetchJson(`/documents/${doc.id}/log-view/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'DOWNLOAD' }) }).catch(() => {})
    if (typeof window !== 'undefined') {
      const fetchUrl = construireUrlTelechargement(url)

      const startDownload = async () => {
        try {
          const response = await fetch(fetchUrl ?? url, {
            credentials: 'include',
            headers: {
              Accept: 'application/pdf',
              'Cache-Control': 'no-cache'
            },
          })

          if (!response.ok) {
            throw new Error(`Erreur ${response.status}`)
          }

          const blob = await response.blob()

          // Créer un blob PDF explicite si ce n'est pas déjà le cas
          const pdfBlob = new Blob([blob], { type: 'application/pdf' })
          const objectUrl = URL.createObjectURL(pdfBlob)

          // Nettoyer et préparer le nom de fichier
          const titreNettoye = (doc.titre || 'document')
            .replace(/[<>:"/\\|?*]/g, '_') // Remplacer les caractères interdits
            .replace(/\s+/g, '_') // Remplacer les espaces par des underscores
            .substring(0, 100) // Limiter la longueur

          // Toujours ajouter l'extension .pdf
          const nomFichier = titreNettoye.endsWith('.pdf') ? titreNettoye : `${titreNettoye}.pdf`

          const lien = document.createElement('a')
          lien.href = objectUrl
          lien.download = nomFichier
          lien.style.display = 'none'

          document.body.appendChild(lien)
          lien.click()
          document.body.removeChild(lien)

          // Nettoyer l'URL de l'objet après un délai
          setTimeout(() => {
            URL.revokeObjectURL(objectUrl)
          }, 100)

        } catch (error) {
          console.error('Téléchargement document', error)
          const fallback = resoudreUrlDocument(url)
          if (fallback) {
            // Fallback : ouvrir dans un nouvel onglet avec téléchargement forcé
            const lienFallback = document.createElement('a')
            lienFallback.href = fallback
            lienFallback.download = `${doc.titre || 'document'}.pdf`
            lienFallback.target = '_blank'
            lienFallback.rel = 'noopener,noreferrer'
            document.body.appendChild(lienFallback)
            lienFallback.click()
            document.body.removeChild(lienFallback)
          }
        }
      }

      void startDownload()
    }
  }

  const ouvrirModaleSuppressionDocument = (doc: DocumentUI) => {
    if (!peutSupprimerDocuments) {
      setErreur("Vous n'avez pas la permission de supprimer ce document")
      return
    }
    setModaleSuppressionDocument({ open: true, document: doc })
  }

  const fermerModaleSuppressionDocument = () => {
    setModaleSuppressionDocument({ open: false, document: null })
  }

  const confirmerSuppressionDocument = async () => {
    const { document: doc } = modaleSuppressionDocument
    if (!doc) return

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
      fermerModaleSuppressionDocument()
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

  const relancerChunking = async (doc: DocumentUI) => {
    setRelanceChunkingEnCours(doc.id)
    setErreur('')

    try {
      const { response, data } = await apiFetchJson(`/documents/${doc.id}/retry-chunking/`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur ?? 'Impossible de relancer le chunking')
      }

      // Mettre à jour le statut du document en local
      setDocuments((precedent) =>
        precedent.map((item) =>
          item.id === doc.id
            ? { ...item, chunking_status: 'pending', chunking_error: null }
            : item,
        ),
      )

      setErreur('')
    } catch (error: any) {
      console.error('Erreur relance chunking', error)
      setErreur(error?.message ?? 'Erreur lors de la relance du chunking')
    } finally {
      setRelanceChunkingEnCours(null)
    }
  }

  const ChunkingBadge = ({ doc }: { doc: DocumentUI }) => {
    if (doc.chunking_status === 'pending') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
          Indexation en cours
        </div>
      )
    }

    if (doc.chunking_status === 'failed') {
      return (
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium">
            Non indexé
          </div>
          <button
            onClick={() => relancerChunking(doc)}
            disabled={relanceChunkingEnCours === doc.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {relanceChunkingEnCours === doc.id ? '...' : 'Relancer'}
          </button>
        </div>
      )
    }

    return null
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

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    if (!peutVoirDocuments) {
      setErreur("Vous n'avez pas la permission d'exporter ces documents")
      return
    }
    if (!documentsFiltres.length) {
      setErreur('Aucun document à exporter avec les filtres actuels')
      return
    }
    apiFetchJson('/audit/log-export/', { method: 'POST', body: JSON.stringify({ format: type, nb_documents: documentsFiltres.length }) }).catch(() => {})
    switch (type) {
      case 'pdf':
        exporterPDF(documentsFiltres, 'Liste des documents')
        break
      case 'excel':
        await exporterExcel(documentsFiltres, 'documents')
        break
      case 'csv':
        exporterCSV(documentsFiltres, 'documents')
        break
    }
    setMenuExportOuvert(false)
  }

  // Attendre la vérification d'authentification (après tous les hooks)
  if (authChargement || !estAuthentifie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-base">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-theme-secondary text-sm">Vérification de l'authentification...</p>
        </div>
      </div>
    )
  }

  if (!mounted) {
    return null
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-10 overflow-auto">
        {/* En-tête minimaliste */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Gestion</p>
              <h1 className="text-3xl font-semibold text-theme-primary">Documents</h1>
              <p className="text-sm text-theme-secondary mt-1">
                {documentsPagination.items.length} document{documentsPagination.items.length > 1 ? 's' : ''} affiché{documentsPagination.items.length > 1 ? 's' : ''} sur {documentsFiltres.length} au total
              </p>
            </div>

            <div className="flex items-center gap-2">
              {peutVoirDocuments && (
                <div className="relative">
                  <button
                    onClick={() => setMenuExportOuvert((prev) => !prev)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-secondary bg-theme-card border border-theme rounded-lg hover:bg-theme-muted transition-colors"
                  >
                    <Icon name="download" size="sm" />
                    Exporter
                  </button>
                  {menuExportOuvert && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute right-0 mt-2 w-40 bg-theme-card border border-theme rounded-lg shadow-lg overflow-hidden z-10"
                    >
                      <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2.5 text-sm text-left hover:bg-theme-muted transition-colors">PDF</button>
                      <button onClick={() => handleExport('excel')} className="w-full px-4 py-2.5 text-sm text-left hover:bg-theme-muted transition-colors">Excel</button>
                      <button onClick={() => handleExport('csv')} className="w-full px-4 py-2.5 text-sm text-left hover:bg-theme-muted transition-colors">CSV</button>
                    </motion.div>
                  )}
                </div>
              )}
              {peutCreerDocuments && (
                <Link href="/documents/nouveau">
                  <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                    <Icon name="plus" size="sm" />
                    Nouveau
                  </button>
                </Link>
              )}
            </div>
          </div>
        </motion.header>

        {/* Barre de filtres minimaliste */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 flex flex-col md:flex-row gap-3"
        >
          <div className="flex-1 relative">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-theme-card border border-theme rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all outline-none"
            />
          </div>

          <select
            value={filtreRisque}
            onChange={(e) => setFiltreRisque(e.target.value)}
            className="px-4 py-2.5 text-sm bg-theme-card border border-theme rounded-lg focus:border-blue-400 outline-none min-w-[160px]"
          >
            <option value="">Tous les risques</option>
            {risqueOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="flex border border-theme rounded-lg overflow-hidden">
            <button
              onClick={() => setVueMode('grille')}
              className={`px-3 py-2 text-sm transition-colors ${vueMode === 'grille' ? 'bg-theme-muted text-theme-primary' : 'text-theme-secondary hover:bg-theme-muted/50'}`}
            >
              <Icon name="card" size="sm" />
            </button>
            <button
              onClick={() => setVueMode('liste')}
              className={`px-3 py-2 text-sm transition-colors ${vueMode === 'liste' ? 'bg-theme-muted text-theme-primary' : 'text-theme-secondary hover:bg-theme-muted/50'}`}
            >
              <Icon name="document" size="sm" />
            </button>
          </div>
        </motion.div>


        {erreur && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm"
          >
            {erreur}
          </motion.div>
        )}

        {chargement ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-48 bg-theme-card border border-theme rounded-xl animate-pulse" />
            ))}
          </div>
        ) : vueMode === 'grille' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {documentsPagination.items.map((doc, index) => {
              const fichierUrl = extraireUrlDocument(doc)
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="bg-theme-card border border-theme rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-theme-muted">
                      <Icon name="document" size="sm" className="text-theme-secondary" />
                    </div>
                    <span className="text-xs text-theme-secondary">{doc.exercice}</span>
                  </div>

                  <h3 className="font-medium text-theme-primary text-sm mb-1 line-clamp-2">{doc.titre}</h3>
                  <p className="text-xs text-theme-secondary font-mono mb-3">{doc.reference || '—'}</p>

                  <div className="mb-3">
                    <ChunkingBadge doc={doc} />
                  </div>

                  <div className="space-y-1.5 text-xs text-theme-secondary mb-4">
                    <div className="flex items-center gap-2">
                      <Icon name="building" size="xs" />
                      <span className="truncate">{doc.client}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: doc.color }} />
                      <span>{doc.risque}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{doc.date}</span>
                      <span>{doc.taille}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pt-3 border-t border-theme">
                    {peutTelecharger && (
                      <button
                        onClick={() => telechargerDocument(doc)}
                        disabled={!fichierUrl}
                        className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-muted rounded-lg transition-colors disabled:opacity-40"
                        title="Télécharger"
                      >
                        <Icon name="download" size="sm" />
                      </button>
                    )}
                    <button
                      onClick={() => imprimerDocument(doc)}
                      disabled={!fichierUrl}
                      className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-muted rounded-lg transition-colors disabled:opacity-40"
                      title="Imprimer"
                    >
                      <Icon name="print" size="sm" />
                    </button>
                    <button
                      onClick={() => ouvrirDansNouvelOnglet(doc)}
                      disabled={!fichierUrl}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-40"
                      title="Voir"
                    >
                      <Icon name="eye" size="sm" />
                    </button>
                    {peutModifierDocuments && (
                      <button
                        onClick={() => ouvrirEditionDocument(doc)}
                        className="p-2 text-theme-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Icon name="edit" size="sm" />
                      </button>
                    )}
                    {peutSupprimerDocuments && (
                      <button
                        onClick={() => ouvrirModaleSuppressionDocument(doc)}
                        disabled={suppressionEnCours === doc.id}
                        className="p-2 text-theme-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 ml-auto"
                        title="Supprimer"
                      >
                        <Icon name="trash" size="sm" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-theme">
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Risque</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-theme-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {documentsPagination.items.map((doc, index) => {
                    const fichierUrl = extraireUrlDocument(doc)
                    return (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-theme-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-theme-muted">
                              <Icon name="document" size="xs" className="text-theme-secondary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-theme-primary truncate">{doc.titre}</p>
                              <p className="text-xs text-theme-secondary font-mono">{doc.reference || '—'}</p>
                              <div className="mt-1">
                                <ChunkingBadge doc={doc} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-theme-primary">{doc.client}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-theme-secondary">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: doc.color }} />
                            {doc.risque}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-theme-secondary">{libelleCourrier(doc.typeCourrier)}</td>
                        <td className="px-4 py-3 text-xs text-theme-secondary">{doc.date}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {peutTelecharger && (
                              <button onClick={() => telechargerDocument(doc)} disabled={!fichierUrl} className="p-1.5 text-theme-secondary hover:text-theme-primary rounded transition-colors disabled:opacity-40" title="Télécharger">
                                <Icon name="download" size="xs" />
                              </button>
                            )}
                            <button onClick={() => ouvrirDansNouvelOnglet(doc)} disabled={!fichierUrl} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-40" title="Voir">
                              <Icon name="eye" size="xs" />
                            </button>
                            {peutModifierDocuments && (
                              <button onClick={() => ouvrirEditionDocument(doc)} className="p-1.5 text-theme-secondary hover:text-blue-600 rounded transition-colors" title="Modifier">
                                <Icon name="edit" size="xs" />
                              </button>
                            )}
                            {peutSupprimerDocuments && (
                              <button onClick={() => ouvrirModaleSuppressionDocument(doc)} disabled={suppressionEnCours === doc.id} className="p-1.5 text-theme-secondary hover:text-red-600 rounded transition-colors disabled:opacity-40" title="Supprimer">
                                <Icon name="trash" size="xs" />
                              </button>
                            )}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-theme-card border border-theme rounded-xl"
          >
            <Icon name="folder" size="lg" className="mx-auto mb-3 text-theme-secondary" />
            <p className="text-sm font-medium text-theme-primary mb-1">Aucun document trouvé</p>
            <p className="text-xs text-theme-secondary mb-4">Modifiez vos filtres ou ajoutez un nouveau document</p>
            {peutCreerDocuments && (
              <Link href="/documents/nouveau">
                <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                  <Icon name="plus" size="sm" />
                  Ajouter
                </button>
              </Link>
            )}
          </motion.div>
        )}

        {/* Pagination */}
        {!chargement && documentsPagination.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex items-center justify-between"
          >
            <p className="text-sm text-theme-secondary">
              Page {documentsPagination.page} sur {documentsPagination.totalPages} · {documentsPagination.total} document{documentsPagination.total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPageDocuments(1)}
                disabled={documentsPagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ««
              </button>
              <button
                type="button"
                onClick={() => setPageDocuments((prev) => Math.max(1, prev - 1))}
                disabled={documentsPagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-theme-primary">
                {documentsPagination.page}
              </span>
              <button
                type="button"
                onClick={() => setPageDocuments((prev) => Math.min(documentsPagination.totalPages, prev + 1))}
                disabled={documentsPagination.page >= documentsPagination.totalPages}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => setPageDocuments(documentsPagination.totalPages)}
                disabled={documentsPagination.page >= documentsPagination.totalPages}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                »»
              </button>
            </div>
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

      {/* Modale d'édition document */}
      {documentEdite && peutModifierDocuments && (
        <FormModal
          isOpen={!!documentEdite}
          onClose={annulerEditionDocument}
          title={`Modifier : ${documentEdite.titre}`}
          isDark={isDark}
          size="md"
        >
          <form onSubmit={soumettreEditionDocument} className="space-y-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Titre *</label>
              <input
                type="text"
                value={titreEdition}
                onChange={(e) => setTitreEdition(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-400 outline-none ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Référence</label>
                <input
                  type="text"
                  value={referenceEdition}
                  onChange={(e) => setReferenceEdition(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Type</label>
                <select
                  value={typeCourrierEdition || documentEdite.typeCourrier || ''}
                  onChange={(e) => setTypeCourrierEdition(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="">(inchangé)</option>
                  {Object.entries(COURRIER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={annulerEditionDocument}
                disabled={chargementEdition}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  isDark ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={chargementEdition}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {chargementEdition ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </FormModal>
      )}

      {/* Modale de confirmation suppression document */}
      <ConfirmModal
        isOpen={modaleSuppressionDocument.open}
        onClose={fermerModaleSuppressionDocument}
        onConfirm={confirmerSuppressionDocument}
        title="Supprimer le document"
        message={`Êtes-vous sûr de vouloir supprimer définitivement « ${modaleSuppressionDocument.document?.titre} » ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={suppressionEnCours === modaleSuppressionDocument.document?.id}
        isDark={isDark}
      />
    </AppLayout>
  )
}
