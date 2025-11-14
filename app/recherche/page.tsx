'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetchJson, buildApiUrl } from '@/lib/api'
import { getToken } from '@/lib/session'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatDistanceToNow } from 'date-fns'

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
  SINISTRE: 'Sinistre'
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

  const labelRisque = (type?: string | null) => {
    if (!type) return 'Risque inconnu'
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const themeRisque = (type?: string | null): RisqueTheme => {
    const cle = normalizeRisqueKey(type)
    if (!cle) return DEFAULT_RISQUE_THEME
    return RISQUE_THEMES[cle] ?? generateRisqueTheme(cle)
  }

  useEffect(() => {
    void chargerDocuments().catch((error) => {
      console.error('Erreur initiale chargement documents', error)
    })
  }, [chargerDocuments])

  useEffect(() => {
    let ignore = false

    const chargerOptions = async () => {
      try {
        const [clientsRes, exercicesRes, risquesRes] = await Promise.all([
          apiFetchJson<{ results?: ClientApi[] }>('/clients/?page_size=500&ordering=nom'),
          apiFetchJson<{ results?: ExerciceApi[] }>('/exercices/?page_size=500&ordering=-annee'),
          apiFetchJson<{ results?: RisqueApi[] }>('/risques/?page_size=500'),
        ])

        if (ignore) return

        setClients(Array.isArray(clientsRes.data?.results) ? clientsRes.data!.results : [])

        const exercicesList = Array.isArray(exercicesRes.data?.results)
          ? exercicesRes.data!.results
              .map((ex) => ex.annee)
              .filter((annee): annee is number => typeof annee === 'number')
          : []
        const uniques = Array.from(new Set(exercicesList)).sort((a, b) => b - a)
        setExercicesDisponibles(uniques)
        if (uniques.length > 0) {
          setAnneeMaxDisponible(Math.max(...uniques))
        }

        const risquesList = Array.isArray(risquesRes.data?.results)
          ? risquesRes.data!.results
              .map((r) => r.type)
              .filter((type): type is string => Boolean(type))
          : []
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
    const fallback = ['AUTOMOBILE', 'SANTE', 'HABITATION', 'VIE', 'RESPONSABILITE_CIVILE']
    return fusionnerSuggestions(dyn, fallback, normalizeRisqueKey)
  }, [typesRisqueDisponibles, fusionnerSuggestions])

  const anneesOptions = useMemo(() => {
    const base = exercicesDisponibles.length > 0 ? exercicesDisponibles : anneesFallback()
    return fusionnerSuggestions(suggestionsExercices, base)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
            <Icon name="search" size="xl" className="text-red-600" />
            Recherche Avancée
          </h1>
          <p className="text-gray-600">Trouvez rapidement vos documents par Client → Exercice → Risque</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Critères de recherche</h2>
          </div>

          <form onSubmit={gererRecherche} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#D32027' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold">1</span>
                Client
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nom du client..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                list="liste-clients"
              />
              <datalist id="liste-clients">
                {clients.map((c) => (
                  <option key={c.id} value={c.nom} />
                ))}
              </datalist>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#0066B3' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">2</span>
                Exercice (Année)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(anneesOptions.length > 0 ? anneesOptions : anneesFallback()).map((annee) => (
                  <motion.button
                    key={annee}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setExercice(String(annee))}
                    className={`py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      exercice === String(annee)
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon name="calendar" size="sm" />
                    {annee}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#D32027' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold">3</span>
                Type de Risque
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {typesRisque.map((type) => {
                  const isActif = risque === type
                  const theme = type ? themeRisque(type) : DEFAULT_RISQUE_THEME

                  return (
                    <motion.button
                      key={type || 'tous'}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setRisque(type)}
                      className={`py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        isActif ? 'text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={isActif ? { backgroundColor: theme.badgeBg, color: theme.badgeText } : {}}
                    >
                      <Icon name="shield" size="sm" />
                      {type ? labelRisque(type) : 'Tous les risques'}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="border-l-4 pl-6 py-2"
              style={{ borderColor: '#0066B3' }}
            >
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">4</span>
                Type de Courrier
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {typesCourrier.slice(1).map((type) => {
                  const isActif = typeCourrier === type.value
                  const theme = type.theme ?? DEFAULT_TYPE_COURRIER_THEME

                  return (
                    <motion.button
                      key={type.value}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        setTypeCourrier((courrierActuel) => (courrierActuel === type.value ? '' : type.value))
                      }
                      className={`py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        isActif ? 'text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={isActif ? { backgroundColor: theme.badgeBg } : {}}
                    >
                      <Icon name="email" size="sm" />
                      {type.label}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>

            <div className="flex gap-4 pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                disabled={chargement}
              >
                <Icon name="search" size="sm" />
                {chargement ? 'Recherche en cours...' : 'Rechercher'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={reinitialiser}
                className="px-8 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Réinitialiser
              </motion.button>
            </div>
          </form>
        </motion.div>

        {afficherResultats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Icon name="folder" size="md" />
                Résultats ({resultatsAffiches.length} document{resultatsAffiches.length > 1 ? 's' : ''})
              </h2>
            </div>

            {erreur ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {erreur}
              </div>
            ) : resultatsAffiches.length === 0 ? (
              <div className="text-center text-gray-500 py-10">Aucun document ne correspond aux critères sélectionnés.</div>
            ) : (
              <div className="space-y-4">
                {erreurTelechargement ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {erreurTelechargement}
                  </div>
                ) : null}
                {resultatsAffiches.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ x: 5 }}
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-red-300 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                          <Icon name="folder" size="xs" />
                          <span className="font-mono">{doc.chemin || 'Chemin indisponible'}</span>
                        </div>

                        <h3 className="font-bold text-xl text-gray-900 mb-3 hover:text-red-600 transition-colors">
                          {doc.titre}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className="px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2"
                            style={{ backgroundColor: doc.couleur, color: doc.risqueBadgeTextColor }}
                          >
                            <Icon name="shield" size="xs" />
                            {doc.risqueLabel}
                          </span>
                          <span
                            className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
                            style={{ backgroundColor: doc.typeCourrierBadgeBg, color: doc.typeCourrierBadgeText }}
                          >
                            <Icon name="email" size="xs" />
                            {doc.typeCourrierLabel}
                          </span>
                          <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium flex items-center gap-2">
                            <Icon name="tag" size="xs" />
                            {doc.reference}
                          </span>
                          <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                            <Icon name="calendar" size="xs" />
                            {doc.date}
                          </span>
                          <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-2">
                            <Icon name="inbox" size="xs" />
                            {doc.taille}
                          </span>
                          {doc.creeIlYA ? (
                            <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              Ajouté {doc.creeIlYA}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          className="p-3 hover:bg-gray-100 rounded-xl transition-colors" 
                          title="Imprimer"
                          onClick={(event) => {
                            event.stopPropagation()
                            imprimerResultat(doc)
                          }}
                        >
                          <Icon name="print" size="md" />
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          className="p-3 hover:bg-gray-100 rounded-xl transition-colors" 
                          title="Voir"
                          onClick={(event) => {
                            event.stopPropagation()
                            ouvrirDansNouvelOnglet(doc)
                          }}
                        >
                          <Icon name="eye" size="md" />
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          className="p-3 hover:bg-blue-100 rounded-xl transition-colors" 
                          title="Télécharger"
                          onClick={(event) => {
                            event.stopPropagation()
                            telechargerResultat(doc)
                          }}
                        >
                          <Icon name="download" size="md" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {!afficherResultats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-2xl shadow-lg"
          >
            <Icon name="search" size="xl" className="mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-semibold text-gray-700 mb-2">Utilisez les critères ci-dessus pour rechercher</p>
            <p className="text-sm text-gray-500">Navigation: Client → Exercice → Risque → Documents</p>
          </motion.div>
        )}
      </main>
    </div>
  )
}
