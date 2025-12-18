'use client'

import { Sidebar } from '@/components/Sidebar'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetchJson, buildApiUrl } from '@/lib/api'
import { getToken } from '@/lib/session'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatDistanceToNow } from 'date-fns'
import { useRequireAuth } from '@/hooks/useRequireAuth'

type ClientApi = {
  id: string
  nom: string
}

type ExerciceApi = {
  id: string
  annee: number
  client: string
  client_nom?: string
}

type RisqueApi = {
  id: string
  type: string
}

type TypeCourrierApi =
  | 'ACS_VERS_CLIENT'
  | 'ACS_VERS_COMPAGNIE'
  | 'AVENANT'
  | 'FACTURE'
  | 'REGLEMENT'
  | 'DIVERS'
  | 'SINISTRE'

const TYPE_COURRIER_LIBELLES: Record<TypeCourrierApi, string> = {
  ACS_VERS_CLIENT: 'ACS → Client',
  ACS_VERS_COMPAGNIE: 'ACS → Compagnie',
  AVENANT: 'Avenant',
  FACTURE: 'Facture',
  REGLEMENT: 'Règlement',
  DIVERS: 'Divers',
  SINISTRE: 'Sinistre',
}

type TypeCourrierTheme = {
  buttonBg: string
  buttonText: string
  buttonBorder: string
  badgeBg: string
  badgeText: string
}

const DEFAULT_TYPE_COURRIER_THEME: TypeCourrierTheme = {
  buttonBg: '#F3F4F6',
  buttonText: '#1F2937',
  buttonBorder: '#D1D5DB',
  badgeBg: '#4B5563',
  badgeText: '#FFFFFF'
}

const TYPE_COURRIER_THEMES: Record<TypeCourrierApi, TypeCourrierTheme> = {
  ACS_VERS_CLIENT: {
    buttonBg: '#DBEAFE',
    buttonText: '#1E3A8A',
    buttonBorder: '#BFDBFE',
    badgeBg: '#1D4ED8',
    badgeText: '#FFFFFF'
  },
  ACS_VERS_COMPAGNIE: {
    buttonBg: '#E0E7FF',
    buttonText: '#3730A3',
    buttonBorder: '#C7D2FE',
    badgeBg: '#4338CA',
    badgeText: '#FFFFFF'
  },
  AVENANT: {
    buttonBg: '#FEF3C7',
    buttonText: '#92400E',
    buttonBorder: '#FCD34D',
    badgeBg: '#D97706',
    badgeText: '#FFFFFF'
  },
  FACTURE: {
    buttonBg: '#F5D0FE',
    buttonText: '#86198F',
    buttonBorder: '#F0ABFC',
    badgeBg: '#A21CAF',
    badgeText: '#FFFFFF'
  },
  REGLEMENT: {
    buttonBg: '#D1FAE5',
    buttonText: '#065F46',
    buttonBorder: '#34D399',
    badgeBg: '#047857',
    badgeText: '#FFFFFF'
  },
  DIVERS: {
    buttonBg: '#E5E7EB',
    buttonText: '#374151',
    buttonBorder: '#D1D5DB',
    badgeBg: '#6B7280',
    badgeText: '#FFFFFF'
  },
  SINISTRE: {
    buttonBg: '#FECACA',
    buttonText: '#991B1B',
    buttonBorder: '#FCA5A5',
    badgeBg: '#DC2626',
    badgeText: '#FFFFFF'
  }
}

type RisqueTheme = {
  buttonBg: string
  buttonText: string
  badgeBg: string
  badgeText: string
}

const DEFAULT_RISQUE_THEME: RisqueTheme = {
  buttonBg: '#F3F4F6',
  buttonText: '#1F2937',
  badgeBg: '#4B5563',
  badgeText: '#FFFFFF',
}

