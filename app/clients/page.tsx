'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { apiFetchJson } from '@/lib/api'

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
  'Responsabilité civile',
  'Transport',
  'Voyage'
]

const FORMULAIRE_INITIAL: FormClient = {
  nom: '',
  numeroClient: '',
  type: 'ENTREPRISE',
  email: '',
  telephone: '',
  adresse: ''
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
    exercices: client.exercices ?? []
  }
}

export default function PageClients() {
  const [clients, setClients] = useState<ClientAPI[]>([])
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

      await chargerClients()
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

  const supprimerExercice = async (client: ClientAPI, exercice: ExerciceResume) => {
    const confirmation = window.confirm(`Supprimer l'exercice ${exercice.annee} pour ${client.nom} ?`)
    if (!confirmation) return

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

      await chargerClients()
      setMessageSucces((data as any)?.message || `Exercice ${exercice.annee} supprimé avec succès.`)
    } catch (error: any) {
      console.error('Erreur suppression exercice:', error)
      setErreur(error?.message || "Impossible de supprimer l'exercice.")
    } finally {
      setSuppressionExerciceEnCours(null)
    }
  }

  const chargerClients = async () => {
    setChargement(true)
    setErreur('')
    try {
      const { response, data } = await apiFetchJson('/clients/')
      if (!response.ok) {
        throw new Error((data as any)?.detail || 'Impossible de charger les clients')
      }
      const bruts: ClientDRF[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.results)
          ? (data as any).results
          : []

      setClients(bruts.map(mapClient))
    } catch (error: any) {
      console.error('Erreur chargement clients:', error)
      setErreur(error?.message || 'Erreur lors du chargement des clients')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    chargerClients()
  }, [])

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
      adresse: client.adresse ?? ''
    })
    setAfficherFormulaire(true)
  }

  const clientsFiltres = useMemo(() => {
    const rechercheMin = recherche.toLowerCase()
    return clients.filter((client) => {
      const matchTexte =
        client.nom.toLowerCase().includes(rechercheMin) ||
        (client.numeroClient ?? '').toLowerCase().includes(rechercheMin) ||
        (client.email ?? '').toLowerCase().includes(rechercheMin)
      const matchType = !typeFiltre || client.type === typeFiltre
      return matchTexte && matchType
    })
  }, [clients, recherche, typeFiltre])

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
      adresse: formulaire.adresse.trim() || null
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

      await chargerClients()
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

        await chargerClients()
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

      await chargerClients()
      setMessageSucces(`Exercice ${anneeNumerique} ajouté avec succès.`)
      fermerFormulaireExercice()
    } catch (error: any) {
      console.error('Erreur création exercice:', error)
      setErreur(error?.message || 'Impossible de créer l’exercice.')
    } finally {
      setChargementExercice(false)
    }
  }

  const supprimerClient = async (id: string) => {
    const client = clients.find((c) => c.id === id)
    if (!client) return

    const confirmation = window.confirm(`Supprimer le client "${client.nom}" ?`)
    if (!confirmation) return

    setSuppressionEnCours(id)
    setErreur('')
    setMessageSucces('')

    try {
      const { response, data } = await apiFetchJson(`/clients/${id}/`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors de la suppression du client')
      }

      await chargerClients()
      setMessageSucces((data as any)?.message || 'Client supprimé avec succès.')
      if (clientEdite?.id === id) {
        fermerFormulaire()
      }
    } catch (error: any) {
      console.error('Erreur suppression client:', error)
      setErreur(error?.message || 'Impossible de supprimer le client.')
    } finally {
      setSuppressionEnCours(null)
    }
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <Icon name="building" size="xl" className="text-red-600" />
                Clients
              </h1>
              <p className="text-gray-600">Gérez les clients et préparez vos téléversements de documents.</p>
            </div>
          </div>
        </motion.div>

        {erreur && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          >
            {erreur}
          </motion.div>
        )}

        {messageSucces && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700"
          >
            {messageSucces}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un client..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="search" className="text-gray-400" />
              </div>
            </div>

            <select
              value={typeFiltre}
              onChange={(e) => setTypeFiltre(e.target.value as ClientType | '')}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            >
              <option value="">Tous les types</option>
              {TYPES_CLIENT.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <div className="md:col-span-1 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  if (afficherFormulaire) {
                    fermerFormulaire()
                  } else {
                    reinitialiserFormulaire()
                    setAfficherFormulaire(true)
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <Icon name="plus" size="sm" />
                {afficherFormulaire ? 'Fermer le formulaire' : 'Nouveau client'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {afficherFormulaire && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-full lg:w-96 bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Icon name={clientEdite ? 'edit' : 'plus'} size="sm" />
                {clientEdite ? 'Modifier le client' : 'Nouveau client'}
              </h2>

              <form className="space-y-4" onSubmit={soumettreFormulaire}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom *</label>
                  <input
                    type="text"
                    value={formulaire.nom}
                    onChange={(e) => setFormulaire((prev) => ({ ...prev, nom: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Nom du client"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro client</label>
                  <input
                    type="text"
                    value={formulaire.numeroClient}
                    onChange={(e) => setFormulaire((prev) => ({ ...prev, numeroClient: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Référence interne (facultatif)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
                  <select
                    value={formulaire.type}
                    onChange={(e) => setFormulaire((prev) => ({ ...prev, type: e.target.value as ClientType }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    required
                  >
                    {TYPES_CLIENT.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formulaire.email}
                    onChange={(e) => setFormulaire((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="contact@exemple.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Téléphone</label>
                  <input
                    type="text"
                    value={formulaire.telephone}
                    onChange={(e) => setFormulaire((prev) => ({ ...prev, telephone: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="(+225) 00 00 00 00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse</label>
                  <textarea
                    value={formulaire.adresse}
                    onChange={(e) => setFormulaire((prev) => ({ ...prev, adresse: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Adresse complète"
                  />
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={soumissionEnCours}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-60"
                  >
                    {soumissionEnCours ? 'Enregistrement...' : clientEdite ? 'Mettre à jour' : 'Créer'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={fermerFormulaire}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Annuler
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 w-full"
          >
            {chargement ? (
              <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-500">
                Chargement des clients...
              </div>
            ) : clientsFiltres.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-500">
                Aucun client ne correspond à votre recherche.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {clientsFiltres.map((client) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                          <Icon name="building" size="sm" className="text-red-500" />
                          {client.nom}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {client.numeroClient ? `Réf. ${client.numeroClient}` : 'Aucune référence'}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-sm font-medium">
                          <Icon name={client.type === 'ENTREPRISE' ? 'building' : 'user'} size="xs" />
                          {client.type === 'ENTREPRISE' ? 'Entreprise' : 'Particulier'}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => ouvrirFormulaireExercice(client)}
                          className={`px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                            clientExerciceId === client.id
                              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          <Icon name="calendar" size="xs" />
                          {clientExerciceId === client.id ? 'Annuler' : 'Nouvel exercice'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => editerClient(client)}
                          className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <Icon name="edit" size="xs" />
                          Modifier
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => supprimerClient(client.id)}
                          disabled={suppressionEnCours === client.id}
                          className="px-3 py-2 rounded-lg bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-60"
                        >
                          <Icon name="trash" size="xs" />
                          {suppressionEnCours === client.id ? 'Suppression...' : 'Supprimer'}
                        </motion.button>
                      </div>
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
                              className={`w-full px-4 py-2 border-2 rounded-xl text-sm ${
                                exerciceEdite
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

                    {client.exercices.length > 0 ? (
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                          <Icon name="calendar" size="xs" />
                          Exercices ({client.exercices.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {client.exercices.map((exercice) => (
                            <div key={exercice.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                              <p className="font-semibold text-gray-800 flex items-center justify-between">
                                <span>{exercice.annee}</span>
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                                  {exercice.statut}
                                </span>
                              </p>
                              {exercice.risques.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-gray-600 text-xs">
                                  {exercice.risques.map((risque) => (
                                    <li key={risque.id} className="flex items-center gap-2">
                                      <Icon name="shield" size="xs" />
                                      <span>{risque.type}</span>
                                      {risque.numeroPolice && (
                                        <span className="text-gray-400">({risque.numeroPolice})</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-xs text-gray-400">Aucun risque associé</p>
                              )}

                              <div className="mt-3 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => ouvrirFormulaireRisque(client, exercice)}
                                    className={`w-full text-xs font-semibold px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                                      clientRisqueId === client.id && exerciceRisqueId === exercice.id
                                        ? 'border-green-400 bg-green-50 text-green-700'
                                        : 'border-green-200 text-green-600 hover:bg-green-50'
                                    }`}
                                  >
                                    <Icon name="plus" size="xs" />
                                    {clientRisqueId === client.id && exerciceRisqueId === exercice.id
                                      ? 'Annuler'
                                      : 'Nouveau risque'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => ouvrirEditionExercice(client, exercice)}
                                    className={`w-full text-xs font-semibold px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                                      exerciceEdite?.id === exercice.id && clientExerciceId === client.id
                                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                                        : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                                    }`}
                                  >
                                    <Icon name="edit" size="xs" />
                                    {exerciceEdite?.id === exercice.id && clientExerciceId === client.id
                                      ? 'Annuler l’édition'
                                      : 'Modifier le statut'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => supprimerExercice(client, exercice)}
                                    disabled={suppressionExerciceEnCours === exercice.id}
                                    className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                                  >
                                    <Icon name="trash" size="xs" />
                                    {suppressionExerciceEnCours === exercice.id ? 'Suppression...' : 'Supprimer exercice'}
                                  </button>
                                </div>

                                {clientRisqueId === client.id && exerciceRisqueId === exercice.id && (
                                  <form className="bg-white border border-green-100 rounded-xl p-3 space-y-3" onSubmit={soumettreNouveauRisque}>
                                    <div>
                                      <label className="block text-xs font-semibold text-green-900 mb-1">Type de risque *</label>
                                      <input
                                        type="text"
                                        value={risqueType}
                                        onChange={(e) => setRisqueType(e.target.value)}
                                        className="w-full px-3 py-2 border border-green-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 text-xs"
                                        placeholder="Ex: Automobile"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-xs font-semibold text-green-900 mb-1">Numéro de police</label>
                                      <input
                                        type="text"
                                        value={risqueNumero}
                                        onChange={(e) => setRisqueNumero(e.target.value)}
                                        className="w-full px-3 py-2 border border-green-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 text-xs"
                                        placeholder="Facultatif"
                                      />
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {SUGGESTIONS_RISQUES.map((suggestion) => (
                                        <button
                                          key={suggestion}
                                          type="button"
                                          onClick={() => toggleSuggestionRisque(suggestion)}
                                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                            estDejaDansSelection(risquesSelectionnes, suggestion)
                                              ? 'bg-green-600 text-white'
                                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                                          }`}
                                        >
                                          {suggestion}
                                        </button>
                                      ))}
                                    </div>

                                    {risquesSelectionnes.length > 0 && (
                                      <div className="border border-green-100 rounded-lg p-3 bg-green-50">
                                        <p className="text-xs font-semibold text-green-900 mb-2">Sélection en attente ({risquesSelectionnes.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                          {risquesSelectionnes.map((risque) => (
                                            <span
                                              key={`${risque.type}-${risque.numeroPolice ?? 'sans-numero'}`}
                                              className="inline-flex items-center gap-2 bg-white text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs"
                                            >
                                              <span>{risque.type}</span>
                                              {risque.numeroPolice && <span className="text-green-500">({risque.numeroPolice})</span>}
                                              <button
                                                type="button"
                                                onClick={() => retirerRisqueSelection(risque.type)}
                                                className="text-green-500 hover:text-green-700"
                                                aria-label={`Retirer ${risque.type}`}
                                              >
                                                ×
                                              </button>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex justify-between items-center gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => ajouterRisqueSelection()}
                                        className="text-xs font-semibold text-green-600 hover:text-green-700"
                                      >
                                        Ajouter à la sélection
                                      </button>
                                      <span className="text-[10px] text-gray-500">
                                        Vous pouvez sélectionner plusieurs risques avant de valider.
                                      </span>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                      <button
                                        type="button"
                                        onClick={fermerFormulaireRisque}
                                        className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                                      >
                                        Annuler
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={chargementRisque}
                                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-semibold rounded-lg shadow disabled:opacity-50"
                                      >
                                        {chargementRisque ? 'Enregistrement...' : 'Valider'}
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 border-t border-gray-100 pt-4 mt-4">
                        Aucun exercice pour le moment.
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
