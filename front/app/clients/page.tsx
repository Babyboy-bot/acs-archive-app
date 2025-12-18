'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from '@/components/Sidebar'
import { Icon } from '@/components/Icon'
import { apiFetchJson } from '@/lib/api'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useTheme } from '@/hooks/useTheme'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FormModal } from '@/components/ui/FormModal'

type ClientType = 'ENTREPRISE' | 'PARTICULIER'

type RisqueResume = {
  id: string
  type: string
  numeroPolice: string | null
}

type ExerciceResume = {
  id: string
  annee: number
  statut: string
  risques: RisqueResume[]
}

type NouveauRisqueSelection = {
  type: string
  numeroPolice: string | null
}

type StatutExercice = 'ACTIF' | 'ARCHIVE' | 'CLOTURE'

type ClientDRF = {
  id: string
  nom: string
  numero_client: string | null
  type: ClientType
  email: string | null
  telephone: string | null
  adresse: string | null
  cree_le: string
  modifie_le: string
  entreprise: string | null
  entreprise_nom: string | null
  nombre_personnes_rattachees: number
  exercices?: ExerciceResume[]
}

type ClientAPI = {
  id: string
  nom: string
  numeroClient: string | null
  type: ClientType
  email: string | null
  telephone: string | null
  adresse: string | null
  creeLe: string
  modifieLe: string
  entrepriseId: string | null
  entrepriseNom: string | null
  nombrePersonnesRattachees: number
  exercices: ExerciceResume[]
}

type FormClient = {
  id?: string
  nom: string
  numeroClient: string
  type: ClientType
  email: string
  telephone: string
  adresse: string
  entrepriseId?: string
}

const TYPES_CLIENT: { value: ClientType; label: string }[] = [
  { value: 'ENTREPRISE', label: 'Entreprise' },
  { value: 'PARTICULIER', label: 'Particulier' }
]

const STATUTS_EXERCICE: { value: StatutExercice; label: string }[] = [
  { value: 'ACTIF', label: 'Actif' },
  { value: 'ARCHIVE', label: 'Archivé' },
  { value: 'CLOTURE', label: 'Clôturé' }
]

const ANNEE_MIN_EXERCICE = 2022

const SUGGESTIONS_RISQUES = [
  'Automobile',
  'Santé',
  'MRP facultés',
  'Prévoyance décès',
  'Bris de machine',
  'Divers',
  'Evacuation sanitaire',
  'Globale dommages',
  'Individuelle accidents',
  'Multirisque habitation',
  'Multirisque immeuble',
  'Multirisque professionnelle',
  'Règlements',
  'Sinistre',
  'Responsabilité civile',
  'Indemnité de fin de carrière',
  'Retraite',
  'Retraite complémentaire',
  'Temporaire décès',
  'Transport',
  'Transport facultés',
  'Voyage',
  'Caution',
  'Tous risques chantier'
]

const CLIENTS_PAR_PAGE = 50

const FORMULAIRE_INITIAL: FormClient = {
  nom: '',
  numeroClient: '',
  type: 'ENTREPRISE',
  email: '',
  telephone: '',
  adresse: '',
  entrepriseId: ''
}

function mapClient(client: ClientDRF): ClientAPI {
  return {
    id: client.id,
    nom: client.nom,
    numeroClient: client.numero_client ?? null,
    type: client.type,
    email: client.email,
    telephone: client.telephone,
    adresse: client.adresse,
    creeLe: client.cree_le,
    modifieLe: client.modifie_le,
    entrepriseId: client.entreprise ?? null,
    entrepriseNom: client.entreprise_nom ?? null,
    nombrePersonnesRattachees: client.nombre_personnes_rattachees ?? 0,
    exercices: client.exercices ?? []
  }
}

