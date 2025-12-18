'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'

// Composants
import { Sidebar, Icon, StatsTempsReel } from '@/components'
import { AuthLoadingScreen, AccessDenied, PageHeader } from '@/components/common'

// Hooks
import { useUtilisateurCourant, useEnforceNonConsultant, useRequireAuth } from '@/hooks'

// Lib
import { apiFetchJson, canAccessSection, hasPermission, formatDateRelative } from '@/lib'

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
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
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
    // Ne pas charger les données si pas authentifié
    if (!estAuthentifie) return
    
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
  }, [estAuthentifie])

  const documentsRecentsAffiches = useMemo(() => {
    return documentsRecents.map((doc) => ({
      id: doc.id,
      titre: doc.titre,
      client: doc.risque_detail?.exercice_info?.client ?? 'Client inconnu',
      risque: doc.risque_detail?.type ?? '—',
      date: doc.cree_le,
    }))
  }, [documentsRecents])

  // Attendre la vérification d'authentification (après tous les hooks)
  if (authChargement || !estAuthentifie) {
    return <AuthLoadingScreen />
  }

  if (!peutVoirStats) {
    return (
      <div className="min-h-screen bg-theme-base text-theme-primary flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <AccessDenied 
            title="Accès restreint"
            description="Ce tableau de bord est réservé aux administrateurs et archivistes. Veuillez contacter un administrateur si vous avez besoin d'un accès élargi."
          />
        </main>
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
          className="mb-10"
        >
          <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Vue d'ensemble</p>
          <h1 className="text-3xl font-semibold text-theme-primary">
            Tableau de bord
          </h1>
        </motion.header>

        {erreur && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm"
          >
            {erreur}
          </motion.div>
        )}

        {loading && !erreur && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 flex items-center gap-3 text-theme-secondary text-sm"
          >
            <div className="w-4 h-4 border-2 border-theme-secondary border-t-transparent rounded-full animate-spin" />
            Chargement...
          </motion.div>
        )}

        {/* Stats temps réel */}
        {peutVoirStats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10"
          >
            <StatsTempsReel intervalMs={5000} />
          </motion.div>
        )}

        {/* Actions rapides - Style minimaliste */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-10"
        >
          <h2 className="text-xs font-semibold text-theme-secondary uppercase tracking-wider mb-4">Actions rapides</h2>
          <div className="flex flex-wrap gap-3">
            {peutCreerDocuments && (
              <Link href="/documents/nouveau">
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-theme-card border border-theme rounded-lg text-sm font-medium text-theme-primary hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                >
                  <Icon name="upload" size="sm" className="text-red-500" />
                  Nouveau document
                </motion.button>
              </Link>
            )}

            {peutAccederRecherche && (
              <Link href="/recherche">
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-theme-card border border-theme rounded-lg text-sm font-medium text-theme-primary hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                >
                  <Icon name="search" size="sm" className="text-blue-500" />
                  Rechercher
                </motion.button>
              </Link>
            )}

            {peutAccederParametres && (
              <Link href="/parametres">
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-theme-card border border-theme rounded-lg text-sm font-medium text-theme-primary hover:border-gray-400 transition-all"
                >
                  <Icon name="settings" size="sm" className="text-theme-secondary" />
                  Paramètres
                </motion.button>
              </Link>
            )}
          </div>
        </motion.section>

        {/* Graphiques - Design épuré */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-theme-card border border-theme rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-theme-primary">Évolution mensuelle</h3>
              <span className="text-xs text-theme-secondary">12 derniers mois</span>
            </div>
            {mounted && evolutionDocuments.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={evolutionDocuments}>
                  <defs>
                    <linearGradient id="colorClient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D32027" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#D32027" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCompagnie" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0066B3" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#0066B3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="mois" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                  />
                  <Area type="monotone" dataKey="ACS_Client" stroke="#D32027" strokeWidth={2} fillOpacity={1} fill="url(#colorClient)" name="Vers Client" />
                  <Area type="monotone" dataKey="ACS_Compagnie" stroke="#0066B3" strokeWidth={2} fillOpacity={1} fill="url(#colorCompagnie)" name="Vers Compagnie" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-theme-secondary">
                Aucune donnée disponible
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-theme-card border border-theme rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-theme-primary">Répartition par risques</h3>
              <span className="text-xs text-theme-secondary">{risques.length} types</span>
            </div>
            {mounted && risques.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={risques}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => `${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={100}
                    paddingAngle={0}
                    dataKey="value"
                  >
                    {risques.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-theme-secondary">
                Aucune donnée disponible
              </div>
            )}
            {/* Légende compacte */}
            {risques.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4">
                {risques.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-theme-secondary">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Documents récents - Liste épurée */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-theme-card border border-theme rounded-xl"
        >
          <div className="flex items-center justify-between p-5 border-b border-theme">
            <h3 className="text-sm font-semibold text-theme-primary">Documents récents</h3>
            <Link href="/documents" className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">
              Voir tout
            </Link>
          </div>
          
          {documentsRecentsAffiches.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {documentsRecentsAffiches.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 + index * 0.05 }}
                  className="flex items-center gap-4 p-4 hover:bg-theme-muted/50 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 bg-theme-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="document" size="sm" className="text-theme-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate">{doc.titre}</p>
                    <p className="text-xs text-theme-secondary mt-0.5">{doc.client} · {doc.risque}</p>
                  </div>
                  <span className="text-xs text-theme-secondary whitespace-nowrap">
                    {formatDateRelative(doc.date)}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-theme-secondary">
              Aucun document récent
            </div>
          )}
        </motion.section>
      </main>
    </div>
  )
}
