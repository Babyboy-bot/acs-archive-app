'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { apiFetchJson } from '@/lib/api'
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

type DocumentApi = {
  id: string
  titre: string
  reference?: string | null
  type_courrier: 'ACS_VERS_CLIENT' | 'ACS_VERS_COMPAGNIE'
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
  const [anneeMaxDisponible, setAnneeMaxDisponible] = useState<number | null>(null)

  const typesCourrier = useMemo(() => ([
    { value: '', label: 'Tous les courriers' },
    { value: 'ACS_VERS_CLIENT', label: 'ACS → Client' },
    { value: 'ACS_VERS_COMPAGNIE', label: 'ACS → Compagnie' },
  ]), [])

  const couleurParRisque: Record<string, string> = useMemo(() => ({
    AUTOMOBILE: '#D32027',
    SANTE: '#10B981',
    HABITATION: '#F59E0B',
    VIE: '#8B5CF6',
    RESPONSABILITE_CIVILE: '#0066B3',
    MRP: '#9333EA',
    TRANSPORT: '#0EA5E9',
  }), [])

  const labelRisque = (type?: string | null) => {
    if (!type) return 'Risque inconnu'
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const couleurRisque = (type?: string | null) => {
    const cle = (type || '').toUpperCase()
    return couleurParRisque[cle] ?? '#6B7280'
  }

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
      const { data, response } = await apiFetchJson<{ results?: DocumentApi[] }>('/documents/?page_size=400&ordering=-cree_le')
      if (!response.ok) {
        throw new Error('Réponse invalide de l’API documents')
      }

      const docs = Array.isArray(data?.results) ? data!.results : []

      const filtrerTexte = (source?: string | null, valeur?: string) => {
        if (!valeur) return true
        if (!source) return false
        return source.toLowerCase().includes(valeur.toLowerCase())
      }

      const resultatFiltre = docs.filter((doc) => {
        const info = doc.risque_detail?.exercice_info
        const clientDoc = info?.client ?? ''
        const anneeDoc = info?.annee ? String(info.annee) : ''
        const risqueDoc = (doc.risque_detail?.type ?? '').toUpperCase()
        const typeCourrierDoc = doc.type_courrier ?? ''

        const matchClient = filtrerTexte(clientDoc, client)
        const matchExercice = exercice ? anneeDoc === exercice : true
        const matchRisque = risque ? risqueDoc === risque.toUpperCase() : true
        const matchTypeCourrier = typeCourrier ? typeCourrierDoc === typeCourrier : true
        return matchClient && matchExercice && matchRisque && matchTypeCourrier
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

  const reinitialiser = () => {
    setClient('')
    setExercice('')
    setRisque('')
    setTypeCourrier('')
    setAfficherResultats(false)
    setResultats([])
    setErreur(null)
  }

  const resultatsAffiches = useMemo(() => {
    return resultats.map((doc) => {
      const info = doc.risque_detail?.exercice_info
      const risqueType = (doc.risque_detail?.type ?? '').toUpperCase()
      const dateDocument = doc.date_document || doc.cree_le
      const taille = typeof doc.taille_fichier === 'number' ? doc.taille_fichier : undefined

      return {
        id: doc.id,
        chemin: [info?.client, info?.annee, doc.risque_detail?.type ?? '', doc.type_courrier === 'ACS_VERS_CLIENT' ? 'ACS→Client' : 'ACS→Compagnie']
          .filter(Boolean)
          .join(' / '),
        titre: doc.titre,
        client: info?.client ?? 'Client inconnu',
        risque: risqueType,
        reference: doc.reference ?? 'Référence inconnue',
        date: dateDocument ? format(new Date(dateDocument), 'yyyy-MM-dd', { locale: fr }) : 'Date inconnue',
        taille: taille ? formatTaille(taille) : '—',
        couleur: couleurRisque(risqueType),
        risqueLabel: labelRisque(risqueType),
        creeIlYA: dateDocument ? formatDistanceToNow(new Date(dateDocument), { addSuffix: true, locale: fr }) : null,
      }
    })
  }, [resultats, couleurParRisque])

  const typesRisque = useMemo(() => {
    const typesNorm = typesRisqueDisponibles.map((type) => type.toUpperCase())
    return [''].concat(typesNorm.length > 0 ? typesNorm : ['AUTOMOBILE', 'SANTE', 'HABITATION', 'VIE', 'RESPONSABILITE_CIVILE'])
  }, [typesRisqueDisponibles])

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
                {(exercicesDisponibles.length > 0 ? exercicesDisponibles : anneesFallback()).map((annee) => (
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
                {typesRisque.map((type) => (
                  <motion.button
                    key={type || 'tous'}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRisque(type)}
                    className={`py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      risque === type
                        ? 'text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={risque === type ? { backgroundColor: couleurRisque(type) } : {}}
                  >
                    <Icon name="shield" size="sm" />
                    {type ? labelRisque(type) : 'Tous les risques'}
                  </motion.button>
                ))}
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
              <div className="grid md:grid-cols-2 gap-4">
                {typesCourrier.slice(1).map((type) => (
                  <motion.button
                    key={type.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTypeCourrier(type.value)}
                    className={`py-4 px-6 rounded-xl font-medium transition-all text-left flex items-center gap-2 ${
                      typeCourrier === type.value
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon name="email" size="sm" />
                    {type.label}
                  </motion.button>
                ))}
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
                            className="px-4 py-2 rounded-full font-semibold text-white text-sm flex items-center gap-2"
                            style={{ backgroundColor: doc.couleur }}
                          >
                            <Icon name="shield" size="xs" />
                            {doc.risqueLabel}
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
                          title="Voir"
                        >
                          <Icon name="eye" size="md" />
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          className="p-3 hover:bg-blue-100 rounded-xl transition-colors" 
                          title="Télécharger"
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
