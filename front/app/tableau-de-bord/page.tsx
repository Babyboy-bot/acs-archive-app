'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { StatsTempsReel } from '@/components/StatsTempsReel'
import { motion } from 'framer-motion'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { apiFetchJson } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { canAccessSection, hasPermission } from '@/lib/permissions'

type DocumentApi = {
  id: string
  titre: string
  cree_le: string
  reference?: string | null
  type_courrier: 'ACS_VERS_CLIENT' | 'ACS_VERS_COMPAGNIE'
  risque_detail?: {
    type: string
    exercice_info?: {
      client?: string
    }
  } | null
}

type RisqueApi = {
  id: string
  type: string
}

export default function DashboardUltraModerne() {
  useEnforceNonConsultant()
  const utilisateurCourant = useUtilisateurCourant()
  const role = utilisateurCourant?.role ?? null
  const peutVoirStats = hasPermission(role, 'stats', 'voir')
  const peutVoirDocuments = hasPermission(role, 'documents', 'voir')
  const peutCreerDocuments = hasPermission(role, 'documents', 'creer')
  const peutAccederRecherche = canAccessSection(role, 'documents')
  const peutAccederParametres = hasPermission(role, 'utilisateurs', 'voir')

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [documentsRecents, setDocumentsRecents] = useState<DocumentApi[]>([])
  const [risques, setRisques] = useState<{ name: string; value: number; color: string }[]>([])
  const [evolutionDocuments, setEvolutionDocuments] = useState<{ mois: string; ACS_Client: number; ACS_Compagnie: number }[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let ignore = false

    const chargerDonnees = async () => {
      setLoading(true)
      setErreur(null)

      try {
        const [documentsRes, risquesRes] = await Promise.all([
          apiFetchJson<{ count: number; results: DocumentApi[] }>('/documents/?page_size=200&ordering=-cree_le'),
          apiFetchJson<{ count: number; results: RisqueApi[] }>('/risques/?page_size=500'),
        ])

        if (ignore) return

        const docs = Array.isArray(documentsRes.data?.results) ? documentsRes.data!.results : []
        const risquesData = Array.isArray(risquesRes.data?.results) ? risquesRes.data!.results : []

        setDocumentsRecents(docs.slice(0, 4))

        // Agrégation risques par type
        const couleurs = ['#D32027', '#10B981', '#F59E0B', '#8B5CF6', '#0066B3', '#14B8A6', '#7C3AED']
        const regroupement = risquesData.reduce<Record<string, number>>((acc, risque) => {
          const cle = risque.type || 'INCONNU'
          acc[cle] = (acc[cle] ?? 0) + 1
          return acc
        }, {})

        const risquesFormats = Object.entries(regroupement).map(([type, valeur], index) => ({
          name: type.replace(/_/g, ' '),
          value: valeur,
          color: couleurs[index % couleurs.length],
        }))
        setRisques(risquesFormats)

        // Calcul évolution 12 derniers mois
        const maintenant = new Date()
        const moisRefs: { cle: string; label: string }[] = []
        for (let i = 11; i >= 0; i--) {
          const date = new Date(maintenant)
          date.setMonth(date.getMonth() - i)
          const cle = `${date.getFullYear()}-${date.getMonth()}`
          const label = date.toLocaleDateString('fr-FR', { month: 'short' })
          moisRefs.push({ cle, label: label.charAt(0).toUpperCase() + label.slice(1, 3) })
        }

        const evolutionMap = new Map<string, { ACS_Client: number; ACS_Compagnie: number }>()
        moisRefs.forEach(({ cle }) => {
          evolutionMap.set(cle, { ACS_Client: 0, ACS_Compagnie: 0 })
        })

        docs.forEach((doc) => {
          const date = doc.cree_le ? new Date(doc.cree_le) : null
          if (!date) return
          const cle = `${date.getFullYear()}-${date.getMonth()}`
          if (!evolutionMap.has(cle)) return
          const entree = evolutionMap.get(cle)!
          if (doc.type_courrier === 'ACS_VERS_CLIENT') {
            entree.ACS_Client += 1
          } else {
            entree.ACS_Compagnie += 1
          }
        })

        const evolution = moisRefs.map(({ cle, label }) => ({
          mois: label,
          ACS_Client: evolutionMap.get(cle)?.ACS_Client ?? 0,
          ACS_Compagnie: evolutionMap.get(cle)?.ACS_Compagnie ?? 0,
        }))

        setEvolutionDocuments(evolution)
      } catch (error) {
        console.error('Erreur chargement dashboard', error)
        if (!ignore) {
          setErreur("Impossible de charger les données du tableau de bord")
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    chargerDonnees()

    return () => {
      ignore = true
    }
  }, [])

  const documentsRecentsAffiches = useMemo(() => {
    return documentsRecents.map((doc) => ({
      id: doc.id,
      titre: doc.titre,
      client: doc.risque_detail?.exercice_info?.client ?? 'Client inconnu',
      risque: doc.risque_detail?.type ?? '—',
      date: doc.cree_le,
    }))
  }, [documentsRecents])

  if (!peutVoirStats) {
    return (
      <div className="min-h-screen bg-theme-base text-theme-primary">
        <Navigation />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center text-center gap-6">
          <div className="flex items-center gap-3 text-red-600">
            <Icon name="shield" size="lg" />
            <h1 className="text-3xl font-bold text-theme-primary">Accès restreint</h1>
          </div>
          <p className="text-theme-secondary max-w-xl">
            Ce tableau de bord est réservé aux administrateurs et archivistes. Veuillez contacter un administrateur si vous avez besoin d'un accès élargi.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Dashboard ACS Archive
          </h1>
          <p className="text-theme-secondary">Bienvenue ! Voici un aperçu de votre système d'archivage</p>
        </motion.div>

        {erreur ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erreur}
          </div>
        ) : loading ? (
          <div className="mb-6 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-blue-600">
            Chargement des dernières données...
          </div>
        ) : null}

        {/* Stats temps réel */}
        {peutVoirStats ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <StatsTempsReel intervalMs={5000} />
          </motion.div>
        ) : null}

        {/* Actions rapides */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-theme-card rounded-2xl shadow-lg p-6 mb-8"
        >
          <h2 className="text-xl font-bold text-theme-primary mb-4 flex items-center gap-2">
            <Icon name="bolt" className="text-red-600" />
            Actions Rapides
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {peutCreerDocuments ? (
              <Link href="/documents/nouveau">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-theme-muted transition-all border-2 border-transparent hover:border-red-200">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Icon name="upload" size="lg" />
                  </div>
                  <span className="font-medium text-theme-primary">Upload</span>
                </motion.button>
              </Link>
            ) : null}

            {peutAccederRecherche ? (
              <Link href="/recherche">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-theme-muted transition-all border-2 border-transparent hover:border-blue-200">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Icon name="search" size="lg" />
                  </div>
                  <span className="font-medium text-theme-primary">Recherche</span>
                </motion.button>
              </Link>
            ) : null}

            {peutAccederParametres ? (
              <Link href="/parametres">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-theme-muted transition-all border-2 border-transparent hover:border-green-200">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Icon name="settings" size="lg" />
                  </div>
                  <span className="font-medium text-theme-primary">Paramètres</span>
                </motion.button>
              </Link>
            ) : null}

            {peutAccederParametres ? (
              <Link href="/admin-llm">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-theme-muted transition-all border-2 border-transparent hover:border-purple-200">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Icon name="sparkles" size="lg" />
                  </div>
                  <span className="font-medium text-theme-primary">Stats LLM</span>
                </motion.button>
              </Link>
            ) : null}

            {!peutCreerDocuments && !peutAccederRecherche && !peutAccederParametres ? (
              <div className="col-span-full text-sm text-gray-500">
                Aucune action rapide disponible avec votre rôle actuel.
              </div>
            ) : null}
          </div>
        </motion.div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-theme-card rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-bold text-theme-primary mb-4 flex items-center gap-2">
              <Icon name="chart" className="text-red-600" />
              Évolution des Documents
            </h3>
            {mounted && evolutionDocuments.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={evolutionDocuments}>
                  <defs>
                    <linearGradient id="colorClient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D32027" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#D32027" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCompagnie" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066B3" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0066B3" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mois" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="ACS_Client" stroke="#D32027" fillOpacity={1} fill="url(#colorClient)" />
                  <Area type="monotone" dataKey="ACS_Compagnie" stroke="#0066B3" fillOpacity={1} fill="url(#colorCompagnie)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-theme-secondary">Aucune donnée disponible pour le moment.</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-theme-card rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-bold text-theme-primary mb-4 flex items-center gap-2">
              <Icon name="shield" className="text-blue-600" />
              Répartition par Risques
            </h3>
            {mounted && risques.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={risques}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {risques.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-theme-secondary">Aucune donnée de risque disponible.</p>
            )}
          </motion.div>
        </div>

        {/* Documents récents */}
        <div className="grid grid-cols-1 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-theme-card rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-lg font-bold text-theme-primary mb-4 flex items-center gap-2">
              <Icon name="document" className="text-red-600" />
              Documents Récents
            </h3>
            {documentsRecentsAffiches.length > 0 ? (
              <div className="space-y-3">
                {documentsRecentsAffiches.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    whileHover={{ x: 5 }}
                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-theme-muted cursor-pointer transition-all border border-transparent hover:border-theme"
                  >
                    <div className="w-12 h-12 bg-theme-muted rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon name="document-solid" className="text-theme-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-theme-primary truncate">{doc.titre}</p>
                      <p className="text-sm text-theme-secondary">{doc.client} • {doc.risque}</p>
                    </div>
                    <div className="text-xs text-theme-secondary">
                      {formatDistanceToNow(new Date(doc.date), { addSuffix: true, locale: fr })}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-theme-secondary">Aucun document récent trouvé.</p>
            )}
            <Link href="/documents">
              <motion.button whileHover={{ x: 5 }} className="mt-4 w-full text-center py-3 text-red-600 font-medium hover:bg-theme-muted rounded-xl transition-colors flex items-center justify-center gap-2">
                Voir tous les documents
                <Icon name="arrow-right" size="sm" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