export default function PageClients() {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  useEnforceNonConsultant()
  const { isDark } = useTheme()

  const [clients, setClients] = useState<ClientAPI[]>([])
  const [entreprises, setEntreprises] = useState<{ id: string; nom: string }[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [messageSucces, setMessageSucces] = useState('')
  const [clientEdite, setClientEdite] = useState<ClientAPI | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null)
  const [suppressionExerciceEnCours, setSuppressionExerciceEnCours] = useState<string | null>(null)
  const [soumissionEnCours, setSoumissionEnCours] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [typeFiltre, setTypeFiltre] = useState<ClientType | ''>('')
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)
  const [pageClients, setPageClients] = useState(1)
  const [clientOuvertId, setClientOuvertId] = useState<string | null>(null)
  const [clientsExercicesCharges, setClientsExercicesCharges] = useState<Record<string, boolean>>({})
  const [clientsExercicesChargement, setClientsExercicesChargement] = useState<Record<string, boolean>>({})

  const [formulaire, setFormulaire] = useState<FormClient>(FORMULAIRE_INITIAL)
  const [clientExerciceId, setClientExerciceId] = useState<string | null>(null)
  const [anneeExercice, setAnneeExercice] = useState<string>(() => String(new Date().getFullYear()))
  const [statutExercice, setStatutExercice] = useState<StatutExercice>('ACTIF')
  const [exerciceEdite, setExerciceEdite] = useState<ExerciceResume | null>(null)
  const [chargementExercice, setChargementExercice] = useState(false)
  const [clientRisqueId, setClientRisqueId] = useState<string | null>(null)
  const [exerciceRisqueId, setExerciceRisqueId] = useState<string | null>(null)
  const [risqueType, setRisqueType] = useState('')
  const [risqueNumero, setRisqueNumero] = useState('')
  const [risquesSelectionnes, setRisquesSelectionnes] = useState<NouveauRisqueSelection[]>([])
  const [chargementRisque, setChargementRisque] = useState(false)

  // États pour les modales de confirmation
  const [modaleSuppressionClient, setModaleSuppressionClient] = useState<{ open: boolean; client: ClientAPI | null }>({
    open: false,
    client: null
  })
  const [modaleSuppressionExercice, setModaleSuppressionExercice] = useState<{ open: boolean; client: ClientAPI | null; exercice: ExerciceResume | null }>({
    open: false,
    client: null,
    exercice: null
  })

  // État pour la modale détail exercice
  const [modaleDetailExercice, setModaleDetailExercice] = useState<{ open: boolean; client: ClientAPI | null; exercice: ExerciceResume | null }>({
    open: false,
    client: null,
    exercice: null
  })

  useEffect(() => {
    const chargerEntreprises = async () => {
      try {
        const { response, data } = await apiFetchJson('/clients/?type=ENTREPRISE')
        if (!response.ok) {
          return
        }
        const bruts = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.results)
            ? (data as any).results
            : []
        const normalises = bruts.map((client: any) => ({ id: client.id as string, nom: client.nom as string }))
        setEntreprises(normalises)
      } catch (error) {
        console.error('Erreur chargement entreprises:', error)
      }
    }

    chargerEntreprises()
  }, [])

  useEffect(() => {
    if (!messageSucces && !erreur) {
      return
    }

    const timer = window.setTimeout(() => {
      setMessageSucces('')
      setErreur('')
    }, 5000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [messageSucces, erreur])

  const fermerFormulaireRisque = () => {
    setClientRisqueId(null)
    setExerciceRisqueId(null)
    setRisqueType('')
    setRisqueNumero('')
  }

  const ouvrirFormulaireRisque = (client: ClientAPI, exercice: ExerciceResume) => {
    const estOuvert = clientRisqueId === client.id && exerciceRisqueId === exercice.id
    if (estOuvert) {
      fermerFormulaireRisque()
      return
    }

    setClientRisqueId(client.id)
    setExerciceRisqueId(exercice.id)
    setRisqueType('')
    setRisqueNumero('')
    setExerciceEdite(null)
    setErreur('')
    setMessageSucces('')
  }

  const normaliserTypeRisque = (valeur: string) => valeur.trim()

  const typeCle = (valeur: string) => normaliserTypeRisque(valeur).toUpperCase()

  const estDejaDansSelection = (selection: NouveauRisqueSelection[], type: string) =>
    selection.some((risque) => typeCle(risque.type) === typeCle(type))

  const ajouterRisqueSelection = (typeSource?: string, numeroSource?: string | null) => {
    if (!clientRisqueId || !exerciceRisqueId) {
      return
    }

    const typeNettoye = normaliserTypeRisque(typeSource ?? risqueType)
    if (typeNettoye.length < 3) {
      setErreur('Merci de saisir un type de risque (au moins 3 caractères).')
      return
    }

    const clientCible = clients.find((c) => c.id === clientRisqueId)
    const exerciceCible = clientCible?.exercices.find((ex) => ex.id === exerciceRisqueId)
    const existeDejaDansExercice = exerciceCible?.risques.some(
      (risque) => typeCle(risque.type) === typeCle(typeNettoye)
    )

    if (existeDejaDansExercice) {
      setErreur(`L’exercice ${exerciceCible?.annee ?? ''} possède déjà un risque « ${typeNettoye} ». `)
      return
    }

    if (estDejaDansSelection(risquesSelectionnes, typeNettoye)) {
      setErreur(`Le risque « ${typeNettoye} » est déjà dans la sélection.`)
      return
    }

    const numeroNettoye = normaliserTypeRisque(numeroSource ?? risqueNumero)

    setRisquesSelectionnes((prev) => [
      ...prev,
      {
        type: typeNettoye,
        numeroPolice: numeroNettoye ? numeroNettoye : null
      }
    ])
    setRisqueType('')
    setRisqueNumero('')
    setErreur('')
  }

  const retirerRisqueSelection = (type: string) => {
    setRisquesSelectionnes((prev) => prev.filter((risque) => typeCle(risque.type) !== typeCle(type)))
  }

  const toggleSuggestionRisque = (suggestion: string) => {
    const dejaSelectionne = estDejaDansSelection(risquesSelectionnes, suggestion)
    if (dejaSelectionne) {
      retirerRisqueSelection(suggestion)
      return
    }
    ajouterRisqueSelection(suggestion, null)
  }

  const soumettreNouveauRisque = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!clientRisqueId || !exerciceRisqueId) return

    const clientCible = clients.find((c) => c.id === clientRisqueId)
    const exerciceCible = clientCible?.exercices.find((ex) => ex.id === exerciceRisqueId)
    if (!exerciceCible) {
      setErreur('Sélection invalide. Merci de réessayer.')
      return
    }

    const selectionInitiale = [...risquesSelectionnes]
    const typeRestant = normaliserTypeRisque(risqueType)

    if (typeRestant) {
      if (typeRestant.length < 3) {
        setErreur('Merci de saisir un type de risque (au moins 3 caractères).')
        return
      }

      if (estDejaDansSelection(selectionInitiale, typeRestant)) {
        setErreur(`Le risque « ${typeRestant} » est déjà dans la sélection.`)
        return
      }

      const existeDejaDansExercice = exerciceCible.risques.some(
        (risque) => typeCle(risque.type) === typeCle(typeRestant)
      )

      if (existeDejaDansExercice) {
        setErreur(`L’exercice ${exerciceCible.annee} possède déjà un risque « ${typeRestant} ». `)
        return
      }

      selectionInitiale.push({
        type: typeRestant,
        numeroPolice: risqueNumero.trim() ? risqueNumero.trim() : null
      })
    }

    if (selectionInitiale.length === 0) {
      setErreur('Merci d’ajouter au moins un risque à la sélection avant de valider.')
      return
    }

    const doublonDansExistant = selectionInitiale.find((selection) =>
      exerciceCible.risques.some((risque) => typeCle(risque.type) === typeCle(selection.type))
    )

    if (doublonDansExistant) {
      setErreur(`L’exercice ${exerciceCible.annee} possède déjà un risque « ${doublonDansExistant.type} ». `)
      return
    }

    setChargementRisque(true)
    setErreur('')
    setMessageSucces('')

    try {
      for (const risque of selectionInitiale) {
        const { response, data } = await apiFetchJson('/risques/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: risque.type,
            numero_police: risque.numeroPolice,
            exercice: exerciceRisqueId
          })
        })

        if (!response.ok) {
          throw new Error(
            (data as any)?.erreur || (data as any)?.detail || `Impossible de créer le risque « ${risque.type} ».`
          )
        }
      }

      await chargerClients(recherche, typeFiltre)
      setMessageSucces(
        selectionInitiale.length > 1
          ? `${selectionInitiale.length} risques ajoutés avec succès.`
          : `Risque « ${selectionInitiale[0].type} » ajouté avec succès.`
      )
      fermerFormulaireRisque()
      setRisquesSelectionnes([])
      setRisqueType('')
      setRisqueNumero('')
    } catch (error: any) {
      console.error('Erreur création risque:', error)
      setErreur(error?.message || 'Impossible de créer les risques.')
    } finally {
      setChargementRisque(false)
    }
  }

  const ouvrirModaleSuppressionExercice = (client: ClientAPI, exercice: ExerciceResume) => {
    // Fermer d'abord la modale de détail d'exercice
    setModaleDetailExercice({ open: false, client: null, exercice: null })
    // Puis ouvrir la modale de confirmation
    setModaleSuppressionExercice({ open: true, client, exercice })
  }

  const fermerModaleSuppressionExercice = () => {
    setModaleSuppressionExercice({ open: false, client: null, exercice: null })
  }

  const confirmerSuppressionExercice = async () => {
    const { client, exercice } = modaleSuppressionExercice
    if (!client || !exercice) return

    setSuppressionExerciceEnCours(exercice.id)
    setErreur('')
    setMessageSucces('')

    try {
      const { response, data } = await apiFetchJson(`/exercices/${exercice.id}/`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || "Impossible de supprimer l'exercice")
      }

      if (clientRisqueId === client.id && exerciceRisqueId === exercice.id) {
        fermerFormulaireRisque()
      }
      if (clientExerciceId === client.id) {
        fermerFormulaireExercice()
      }

      await chargerClients(recherche, typeFiltre)
      setMessageSucces((data as any)?.message || `Exercice ${exercice.annee} supprimé avec succès.`)
    } catch (error: any) {
      console.error('Erreur suppression exercice:', error)
      setErreur(error?.message || "Impossible de supprimer l'exercice.")
    } finally {
      setSuppressionExerciceEnCours(null)
      fermerModaleSuppressionExercice()
    }
  }

  const chargerClients = async (rechercheParam?: string, typeParam?: string) => {
    setChargement(true)
    setErreur('')
    try {
      // Construire l'URL avec les paramètres de recherche
      const params = new URLSearchParams()
      const rechercheNettoyee = (rechercheParam ?? '').trim()
      if (rechercheNettoyee) params.append('search', rechercheNettoyee)
      if (typeParam) params.append('type', typeParam)
      params.append('simple', '1')
      params.append('ordering', 'nom')

      const url = `/clients/?${params.toString()}`

      const { response, data } = await apiFetchJson(url)
      if (!response.ok) {
        throw new Error((data as any)?.detail || 'Impossible de charger les clients')
      }
      const bruts: ClientDRF[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.results)
          ? (data as any).results
          : []
      setClients(bruts.map(mapClient))
      setClientsExercicesCharges({})
      setClientsExercicesChargement({})
    } catch (error: any) {
      console.error('Erreur chargement clients:', error)
      setErreur(error?.message || 'Erreur lors du chargement des clients')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    chargerClients(recherche, typeFiltre)
  }, [recherche, typeFiltre])

  const chargerExercicesClient = async (clientId: string) => {
    setClientsExercicesChargement((prev) => ({ ...prev, [clientId]: true }))
    try {
      const { response, data } = await apiFetchJson(`/exercices/?client=${clientId}`)
      if (!response.ok) {
        throw new Error((data as any)?.detail || 'Impossible de charger les exercices du client')
      }

      const bruts: any[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.results)
          ? (data as any).results
          : []

      const exercices: ExerciceResume[] = bruts.map((exercice: any) => ({
        id: exercice.id as string,
        annee: exercice.annee as number,
        statut: (exercice.statut as string) ?? 'ACTIF',
        risques: Array.isArray(exercice.risques)
          ? exercice.risques.map((risque: any) => ({
            id: risque.id as string,
            type: (risque.type as string) ?? '',
            numeroPolice:
              (risque.numeroPolice as string | null) ??
              (risque.numero_police as string | null) ??
              null,
          }))
          : [],
      }))

      setClients((precedent) =>
        precedent.map((client) =>
          client.id === clientId
            ? {
              ...client,
              exercices,
            }
            : client,
        ),
      )

      setClientsExercicesCharges((prev) => ({ ...prev, [clientId]: true }))
    } catch (error: any) {
      console.error('Erreur chargement exercices client:', error)
      setErreur(error?.message || "Erreur lors du chargement des exercices du client")
    } finally {
      setClientsExercicesChargement((prev) => ({ ...prev, [clientId]: false }))
    }
  }

  const reinitialiserFormulaire = () => {
    setClientEdite(null)
    setFormulaire(FORMULAIRE_INITIAL)
    setErreur('')
    setMessageSucces('')
  }

  const fermerFormulaire = () => {
    reinitialiserFormulaire()
    setAfficherFormulaire(false)
  }

  const editerClient = (client: ClientAPI) => {
    setClientEdite(client)
    setMessageSucces('')
    setErreur('')
    setFormulaire({
      id: client.id,
      nom: client.nom,
      numeroClient: client.numeroClient ?? '',
      type: client.type,
      email: client.email ?? '',
      telephone: client.telephone ?? '',
      adresse: client.adresse ?? '',
      entrepriseId: client.entrepriseId ?? ''
    })
    setAfficherFormulaire(true)
  }

  const clientsFiltres = useMemo(() => {
    // Plus besoin de filtrer localement, l'API s'en charge maintenant
    return clients
  }, [clients])

  const clientsPagination = useMemo(() => {
    const total = clientsFiltres.length
    const totalPages = Math.max(1, Math.ceil(total / CLIENTS_PAR_PAGE))
    const page = Math.min(Math.max(1, pageClients), totalPages)
    const start = (page - 1) * CLIENTS_PAR_PAGE
    const end = start + CLIENTS_PAR_PAGE
    const items = clientsFiltres.slice(start, end)
    return { items, total, page, totalPages }
  }, [clientsFiltres, pageClients])

  useEffect(() => {
    setPageClients(1)
  }, [recherche, typeFiltre])

  const soumettreFormulaire = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErreur('')
    setMessageSucces('')

    if (!formulaire.nom.trim() || formulaire.nom.trim().length < 3) {
      setErreur('Le nom du client doit contenir au moins 3 caractères.')
      return
    }

    setSoumissionEnCours(true)

    const payload = {
      nom: formulaire.nom.trim(),
      numero_client: formulaire.numeroClient.trim() || null,
      type: formulaire.type,
      email: formulaire.email.trim() || null,
      telephone: formulaire.telephone.trim() || null,
      adresse: formulaire.adresse.trim() || null,
      entreprise:
        formulaire.type === 'PARTICULIER' && formulaire.entrepriseId && formulaire.entrepriseId.trim()
          ? formulaire.entrepriseId.trim()
          : null
    }

    const estEdition = Boolean(formulaire.id)
    const url = estEdition ? `/clients/${formulaire.id}/` : '/clients/'
    const method = estEdition ? 'PUT' : 'POST'

    try {
      const { response, data } = await apiFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok || !data || typeof data !== 'object') {
        throw new Error((data as any)?.erreur || (data as any)?.detail || `Erreur lors ${estEdition ? 'de la mise à jour' : 'de la création'} du client`)
      }

      await chargerClients(recherche, typeFiltre)
      const clientReponse = (data as any).client as ClientDRF | undefined
      const nomClient = clientReponse?.nom ?? formulaire.nom.trim()
      setMessageSucces(`Client ${nomClient} ${estEdition ? 'mis à jour' : 'créé'} avec succès.`)
      fermerFormulaire()
    } catch (error: any) {
      console.error('Erreur sauvegarde client:', error)
      setErreur(error?.message || `Impossible ${estEdition ? 'de mettre à jour' : 'de créer'} le client.`)
    } finally {
      setSoumissionEnCours(false)
    }
  }

  const fermerFormulaireExercice = () => {
    setClientExerciceId(null)
    setStatutExercice('ACTIF')
    setAnneeExercice(String(new Date().getFullYear()))
    setExerciceEdite(null)
  }

  const ouvrirFormulaireExercice = (client: ClientAPI) => {
    if (clientExerciceId === client.id) {
      fermerFormulaireExercice()
      return
    }

    const anneeParDefaut = (() => {
      if (client.exercices.length === 0) return String(new Date().getFullYear())
      const maxAnnee = client.exercices.reduce((max, exercice) => Math.max(max, exercice.annee), ANNEE_MIN_EXERCICE)
      return String(Math.max(maxAnnee, new Date().getFullYear()))
    })()

    setClientExerciceId(client.id)
    setStatutExercice('ACTIF')
    setAnneeExercice(anneeParDefaut)
    setExerciceEdite(null)
    setErreur('')
    setMessageSucces('')
  }

  const ouvrirEditionExercice = (client: ClientAPI, exercice: ExerciceResume) => {
    const estDejaOuvert = exerciceEdite?.id === exercice.id && clientExerciceId === client.id
    if (estDejaOuvert) {
      fermerFormulaireExercice()
      return
    }

    setClientExerciceId(client.id)
    setExerciceEdite(exercice)
    setAnneeExercice(String(exercice.annee))
    setStatutExercice(exercice.statut as StatutExercice)
    setErreur('')
    setMessageSucces('')
    fermerFormulaireRisque()
  }

  const soumettreNouvelExercice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!clientExerciceId) return

    if (exerciceEdite) {
      setErreur('')
      setMessageSucces('')
      setChargementExercice(true)

      try {
        const { response, data } = await apiFetchJson(`/exercices/${exerciceEdite.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut: statutExercice })
        })

        if (!response.ok) {
          throw new Error((data as any)?.erreur || (data as any)?.detail || "Impossible de mettre à jour l'exercice")
        }

        await chargerClients(recherche, typeFiltre)
        setMessageSucces(`Exercice ${exerciceEdite.annee} mis à jour avec succès.`)
        fermerFormulaireExercice()
      } catch (error: any) {
        console.error('Erreur mise à jour exercice:', error)
        setErreur(error?.message || "Impossible de mettre à jour l'exercice.")
      } finally {
        setChargementExercice(false)
      }

      return
    }

    const anneeNumerique = Number(anneeExercice)

    if (!Number.isInteger(anneeNumerique) || anneeExercice.trim().length !== 4) {
      setErreur('Merci de saisir une année à 4 chiffres (ex: 2025).')
      return
    }

    if (anneeNumerique < ANNEE_MIN_EXERCICE) {
      setErreur(`Les exercices commencent à partir de ${ANNEE_MIN_EXERCICE}.`)
      return
    }

    const clientCible = clients.find((c) => c.id === clientExerciceId)
    if (clientCible?.exercices.some((ex) => ex.annee === anneeNumerique)) {
      setErreur(`Le client ${clientCible.nom} possède déjà un exercice ${anneeNumerique}.`)
      return
    }

    setErreur('')
    setMessageSucces('')
    setChargementExercice(true)

    try {
      const { response, data } = await apiFetchJson('/exercices/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientExerciceId,
          annee: anneeNumerique,
          statut: statutExercice
        })
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Impossible de créer l’exercice')
      }

      await chargerClients(recherche, typeFiltre)
      setMessageSucces(`Exercice ${anneeNumerique} ajouté avec succès.`)
      fermerFormulaireExercice()
    } catch (error: any) {
      console.error('Erreur création exercice:', error)
      setErreur(error?.message || 'Impossible de créer l’exercice.')
    } finally {
      setChargementExercice(false)
    }
  }

  const ouvrirModaleSuppressionClient = (client: ClientAPI) => {
    setModaleSuppressionClient({ open: true, client })
  }

  const fermerModaleSuppressionClient = () => {
    setModaleSuppressionClient({ open: false, client: null })
  }

  const confirmerSuppressionClient = async () => {
    const { client } = modaleSuppressionClient
    if (!client) return

    setSuppressionEnCours(client.id)
    setErreur('')
    setMessageSucces('')

    try {
      const { response, data } = await apiFetchJson(`/clients/${client.id}/`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors de la suppression du client')
      }

      await chargerClients(recherche, typeFiltre)
      setMessageSucces((data as any)?.message || 'Client supprimé avec succès.')
      if (clientEdite?.id === client.id) {
        fermerFormulaire()
      }
    } catch (error: any) {
      console.error('Erreur suppression client:', error)
      setErreur(error?.message || 'Impossible de supprimer le client.')
    } finally {
      setSuppressionEnCours(null)
      fermerModaleSuppressionClient()
    }
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
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Gestion</p>
              <h1 className="text-3xl font-semibold text-theme-primary">Clients</h1>
              <p className="text-sm text-theme-secondary mt-1">{clientsFiltres.length} client{clientsFiltres.length > 1 ? 's' : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                reinitialiserFormulaire()
                setAfficherFormulaire(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <Icon name="plus" size="sm" />
              Nouveau client
            </button>
          </div>
        </motion.header>

        {erreur && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm"
          >
            {erreur}
          </motion.div>
        )}

        {messageSucces && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-sm"
          >
            {messageSucces}
          </motion.div>
        )}

        {/* Barre de filtres */}
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
            value={typeFiltre}
            onChange={(e) => setTypeFiltre(e.target.value as ClientType | '')}
            className="px-4 py-2.5 text-sm bg-theme-card border border-theme rounded-lg focus:border-blue-400 outline-none min-w-[160px]"
          >
            <option value="">Tous les types</option>
            {TYPES_CLIENT.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 w-full">
            {chargement ? (
              <div className="bg-theme-card border border-theme rounded-xl p-12 text-center text-theme-secondary text-sm">
                Chargement des clients...
              </div>
            ) : clientsFiltres.length === 0 ? (
              <div className="bg-theme-card border border-theme rounded-xl p-12 text-center text-theme-secondary text-sm">
                Aucun client ne correspond à votre recherche.
              </div>
            ) : (
              <div>
                {/* Pagination */}
                {clientsPagination.totalPages > 1 && (
                  <div className="mb-4 flex items-center justify-between text-xs text-theme-secondary">
                    <span>Page {clientsPagination.page}/{clientsPagination.totalPages}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPageClients((prev) => Math.max(1, prev - 1))}
                        disabled={clientsPagination.page <= 1}
                        className="px-2 py-1 rounded border border-theme hover:bg-theme-muted disabled:opacity-40"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => setPageClients((prev) => Math.min(clientsPagination.totalPages, prev + 1))}
                        disabled={clientsPagination.page >= clientsPagination.totalPages}
                        className="px-2 py-1 rounded border border-theme hover:bg-theme-muted disabled:opacity-40"
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {clientsPagination.items.map((client, index) => (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="bg-theme-card border border-theme rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-theme-primary text-sm truncate">{client.nom}</h3>
                          <p className="text-xs text-theme-secondary mt-0.5">
                            {client.numeroClient || '—'}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${client.type === 'ENTREPRISE' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600'}`}>
                          {client.type === 'ENTREPRISE' ? 'Entreprise' : 'Particulier'}
                        </span>
                      </div>

                      {client.type === 'PARTICULIER' && client.entrepriseNom && (
                        <p className="text-xs text-theme-secondary mb-2">→ {client.entrepriseNom}</p>
                      )}
                      {client.type === 'ENTREPRISE' && client.nombrePersonnesRattachees > 0 && (
                        <p className="text-xs text-theme-secondary mb-2">{client.nombrePersonnesRattachees} personne{client.nombrePersonnesRattachees > 1 ? 's' : ''}</p>
                      )}

                      <div className="flex items-center gap-1 pt-3 border-t border-theme">
                        <button
                          type="button"
                          onClick={() => ouvrirFormulaireExercice(client)}
                          className={`p-2 rounded-lg transition-colors ${clientExerciceId === client.id ? 'bg-theme-muted text-theme-primary' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                          title="Nouvel exercice"
                        >
                          <Icon name="calendar" size="sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => editerClient(client)}
                          className="p-2 text-theme-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => ouvrirModaleSuppressionClient(client)}
                          disabled={suppressionEnCours === client.id}
                          className="p-2 text-theme-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 ml-auto"
                          title="Supprimer"
                        >
                          <Icon name="trash" size="sm" />
                        </button>
                      </div>

                      {clientExerciceId === client.id && (
                        <motion.form
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 border border-green-100 rounded-2xl bg-green-50 p-4"
                          onSubmit={soumettreNouvelExercice}
                        >
                          <p className="text-sm text-green-800 mb-3 flex items-start gap-2">
                            <Icon name="info" size="xs" className="mt-0.5" />
                            {exerciceEdite ? (
                              <span>
                                Mettre à jour le statut de l’exercice <strong>{exerciceEdite.annee}</strong>. Sélectionnez le nouveau statut puis validez.
                              </span>
                            ) : (
                              <span>
                                Saisissez l’année fiscale (à partir de {ANNEE_MIN_EXERCICE}) et le statut souhaité. Les archivistes peuvent créer plusieurs années à l’avance.
                              </span>
                            )}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-green-900 mb-1">Année *</label>
                              <input
                                type="number"
                                min={ANNEE_MIN_EXERCICE}
                                value={anneeExercice}
                                readOnly={Boolean(exerciceEdite)}
                                disabled={Boolean(exerciceEdite)}
                                onChange={(e) => setAnneeExercice(e.target.value)}
                                className={`w-full px-4 py-2 border-2 rounded-xl text-sm ${exerciceEdite
                                  ? 'border-green-200 bg-green-100 text-green-900 cursor-not-allowed'
                                  : 'border-green-200 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                                  }`}
                                placeholder="2025"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-green-900 mb-1">Statut *</label>
                              <select
                                value={statutExercice}
                                onChange={(e) => setStatutExercice(e.target.value as StatutExercice)}
                                className="w-full px-4 py-2 border-2 border-green-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-sm"
                              >
                                {STATUTS_EXERCICE.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex justify-end gap-3 mt-4">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              type="button"
                              onClick={fermerFormulaireExercice}
                              className="px-4 py-2 bg-white text-gray-600 rounded-xl font-semibold hover:bg-gray-100"
                            >
                              Annuler
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              type="submit"
                              disabled={chargementExercice}
                              className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50"
                            >
                              {chargementExercice
                                ? exerciceEdite
                                  ? 'Mise à jour...'
                                  : 'Création...'
                                : exerciceEdite
                                  ? 'Mettre à jour le statut'
                                  : 'Ajouter cet exercice'}
                            </motion.button>
                          </div>
                        </motion.form>
                      )}

                      {client.email && (
                        <p className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                          <Icon name="email" size="xs" />
                          {client.email}
                        </p>
                      )}

                      {client.telephone && (
                        <p className="mt-1 text-sm text-gray-600 flex items-center gap-2">
                          <Icon name="phone" size="xs" />
                          {client.telephone}
                        </p>
                      )}

                      {client.adresse && (
                        <p className="mt-1 text-sm text-gray-600 flex items-start gap-2">
                          <Icon name="home" size="xs" className="mt-0.5" />
                          {client.adresse}
                        </p>
                      )}

                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                          <Icon name="calendar" size="xs" />
                          Exercices ({client.exercices.length})
                        </h4>
                        <button
                          type="button"
                          onClick={async () => {
                            const prochain = clientOuvertId === client.id ? null : client.id
                            setClientOuvertId(prochain)
                            if (prochain && !clientsExercicesCharges[client.id]) {
                              await chargerExercicesClient(client.id)
                            }
                          }}
                          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          <Icon
                            name="chevron-right"
                            size="xs"
                            className={`transform transition-transform ${clientOuvertId === client.id ? 'rotate-90' : ''
                              }`}
                          />
                          <span>
                            {clientOuvertId === client.id
                              ? 'Masquer les exercices'
                              : 'Afficher les exercices'}
                          </span>
                        </button>

                        {clientOuvertId === client.id && (
                          <>
                            {clientsExercicesChargement[client.id] && (
                              <p className="text-sm text-gray-500">Chargement des exercices...</p>
                            )}

                            {!clientsExercicesChargement[client.id] &&
                              clientsExercicesCharges[client.id] &&
                              client.exercices.length === 0 && (
                                <p className="text-sm text-gray-500">Aucun exercice pour le moment.</p>
                              )}

                            {!clientsExercicesChargement[client.id] && client.exercices.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {client.exercices.map((exercice) => (
                                  <button
                                    key={exercice.id}
                                    type="button"
                                    onClick={() => setModaleDetailExercice({ open: true, client, exercice })}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all hover:shadow-md hover:scale-105 ${exercice.statut === 'ACTIF'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                                      : exercice.statut === 'CLOTURE'
                                        ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                                        : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                                      }`}
                                  >
                                    <span className="font-bold">{exercice.annee}</span>
                                    <span className="text-[10px] opacity-70">({exercice.risques.length})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modale de création/modification client */}
      <FormModal
        isOpen={afficherFormulaire}
        onClose={fermerFormulaire}
        title={clientEdite ? 'Modifier le client' : 'Nouveau client'}
        isDark={isDark}
        size="md"
      >
        <form className="space-y-4" onSubmit={soumettreFormulaire}>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Nom *</label>
            <input
              type="text"
              value={formulaire.nom}
              onChange={(e) => setFormulaire((prev) => ({ ...prev, nom: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Numéro client</label>
              <input
                type="text"
                value={formulaire.numeroClient}
                onChange={(e) => setFormulaire((prev) => ({ ...prev, numeroClient: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Type *</label>
              <select
                value={formulaire.type}
                onChange={(e) => setFormulaire((prev) => ({ ...prev, type: e.target.value as ClientType }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                required
              >
                {TYPES_CLIENT.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {formulaire.type === 'PARTICULIER' && (
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Entreprise rattachée</label>
              <select
                value={formulaire.entrepriseId ?? ''}
                onChange={(e) => setFormulaire((prev) => ({ ...prev, entrepriseId: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
              >
                <option value="">Aucune</option>
                {entreprises.map((entreprise) => (
                  <option key={entreprise.id} value={entreprise.id}>{entreprise.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
              <input
                type="email"
                value={formulaire.email}
                onChange={(e) => setFormulaire((prev) => ({ ...prev, email: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Téléphone</label>
              <input
                type="text"
                value={formulaire.telephone}
                onChange={(e) => setFormulaire((prev) => ({ ...prev, telephone: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Adresse</label>
            <textarea
              value={formulaire.adresse}
              onChange={(e) => setFormulaire((prev) => ({ ...prev, adresse: e.target.value }))}
              rows={2}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none resize-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={fermerFormulaire}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={soumissionEnCours}
              className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {soumissionEnCours ? 'Enregistrement...' : clientEdite ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Modale de confirmation suppression client */}
      <ConfirmModal
        isOpen={modaleSuppressionClient.open}
        onClose={fermerModaleSuppressionClient}
        onConfirm={confirmerSuppressionClient}
        title="Supprimer le client"
        message={`Êtes-vous sûr de vouloir supprimer le client "${modaleSuppressionClient.client?.nom}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={suppressionEnCours === modaleSuppressionClient.client?.id}
        isDark={isDark}
      />

      {/* Modale de confirmation suppression exercice */}
      <ConfirmModal
        isOpen={modaleSuppressionExercice.open}
        onClose={fermerModaleSuppressionExercice}
        onConfirm={confirmerSuppressionExercice}
        title="Supprimer l'exercice"
        message={`Êtes-vous sûr de vouloir supprimer l'exercice ${modaleSuppressionExercice.exercice?.annee} pour ${modaleSuppressionExercice.client?.nom} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={suppressionExerciceEnCours === modaleSuppressionExercice.exercice?.id}
        isDark={isDark}
      />

      {/* Modale détail exercice */}
      <FormModal
        isOpen={modaleDetailExercice.open}
        onClose={() => {
          setModaleDetailExercice({ open: false, client: null, exercice: null })
          fermerFormulaireRisque()
          fermerFormulaireExercice()
        }}
        title={`Exercice ${modaleDetailExercice.exercice?.annee ?? ''}`}
        isDark={isDark}
        size="5xl"
      >

        {modaleDetailExercice.client && modaleDetailExercice.exercice && (
          <div className="flex">
            <div className="w-2/5 space-y-4 pr-4 border-r border-theme">
              {/* En-tête avec statut et actions */}
              <div className="flex items-center justify-between pb-3 border-b border-theme">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${modaleDetailExercice.exercice.statut === 'ACTIF'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : modaleDetailExercice.exercice.statut === 'CLOTURE'
                      ? 'bg-theme-muted text-theme-secondary'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                    {modaleDetailExercice.exercice.statut}
                  </span>
                  <span className="text-sm text-theme-secondary">
                    {modaleDetailExercice.exercice.risques.length} risque{modaleDetailExercice.exercice.risques.length > 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => ouvrirModaleSuppressionExercice(modaleDetailExercice.client!, modaleDetailExercice.exercice!)}
                  className="p-2 rounded-lg text-theme-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Supprimer l'exercice"
                >
                  <Icon name="trash" size="sm" />
                </button>
              </div>

              {/* Liste des risques */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-theme-primary">Risques</h4>
                {modaleDetailExercice.exercice.risques.length > 0 ? (
                  <div className="space-y-2 max-h-92 overflow-y-auto">
                    {modaleDetailExercice.exercice.risques.map((risque) => (
                      <div
                        key={risque.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-theme-muted"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-xs font-medium text-theme-primary">{risque.type}</span>
                          {risque.numeroPolice && (
                            <span className="text-xs text-theme-secondary">N° {risque.numeroPolice}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-theme-secondary text-center py-4">Aucun risque pour cet exercice</p>
                )}
              </div>
            </div>

            <div className="w-3/5 pl-4 space-y-4">
              {/* Formulaire modification statut - Toujours affiché */}
              <form onSubmit={soumettreNouvelExercice} className="p-4 bg-theme-muted rounded-lg border border-theme">
                <label className="block text-sm font-semibold text-theme-primary mb-3">Modifier le statut</label>
                <div className="flex gap-2">
                  <select
                    value={statutExercice}
                    onChange={(e) => setStatutExercice(e.target.value as StatutExercice)}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg bg-theme-card border-theme text-theme-primary"
                  >
                    {STATUTS_EXERCICE.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={chargementExercice} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {chargementExercice ? '...' : 'Valider'}
                  </button>
                </div>
              </form>

              {/* Formulaire ajout risque - Toujours affiché */}
              <form onSubmit={soumettreNouveauRisque} className="p-4 bg-theme-muted rounded-lg border border-theme space-y-3">
                <label className="block text-sm font-semibold text-theme-primary">Ajouter un risque</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-theme-secondary mb-1">Type de risque *</label>
                    <input
                      type="text"
                      value={risqueType}
                      onChange={(e) => setRisqueType(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-theme-card border-theme text-theme-primary"
                      placeholder="Ex: Automobile"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-theme-secondary mb-1">N° Police</label>
                    <input
                      type="text"
                      value={risqueNumero}
                      onChange={(e) => setRisqueNumero(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-theme-card border-theme text-theme-primary"
                      placeholder="Facultatif"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-2">Suggestions rapides</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS_RISQUES.slice(0, 12).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => toggleSuggestionRisque(suggestion)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${estDejaDansSelection(risquesSelectionnes, suggestion)
                          ? 'bg-red-600 text-white'
                          : 'bg-theme-card text-theme-primary hover:bg-red-50 dark:hover:bg-red-900/20 border border-theme'
                          }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {risquesSelectionnes.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-theme-card rounded border border-theme">
                    {risquesSelectionnes.map((r) => (
                      <span key={r.type} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">
                        {r.type}
                        <button type="button" onClick={() => retirerRisqueSelection(r.type)} className="hover:text-red-900 dark:hover:text-red-200">×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={chargementRisque}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {chargementRisque ? 'Ajout...' : 'Ajouter le risque'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}
      </FormModal>
    </div>
  )
}