const RISQUE_THEMES: Record<string, RisqueTheme> = {
  AUTOMOBILE: {
    buttonBg: '#FFE4E6',
    buttonText: '#9F1239',
    badgeBg: '#D32027',
    badgeText: '#FFFFFF',
  },
  SANTE: {
    buttonBg: '#DCFCE7',
    buttonText: '#065F46',
    badgeBg: '#10B981',
    badgeText: '#FFFFFF',
  },
  HABITATION: {
    buttonBg: '#FEF3C7',
    buttonText: '#92400E',
    badgeBg: '#F59E0B',
    badgeText: '#FFFFFF',
  },
  VIE: {
    buttonBg: '#EDE9FE',
    buttonText: '#5B21B6',
    badgeBg: '#8B5CF6',
    badgeText: '#FFFFFF',
  },
  RESPONSABILITE_CIVILE: {
    buttonBg: '#DBEAFE',
    buttonText: '#1D4ED8',
    badgeBg: '#0066B3',
    badgeText: '#FFFFFF',
  },
  PREVOYANCE_DECES: {
    buttonBg: '#FEF9C3',
    buttonText: '#854D0E',
    badgeBg: '#F59E0B',
    badgeText: '#FFFFFF',
  },
  RETRAITE: {
    buttonBg: '#E0E7FF',
    buttonText: '#1E3A8A',
    badgeBg: '#6366F1',
    badgeText: '#FFFFFF',
  },
  RETRAITE_COMPLEMENTAIRE: {
    buttonBg: '#F3E8FF',
    buttonText: '#5B21B6',
    badgeBg: '#7C3AED',
    badgeText: '#FFFFFF',
  },
  TEMPORAIRE_DECES: {
    buttonBg: '#FFF1F2',
    buttonText: '#9F1239',
    badgeBg: '#F43F5E',
    badgeText: '#FFFFFF',
  },
  SINISTRE: {
    buttonBg: '#FEE2E2',
    buttonText: '#991B1B',
    badgeBg: '#DC2626',
    badgeText: '#FFFFFF',
  },
  INDEMNITE_DE_FIN_DE_CARRIERE: {
    buttonBg: '#FEF3C7',
    buttonText: '#92400E',
    badgeBg: '#F59E0B',
    badgeText: '#FFFFFF',
  },
  INDIVIDUELLE_ACCIDENTS: {
    buttonBg: '#FEE2E2',
    buttonText: '#B91C1C',
    badgeBg: '#EF4444',
    badgeText: '#FFFFFF',
  },
  MRP: {
    buttonBg: '#F3E8FF',
    buttonText: '#7C3AED',
    badgeBg: '#9333EA',
    badgeText: '#FFFFFF',
  },
  TRANSPORT: {
    buttonBg: '#E0F2FE',
    buttonText: '#0369A1',
    badgeBg: '#0EA5E9',
    badgeText: '#FFFFFF',
  },
  TRANSPORT_FACULTES: {
    buttonBg: '#E0F7FA',
    buttonText: '#0E7490',
    badgeBg: '#06B6D4',
    badgeText: '#FFFFFF',
  },
  CAUTION: {
    buttonBg: '#FFF7ED',
    buttonText: '#9A3412',
    badgeBg: '#FB923C',
    badgeText: '#FFFFFF',
  },
  TOUS_RISQUES_CHANTIER: {
    buttonBg: '#FFFBEB',
    buttonText: '#92400E',
    badgeBg: '#F97316',
    badgeText: '#FFFFFF',
  },
}

const normalizeRisqueKey = (value?: string | null) => {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[^0-9a-zA-Z\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .normalize('NFC')
    .toUpperCase()
}

const RISQUE_FALLBACK_TYPES = [
  { value: 'AUTOMOBILE', label: 'Automobile' },
  { value: 'SANTE', label: 'Santé' },
  { value: 'MRP FACULTES', label: 'MRP facultés' },
  { value: 'PREVOYANCE DECES', label: 'Prévoyance décès' },
  { value: 'BRIS DE MACHINE', label: 'Bris de machine' },
  { value: 'DIVERS', label: 'Divers' },
  { value: 'EVACUATION SANITAIRE', label: 'Evacuation sanitaire' },
  { value: 'GLOBALE DOMMAGES', label: 'Globale dommages' },
  { value: 'INDIVIDUELLE ACCIDENTS', label: 'Individuelle accidents' },
  { value: 'MULTIRISQUE HABITATION', label: 'Multirisque habitation' },
  { value: 'MULTIRISQUE IMMEUBLE', label: 'Multirisque immeuble' },
  { value: 'MULTIRISQUE PROFESSIONNELLE', label: 'Multirisque professionnelle' },
  { value: 'REGLEMENTS', label: 'Règlements' },
  { value: 'SINISTRE', label: 'Sinistre' },
  { value: 'RESPONSABILITE CIVILE', label: 'Responsabilité civile' },
  { value: 'RETRAITE', label: 'Retraite' },
  { value: 'RETRAITE COMPLEMENTAIRE', label: 'Retraite complémentaire' },
  { value: 'TEMPORAIRE DECES', label: 'Temporaire décès' },
  { value: 'INDEMNITE DE FIN DE CARRIERE', label: 'Indemnité de fin de carrière' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'TRANSPORT FACULTES', label: 'Transport facultés' },
  { value: 'VOYAGE', label: 'Voyage' },
  { value: 'CAUTION', label: 'Caution' },
  { value: 'TOUS RISQUES CHANTIER', label: 'Tous risques chantier' },
]

const RISQUE_LABELS = new Map(
  RISQUE_FALLBACK_TYPES.map(({ value, label }) => [normalizeRisqueKey(value), label])
)

const hashString = (input: string) => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) & 0x7fffffff
  }
  return hash
}

const generateRisqueTheme = (key: string): RisqueTheme => {
  const safeKey = key || 'DEFAULT'
  const hue = hashString(safeKey) % 360
  const badgeBg = `hsl(${hue}, 70%, 45%)`
  const buttonBg = `hsl(${hue}, 85%, 92%)`
  const buttonText = `hsl(${hue}, 35%, 30%)`
  return {
    badgeBg,
    badgeText: '#FFFFFF',
    buttonBg,
    buttonText,
  }
}

type TypeCourrierOption = {
  value: string
  label: string
  theme: TypeCourrierTheme
}

const CLIENTS_PAR_PAGE = 50

type DocumentApi = {
  id: string
  titre: string
  fichier_url?: string | null
  fichierUrl?: string | null
  reference?: string | null
  type_courrier: TypeCourrierApi
  date_document?: string | null
  cree_le: string
  taille_fichier?: number
  risque_detail?: {
    type?: string | null
    exercice_info?: {
      annee?: number | null
      client?: string | null
    } | null
  } | null
}

export default function PageRecherche() {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()

  const [client, setClient] = useState('')
  const [exercice, setExercice] = useState('')
  const [risque, setRisque] = useState('')
  const [typeCourrier, setTypeCourrier] = useState('')
  const [afficherResultats, setAfficherResultats] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientApi[]>([])
  const [exercicesDisponibles, setExercicesDisponibles] = useState<number[]>([])
  const [typesRisqueDisponibles, setTypesRisqueDisponibles] = useState<string[]>([])
  const [resultats, setResultats] = useState<DocumentApi[]>([])
  const [erreurTelechargement, setErreurTelechargement] = useState<string | null>(null)
  const [anneeMaxDisponible, setAnneeMaxDisponible] = useState<number | null>(null)
  const [documentsSource, setDocumentsSource] = useState<DocumentApi[]>([])
  const [documentsCharges, setDocumentsCharges] = useState(false)
  const [chargementDocuments, setChargementDocuments] = useState(false)
  const [pageClients, setPageClients] = useState(1)

  const chargerDocuments = useCallback(async () => {
    setChargementDocuments(true)
    try {
      const { data, response } = await apiFetchJson<{ results?: DocumentApi[] }>(
        '/documents/?page_size=800&ordering=-cree_le'
      )

      if (!response.ok) {
        throw new Error('Réponse invalide de l’API documents')
      }

      const docs = Array.isArray(data?.results) ? data!.results : []
      setDocumentsSource(docs)
      setDocumentsCharges(true)
      return docs
    } catch (error) {
      console.error('Erreur chargement documents (suggestions)', error)
      setDocumentsSource([])
      setDocumentsCharges(true)
      throw error
    } finally {
      setChargementDocuments(false)
    }
  }, [])

  const filtrerDocuments = useCallback(
    (
      docs: DocumentApi[],
      criteres: {
        client?: string
        exercice?: string
        risque?: string
        typeCourrier?: string
      }
    ) => {
      return docs.filter((doc) => {
        const info = doc.risque_detail?.exercice_info
        const clientDoc = info?.client ?? ''
        const anneeDoc = info?.annee ? String(info.annee) : ''
        const risqueDoc = (doc.risque_detail?.type ?? '').toUpperCase()
        const typeCourrierDoc = doc.type_courrier ?? ''

        const matchClient = criteres.client
          ? clientDoc.toLowerCase().includes(criteres.client.toLowerCase())
          : true
        const matchExercice = criteres.exercice ? anneeDoc === criteres.exercice : true
        const matchRisque = criteres.risque ? risqueDoc === criteres.risque.toUpperCase() : true
        const matchTypeCourrier = criteres.typeCourrier ? typeCourrierDoc === criteres.typeCourrier : true

        return matchClient && matchExercice && matchRisque && matchTypeCourrier
      })
    },
    []
  )

  const toutesTypesCourrier = useMemo(() => Object.keys(TYPE_COURRIER_LIBELLES) as TypeCourrierApi[], [])

  const clientsFiltres = useMemo(() => {
    const terme = client.trim().toLowerCase()
    if (!terme) {
      return clients
    }
    return clients.filter((c) => c.nom.toLowerCase().includes(terme))
  }, [client, clients])

  const clientsPagination = useMemo(() => {
    const total = clientsFiltres.length
    const totalPages = Math.max(1, Math.ceil(total / CLIENTS_PAR_PAGE))
    const page = Math.min(pageClients, totalPages)
    const start = (page - 1) * CLIENTS_PAR_PAGE
    const end = start + CLIENTS_PAR_PAGE
    const items = clientsFiltres.slice(start, end)
    return { items, total, page, totalPages }
  }, [clientsFiltres, pageClients])

  useEffect(() => {
    setPageClients(1)
  }, [client, clients.length])

  const labelRisque = (type?: string | null) => {
    if (!type) return 'Risque inconnu'
    const key = normalizeRisqueKey(type)
    if (RISQUE_LABELS.has(key)) {
      return RISQUE_LABELS.get(key) as string
    }
    const sanitized = type.replace(/_/g, ' ').trim()
    if (!sanitized) {
      return 'Risque inconnu'
    }
    return sanitized.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const themeRisque = (type?: string | null): RisqueTheme => {
    const cle = normalizeRisqueKey(type)
    if (!cle) return DEFAULT_RISQUE_THEME
    return RISQUE_THEMES[cle] ?? generateRisqueTheme(cle)
  }

  useEffect(() => {
    let ignore = false

    const chargerOptions = async () => {
      try {
        const [clientsRes, exercicesRes, risquesRes] = await Promise.all([
          apiFetchJson<{ results?: ClientApi[] }>('/clients/?simple=1&ordering=nom'),
          apiFetchJson<{ results?: ExerciceApi[] }>('/exercices/?simple=1&ordering=-annee'),
          apiFetchJson<{ results?: RisqueApi[] }>('/risques/?simple=1'),
        ])

        if (ignore) return

        const clientsData: ClientApi[] = Array.isArray(clientsRes.data)
          ? (clientsRes.data as any as ClientApi[])
          : Array.isArray(clientsRes.data?.results)
            ? (clientsRes.data!.results as ClientApi[])
            : []
        setClients(clientsData)

        const exercicesData: ExerciceApi[] = Array.isArray(exercicesRes.data)
          ? (exercicesRes.data as any as ExerciceApi[])
          : Array.isArray(exercicesRes.data?.results)
            ? (exercicesRes.data!.results as ExerciceApi[])
            : []

        const exercicesList = exercicesData
          .map((ex) => ex.annee)
          .filter((annee): annee is number => typeof annee === 'number')
        const uniques = Array.from(new Set(exercicesList)).sort((a, b) => b - a)
        setExercicesDisponibles(uniques)
        if (uniques.length > 0) {
          setAnneeMaxDisponible(Math.max(...uniques))
        }

        const risquesData: RisqueApi[] = Array.isArray(risquesRes.data)
          ? (risquesRes.data as any as RisqueApi[])
          : Array.isArray(risquesRes.data?.results)
            ? (risquesRes.data!.results as RisqueApi[])
            : []

        const risquesList = risquesData
          .map((r) => r.type)
          .filter((type): type is string => Boolean(type))
        setTypesRisqueDisponibles(Array.from(new Set(risquesList)))
      } catch (error) {
        if (!ignore) {
          console.error('Erreur chargement options recherche', error)
          setErreur("Impossible de charger les filtres de recherche")
        }
      }
    }

    chargerOptions()

    return () => {
      ignore = true
    }
  }, [])

  const gererRecherche = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)
    setErreur(null)

    try {
      if (!documentsCharges) {
        try {
          await chargerDocuments()
        } catch (error) {
          setErreur("Impossible de récupérer les documents.")
        }
      }

      const resultatFiltre = filtrerDocuments(documentsSource, {
        client: client || undefined,
        exercice: exercice || undefined,
        risque: risque || undefined,
        typeCourrier: typeCourrier || undefined,
      })

      setResultats(resultatFiltre)
      setAfficherResultats(true)
    } catch (error) {
      console.error('Erreur recherche documents', error)
      setErreur("Impossible de récupérer les documents.")
    } finally {
      setChargement(false)
    }
  }

  const imprimerResultat = (doc: (typeof resultatsAffiches)[number]) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreurTelechargement("Document introuvable sur le serveur")
      return
    }

    setErreurTelechargement(null)
    if (typeof window === 'undefined') {
      return
    }

    const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : buildApiUrl(url)
    const proxyUrl = `/api/proxy/document?url=${encodeURIComponent(resolvedUrl)}`

    const startPrint = async () => {
      try {
        const headers = new Headers({ Accept: 'application/pdf,image/*' })
        const token = getToken()
        if (token) {
          headers.set('Authorization', `Bearer ${token}`)
        }

        const response = await fetch(proxyUrl, {
          credentials: 'include',
          headers,
        })

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`)
        }

        const blob = await response.blob()
        const mime = blob.type || response.headers.get('content-type') || ''
        const candidateUrl = doc.fichierUrl ?? resolvedUrl ?? ''
        const isPdf =
          mime.includes('pdf') ||
          (!mime || mime === 'application/octet-stream') && /\.pdf(?:$|\?|#)/i.test(candidateUrl)

        const blobUrl = URL.createObjectURL(blob)
        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')

        if (!printWindow) {
          URL.revokeObjectURL(blobUrl)
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
          return
        }

        const sanitize = (value: string) =>
          value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')

        const titreNettoye = sanitize(doc.titre || 'Document')

        const scriptContent = isPdf
          ? `const iframe = document.querySelector('iframe');
            const triggerPrint = () => {
              try {
                iframe.contentWindow?.focus?.();
                iframe.contentWindow?.print?.();
              } catch (e) {
                window.focus();
                window.print();
              }
              setTimeout(() => window.close(), 500);
            };
            if (iframe) {
              iframe.addEventListener('load', triggerPrint);
            } else {
              triggerPrint();
            }`
          : `const image = document.querySelector('img');
            const triggerPrint = () => {
              try {
                window.focus();
                window.print();
              } catch (e) {
                window.print();
              }
              setTimeout(() => window.close(), 500);
            };
            if (!image) {
              triggerPrint();
            } else if (image.complete) {
              triggerPrint();
            } else {
              image.addEventListener('load', triggerPrint);
            }`

        printWindow.document.open()
        printWindow.document.write(`<!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Impression - ${titreNettoye}</title>
              <style>
                html, body { margin: 0; padding: 0; height: 100%; }
                iframe, img { width: 100%; height: 100%; border: 0; display: block; }
                img { object-fit: contain; background: #fff; }
              </style>
            </head>
            <body>
              ${isPdf ? `<iframe src="${blobUrl}"></iframe>` : `<img src="${blobUrl}" alt="${titreNettoye}" />`}
              <script>
                ${scriptContent.replace(/<\//g, '<\\/')}
              <\/script>
            </body>
          </html>`)
        printWindow.document.close()

        const cleanup = () => {
          URL.revokeObjectURL(blobUrl)
          printWindow.removeEventListener('beforeunload', cleanup)
        }
        printWindow.addEventListener('beforeunload', cleanup)
      } catch (error: any) {
        console.error('Impression recherche', error)
        setErreurTelechargement(error?.message ?? "Impossible d'imprimer le document")
        if (error instanceof Error && error.name === 'SecurityError') {
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
          return
        }
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
      }
    }

    void startPrint()
  }

  const reinitialiser = () => {
    setClient('')
    setExercice('')
    setRisque('')
    setTypeCourrier('')
    setAfficherResultats(false)
    setResultats([])
    setErreur(null)
  }

  const fusionnerSuggestions = useCallback(<T extends string | number>(
    prioritaires: T[],
    base: T[],
    normalizer?: (valeur: T) => string,
  ) => {
    const resultat: T[] = []
    const deja = new Set<string>()

    const key = (valeur: T) => (normalizer ? normalizer(valeur) : String(valeur))

    for (const valeur of prioritaires) {
      if (!valeur) continue
      const identifiant = key(valeur)
      if (!deja.has(identifiant)) {
        resultat.push(valeur)
        deja.add(identifiant)
      }
    }

    for (const valeur of base) {
      if (!valeur) continue
      const identifiant = key(valeur)
      if (!deja.has(identifiant)) {
        resultat.push(valeur)
        deja.add(identifiant)
      }
    }

    return resultat
  }, [])

  const suggestionsRisque = useMemo(() => {
    const docs = filtrerDocuments(documentsSource, {
      client: client || undefined,
      exercice: exercice || undefined,
      typeCourrier: typeCourrier || undefined,
    })

    const uniques = Array.from(
      new Set(
        docs
          .map((doc) => (doc.risque_detail?.type ?? '').toUpperCase())
          .filter((valeur): valeur is string => Boolean(valeur))
      )
    )

    return uniques
      .slice()
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
  }, [documentsSource, client, exercice, typeCourrier, filtrerDocuments])

  const suggestionsTypeCourrier = useMemo(() => {
    const docs = filtrerDocuments(documentsSource, {
      client: client || undefined,
      exercice: exercice || undefined,
      risque: risque || undefined,
    })

    const uniques = Array.from(
      new Set(
        docs
          .map((doc) => doc.type_courrier)
          .filter((valeur): valeur is TypeCourrierApi => Boolean(valeur))
      )
    )

    return uniques
  }, [documentsSource, client, exercice, risque, filtrerDocuments])

  const suggestionsExercices = useMemo(() => {
    const docs = filtrerDocuments(documentsSource, {
      client: client || undefined,
      risque: risque || undefined,
      typeCourrier: typeCourrier || undefined,
    })

    const annees = docs
      .map((doc) => doc.risque_detail?.exercice_info?.annee)
      .filter((annee): annee is number => typeof annee === 'number')

    if (annees.length === 0) {
      return exercicesDisponibles
    }

    return Array.from(new Set(annees)).sort((a, b) => b - a)
  }, [documentsSource, client, risque, typeCourrier, exercicesDisponibles, filtrerDocuments])

  const baseRisques = useMemo(() => {
    const dyn = typesRisqueDisponibles.map((type) => type.toUpperCase())
    const fallback = RISQUE_FALLBACK_TYPES.map(({ value }) => value.toUpperCase())
    return fusionnerSuggestions(dyn, fallback, normalizeRisqueKey)
      .slice()
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
  }, [typesRisqueDisponibles, fusionnerSuggestions])

  const anneesOptions = useMemo(() => {
    const base = exercicesDisponibles.length > 0 ? exercicesDisponibles : anneesFallback()
    return fusionnerSuggestions(suggestionsExercices, base)
      .slice()
      .sort((a, b) => b - a)
  }, [exercicesDisponibles, suggestionsExercices, fusionnerSuggestions, anneeMaxDisponible])

  const resultatsAffiches = useMemo(() => {
    return resultats.map((doc) => {
      const info = doc.risque_detail?.exercice_info
      const risqueType = (doc.risque_detail?.type ?? '').toUpperCase()
      const dateDocument = doc.date_document || doc.cree_le
      const taille = typeof doc.taille_fichier === 'number' ? doc.taille_fichier : undefined

      const labelTypeCourrier = TYPE_COURRIER_LIBELLES[doc.type_courrier] ?? doc.type_courrier
      const theme = TYPE_COURRIER_THEMES[doc.type_courrier] ?? DEFAULT_TYPE_COURRIER_THEME
      const risqueTheme = themeRisque(risqueType)

      const fichierUrl = doc.fichier_url ?? doc.fichierUrl ?? null

      return {
        id: doc.id,
        chemin: [info?.client, info?.annee, doc.risque_detail?.type ?? '', labelTypeCourrier]
          .filter(Boolean)
          .join(' / '),
        titre: doc.titre,
        client: info?.client ?? 'Client inconnu',
        risque: risqueType,
        reference: doc.reference ?? 'Référence inconnue',
        date: dateDocument ? format(new Date(dateDocument), 'yyyy-MM-dd', { locale: fr }) : 'Date inconnue',
        taille: taille ? formatTaille(taille) : '—',
        couleur: risqueTheme.badgeBg,
        risqueBadgeTextColor: risqueTheme.badgeText,
        risqueLabel: labelRisque(risqueType),
        typeCourrierLabel: labelTypeCourrier,
        typeCourrierBadgeBg: theme.badgeBg,
        typeCourrierBadgeText: theme.badgeText,
        creeIlYA: dateDocument ? formatDistanceToNow(new Date(dateDocument), { addSuffix: true, locale: fr }) : null,
        fichierUrl,
        source: doc,
      }
    })
  }, [resultats])

  const extraireUrlDocument = (doc: { fichierUrl?: string | null; fichier_url?: string | null; source?: any }) => {
    return doc.fichierUrl ?? doc.fichier_url ?? doc.source?.fichier_url ?? doc.source?.fichierUrl ?? null
  }

  const ouvrirDansNouvelOnglet = (doc: (typeof resultatsAffiches)[number]) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreurTelechargement("Document introuvable sur le serveur")
      return
    }

    if (typeof window !== 'undefined') {
      const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : buildApiUrl(url)
      const proxyUrl = `/api/proxy/document?url=${encodeURIComponent(resolvedUrl)}`
      window.open(proxyUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const telechargerResultat = (doc: (typeof resultatsAffiches)[number]) => {
    const url = extraireUrlDocument(doc)
    if (!url) {
      setErreurTelechargement("Document introuvable sur le serveur")
      return
    }

    setErreurTelechargement(null)
    if (typeof window !== 'undefined') {
      const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : buildApiUrl(url)
      const proxyUrl = `/api/proxy/document?url=${encodeURIComponent(resolvedUrl)}`

      const startDownload = async () => {
        try {
          const response = await fetch(proxyUrl, {
            credentials: 'include',
            headers: { Accept: 'application/pdf,image/*' },
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
          console.error('Téléchargement recherche', error)
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
        }
      }

      void startDownload()
    }
  }

  const typesRisque = useMemo(() => {
    const ordonnes = fusionnerSuggestions(suggestionsRisque, baseRisques, normalizeRisqueKey)
      .slice()
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
    return [''].concat(ordonnes)
  }, [suggestionsRisque, baseRisques, fusionnerSuggestions])

  const typesCourrier = useMemo<TypeCourrierOption[]>(
    () => {
      const ordonnes = fusionnerSuggestions(suggestionsTypeCourrier, toutesTypesCourrier)
      return [{ value: '', label: 'Tous les courriers', theme: DEFAULT_TYPE_COURRIER_THEME }].concat(
        ordonnes.map((value) => ({
          value,
          label: TYPE_COURRIER_LIBELLES[value] ?? value,
          theme: TYPE_COURRIER_THEMES[value] ?? DEFAULT_TYPE_COURRIER_THEME,
        }))
      )
    },
    [suggestionsTypeCourrier, toutesTypesCourrier, fusionnerSuggestions]
  )

  function anneesFallback() {
    const current = new Date().getFullYear()
    const start = 2022
    const max = Math.max(current, anneeMaxDisponible ?? current)
    const annees: number[] = []
    for (let annee = max; annee >= start; annee -= 1) {
      annees.push(annee)
    }
    return annees
  }

  function formatTaille(bytes: number) {
    if (bytes < 1024) return `${bytes} o`
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
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

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary flex">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-10 overflow-auto">
        {/* En-tête minimaliste */}
        <motion.header 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Exploration</p>
          <h1 className="text-3xl font-semibold text-theme-primary">Recherche avancée</h1>
          <p className="text-sm text-theme-secondary mt-1">Client → Exercice → Risque → Documents</p>
        </motion.header>

        {/* Formulaire de recherche */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-theme-card border border-theme rounded-xl p-6 mb-8"
        >
          <form onSubmit={gererRecherche} className="space-y-6">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-theme-secondary uppercase tracking-wider mb-3">
                1. Client
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Rechercher un client..."
                className="w-full px-4 py-2.5 text-sm bg-theme-base border border-theme rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all outline-none"
                list="liste-clients"
              />
              <datalist id="liste-clients">
                {clients.map((c) => (
                  <option key={c.id} value={c.nom} />
                ))}
              </datalist>
              {clients.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-theme-secondary mb-2">
                    <span>{clientsPagination.total} client{clientsPagination.total > 1 ? 's' : ''}</span>
                    {clientsPagination.totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPageClients((p) => Math.max(1, p - 1))}
                          disabled={clientsPagination.page <= 1}
                          className="px-2 py-1 text-xs rounded border border-theme hover:bg-theme-muted disabled:opacity-40"
                        >
                          ←
                        </button>
                        <span>{clientsPagination.page}/{clientsPagination.totalPages}</span>
                        <button
                          type="button"
                          onClick={() => setPageClients((p) => Math.min(clientsPagination.totalPages, p + 1))}
                          disabled={clientsPagination.page >= clientsPagination.totalPages}
                          className="px-2 py-1 text-xs rounded border border-theme hover:bg-theme-muted disabled:opacity-40"
                        >
                          →
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                    {clientsPagination.items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClient(c.nom)}
                        className={`text-left px-3 py-2 text-xs rounded-lg border transition-colors ${
                          client === c.nom 
                            ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' 
                            : 'border-theme hover:bg-theme-muted'
                        }`}
                      >
                        {c.nom}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Exercice */}
            <div>
              <label className="block text-xs font-semibold text-theme-secondary uppercase tracking-wider mb-3">
                2. Exercice
              </label>
              <div className="flex flex-wrap gap-2">
                {(anneesOptions.length > 0 ? anneesOptions : anneesFallback()).map((annee) => (
                  <button
                    key={annee}
                    type="button"
                    onClick={() => setExercice(String(annee))}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                      exercice === String(annee)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                        : 'border-theme hover:bg-theme-muted text-theme-primary'
                    }`}
                  >
                    {annee}
                  </button>
                ))}
              </div>
            </div>

            {/* Type de Risque */}
            <div>
              <label className="block text-xs font-semibold text-theme-secondary uppercase tracking-wider mb-3">
                3. Type de risque
              </label>
              <div className="flex flex-wrap gap-2">
                {typesRisque.map((type) => {
                  const isActif = risque === type
                  return (
                    <button
                      key={type || 'tous'}
                      type="button"
                      onClick={() => setRisque(type)}
                      className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                        isActif
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium'
                          : 'border-theme hover:bg-theme-muted text-theme-primary'
                      }`}
                    >
                      {type ? labelRisque(type) : 'Tous'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Type de Courrier */}
            <div>
              <label className="block text-xs font-semibold text-theme-secondary uppercase tracking-wider mb-3">
                4. Type de courrier
              </label>
              <div className="flex flex-wrap gap-2">
                {typesCourrier.slice(1).map((type) => {
                  const isActif = typeCourrier === type.value
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setTypeCourrier((courrierActuel) => (courrierActuel === type.value ? '' : type.value))}
                      className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                        isActif
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                          : 'border-theme hover:bg-theme-muted text-theme-primary'
                      }`}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 pt-4 border-t border-theme">
              <button
                type="submit"
                disabled={chargement}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="search" size="sm" />
                {chargement ? 'Recherche...' : 'Rechercher'}
              </button>
              <button
                type="button"
                onClick={reinitialiser}
                className="px-6 py-2.5 text-sm text-theme-secondary hover:bg-theme-muted rounded-lg transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </form>
        </motion.div>

        {afficherResultats && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-theme-card border border-theme rounded-xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-theme">
              <h2 className="text-sm font-semibold text-theme-primary">
                {resultatsAffiches.length} résultat{resultatsAffiches.length > 1 ? 's' : ''}
              </h2>
            </div>

            {erreur ? (
              <div className="p-4 m-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm">
                {erreur}
              </div>
            ) : resultatsAffiches.length === 0 ? (
              <div className="text-center text-theme-secondary py-12 text-sm">
                Aucun document ne correspond aux critères sélectionnés.
              </div>
            ) : (
              <div className="divide-y divide-theme">
                {erreurTelechargement && (
                  <div className="p-4 m-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm">
                    {erreurTelechargement}
                  </div>
                )}
                {resultatsAffiches.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-4 hover:bg-theme-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-theme-secondary font-mono mb-1 truncate">
                          {doc.chemin || '—'}
                        </p>
                        <h3 className="font-medium text-theme-primary text-sm mb-2">
                          {doc.titre}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-theme-muted text-theme-secondary">
                            {doc.risqueLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-theme-muted text-theme-secondary">
                            {doc.typeCourrierLabel}
                          </span>
                          <span className="text-theme-secondary">{doc.reference}</span>
                          <span className="text-theme-secondary">·</span>
                          <span className="text-theme-secondary">{doc.date}</span>
                          <span className="text-theme-secondary">·</span>
                          <span className="text-theme-secondary">{doc.taille}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button 
                          className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-muted rounded-lg transition-colors" 
                          title="Imprimer"
                          onClick={(event) => { event.stopPropagation(); imprimerResultat(doc) }}
                        >
                          <Icon name="print" size="sm" />
                        </button>
                        <button 
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" 
                          title="Voir"
                          onClick={(event) => { event.stopPropagation(); ouvrirDansNouvelOnglet(doc) }}
                        >
                          <Icon name="eye" size="sm" />
                        </button>
                        <button 
                          className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-muted rounded-lg transition-colors" 
                          title="Télécharger"
                          onClick={(event) => { event.stopPropagation(); telechargerResultat(doc) }}
                        >
                          <Icon name="download" size="sm" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {!afficherResultats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-theme-card border border-theme rounded-xl"
          >
            <Icon name="search" size="lg" className="mx-auto mb-3 text-theme-secondary" />
            <p className="text-sm font-medium text-theme-primary mb-1">Lancez une recherche</p>
            <p className="text-xs text-theme-secondary">Utilisez les filtres ci-dessus pour trouver vos documents</p>
          </motion.div>
        )}
      </main>
    </div>
  )
}
