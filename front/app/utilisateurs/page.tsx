'use client'

import { Sidebar } from '@/components/Sidebar'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { apiFetchJson } from '@/lib/api'
import { hasPermission, canAccessSection } from '@/lib/permissions'
import { PreviewPDF } from '@/components/PreviewPDF'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useTheme } from '@/hooks/useTheme'
import { FormModal } from '@/components/ui/FormModal'

type UtilisateurAPI = {
  id: string
  nom: string
  prenom: string
  email: string | null
  role: string
  estActif: boolean
  derniereConnexion: string | null
  nomUtilisateur: string
}

type UtilisateurDRF = {
  id: string
  nom: string
  prenom: string
  email: string | null
  role: string
  est_actif: boolean
  derniere_connexion: string | null
  nom_utilisateur: string
}

type UtilisateurAffiche = UtilisateurAPI & {
  avatar: string
  couleur: string
  dernierAccesLibelle: string
}

type FormulaireUtilisateur = {
  id?: string
  nom: string
  prenom: string
  email: string
  role: string
  estActif: boolean
  nomUtilisateur: string
  motDePasse: string
}

const PALETTE = ['#D32027', '#0066B3', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1'] as const

function getInitiales(prenom: string | null, nom: string | null) {
  const parts = `${prenom ?? ''} ${nom ?? ''}`.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function mapUtilisateur(utilisateur: UtilisateurDRF): UtilisateurAPI {
  return {
    id: utilisateur.id,
    nom: utilisateur.nom,
    prenom: utilisateur.prenom,
    email: utilisateur.email,
    role: utilisateur.role,
    estActif: utilisateur.est_actif,
    derniereConnexion: utilisateur.derniere_connexion,
    nomUtilisateur: utilisateur.nom_utilisateur
  }
}

function formatRelativeDate(isoDate: string | null) {
  if (!isoDate) return 'Jamais connecté'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'Date inconnue'
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'À l’instant'
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`
  const diffHeures = Math.floor(diffMinutes / 60)
  if (diffHeures < 24) return `Il y a ${diffHeures} h`
  const diffJours = Math.floor(diffHeures / 24)
  if (diffJours < 30) return `Il y a ${diffJours} jour${diffJours > 1 ? 's' : ''}`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PageUtilisateurs() {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  useEnforceNonConsultant()
  const utilisateurCourant = useUtilisateurCourant()
  const role = utilisateurCourant?.role ?? null
  const peutVoirUtilisateurs = hasPermission(role, 'utilisateurs', 'voir')
  const peutGerersUtilisateurs =
    hasPermission(role, 'utilisateurs', 'creer') ||
    hasPermission(role, 'utilisateurs', 'modifier') ||
    hasPermission(role, 'utilisateurs', 'supprimer')
  const { isDark } = useTheme()

  const [recherche, setRecherche] = useState('')
  const [filtreRole, setFiltreRole] = useState('')
  const [pageUtilisateurs, setPageUtilisateurs] = useState(1)
  const UTILISATEURS_PAR_PAGE = 9
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurAPI[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [messageSucces, setMessageSucces] = useState('')
  const [utilisateurSelectionne, setUtilisateurSelectionne] = useState<UtilisateurAffiche | null>(null)
  const [formulaireUtilisateur, setFormulaireUtilisateur] = useState<FormulaireUtilisateur | null>(null)
  const [soumissionEnCours, setSoumissionEnCours] = useState(false)
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)
  const [voirMotDePasse, setVoirMotDePasse] = useState(false)

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

  async function chargerUtilisateurs(afficherLoader = true) {
    if (afficherLoader) {
      setChargement(true)
    }
    setErreur('')
    try {
      const { response, data } = await apiFetchJson('/utilisateurs/')
      if (!response.ok) {
        throw new Error((data as any)?.detail || 'Impossible de charger les utilisateurs')
      }

      const bruts: UtilisateurDRF[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.results)
          ? (data as any).results
          : []

      setUtilisateurs(bruts.map(mapUtilisateur))
    } catch (error: any) {
      console.error('Erreur chargement utilisateurs:', error)
      setErreur(error?.message || 'Erreur de connexion au serveur')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    if (!peutVoirUtilisateurs) {
      setChargement(false)
      setUtilisateurs([])
      return
    }
    chargerUtilisateurs()
  }, [peutVoirUtilisateurs])

  const roles = [
    { value: '', label: 'Tous les rôles', couleur: '#6B7280' },
    { value: 'ADMIN', label: 'Administrateur', couleur: '#D32027' },
    { value: 'ARCHIVISTE', label: 'Archiviste', couleur: '#0066B3' },
    { value: 'CONSULTANT', label: 'Consultant', couleur: '#F59E0B' },
  ]

  const utilisateursFiltres = useMemo(() => {
    const filtre = utilisateurs.filter((user) => {
      const rechercheLower = recherche.toLowerCase()
      const matchRecherche =
        user.nom.toLowerCase().includes(rechercheLower) ||
        user.prenom.toLowerCase().includes(rechercheLower) ||
        (user.email || '').toLowerCase().includes(rechercheLower)
      const matchRole = !filtreRole || user.role === filtreRole
      return matchRecherche && matchRole
    })

    return filtre.map((user, index) => ({
      ...user,
      avatar: getInitiales(user.prenom, user.nom),
      couleur: PALETTE[index % PALETTE.length],
      dernierAccesLibelle: formatRelativeDate(user.derniereConnexion)
    }))
  }, [utilisateurs, recherche, filtreRole])

  const utilisateursPagination = useMemo(() => {
    const total = utilisateursFiltres.length
    const totalPages = Math.max(1, Math.ceil(total / UTILISATEURS_PAR_PAGE))
    const page = Math.min(Math.max(1, pageUtilisateurs), totalPages)
    const start = (page - 1) * UTILISATEURS_PAR_PAGE
    const end = start + UTILISATEURS_PAR_PAGE
    const items = utilisateursFiltres.slice(start, end)
    return { items, total, page, totalPages }
  }, [utilisateursFiltres, pageUtilisateurs])

  // Réinitialiser la page lors du changement de filtres
  useEffect(() => {
    setPageUtilisateurs(1)
  }, [recherche, filtreRole])

  const getRoleInfo = (role: string) => roles.find(r => r.value === role) || roles[0]

  const stats = useMemo(() => ({
    total: utilisateurs.length,
    actifs: utilisateurs.filter(u => u.estActif).length,
    admins: utilisateurs.filter(u => u.role === 'ADMIN').length,
    archivistes: utilisateurs.filter(u => u.role === 'ARCHIVISTE').length,
    consultants: utilisateurs.filter(u => u.role === 'CONSULTANT').length,
  }), [utilisateurs])

  function ouvrirProfil(utilisateur: UtilisateurAffiche) {
    setUtilisateurSelectionne(utilisateur)
  }

  function fermerProfil() {
    setUtilisateurSelectionne(null)
  }

  function ouvrirEdition(utilisateur: UtilisateurAffiche) {
    if (!peutGerersUtilisateurs) return
    setAfficherFormulaire(true)
    setFormulaireUtilisateur({
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      email: utilisateur.email ?? '',
      role: utilisateur.role,
      estActif: utilisateur.estActif,
      nomUtilisateur: utilisateur.nomUtilisateur,
      motDePasse: ''
    })
  }

  function ouvrirCreation() {
    if (!peutGerersUtilisateurs) return
    setAfficherFormulaire(true)
    setFormulaireUtilisateur({
      nom: '',
      prenom: '',
      email: '',
      role: 'CONSULTANT',
      estActif: true,
      nomUtilisateur: '',
      motDePasse: ''
    })
    setErreur('')
    setMessageSucces('')
  }

  function fermerFormulaire() {
    setAfficherFormulaire(false)
    setFormulaireUtilisateur(null)
    setSoumissionEnCours(false)
  }

  function mettreAJourFormulaire<K extends keyof FormulaireUtilisateur>(champ: K, valeur: FormulaireUtilisateur[K]) {
    setFormulaireUtilisateur((courant) => {
      if (!courant) return courant
      return {
        ...courant,
        [champ]: valeur,
      }
    })
  }

  async function basculerActivation(utilisateur: UtilisateurAffiche) {
    if (!peutGerersUtilisateurs) return
    setActionEnCours(utilisateur.id)
    setErreur('')
    setMessageSucces('')
    try {
      const { response, data } = await apiFetchJson(`/utilisateurs/${utilisateur.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ est_actif: !utilisateur.estActif })
      })

      if (!response.ok || !data || typeof data !== 'object' || !('success' in data) || !(data as any).success) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Impossible de mettre à jour le statut')
      }

      await chargerUtilisateurs(false)
      setMessageSucces(`Utilisateur ${utilisateur.prenom} ${utilisateur.nom} ${utilisateur.estActif ? 'désactivé' : 'activé'}.`)
    } catch (error: any) {
      console.error('Erreur bascule statut utilisateur:', error)
      setErreur(error?.message || 'Erreur lors de la mise à jour du statut utilisateur')
    } finally {
      setActionEnCours(null)
    }
  }

  async function soumettreUtilisateur(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!peutGerersUtilisateurs) {
      setErreur("Vous n'avez pas la permission de modifier les utilisateurs.")
      return
    }
    if (!formulaireUtilisateur) return

    if (!formulaireUtilisateur.nom.trim() || !formulaireUtilisateur.prenom.trim()) {
      setErreur('Nom et prénom sont obligatoires.')
      return
    }

    if (!formulaireUtilisateur.nomUtilisateur.trim()) {
      setErreur("Le nom d’utilisateur est obligatoire.")
      return
    }

    setSoumissionEnCours(true)
    setErreur('')
    setMessageSucces('')

    const payload: Record<string, unknown> = {
      nom: formulaireUtilisateur.nom.trim(),
      prenom: formulaireUtilisateur.prenom.trim(),
      email: formulaireUtilisateur.email.trim() || null,
      role: formulaireUtilisateur.role,
      est_actif: formulaireUtilisateur.estActif,
      nom_utilisateur: formulaireUtilisateur.nomUtilisateur.trim()
    }

    const estEdition = Boolean(formulaireUtilisateur.id)
    const mdpSaisi = formulaireUtilisateur.motDePasse.trim()
    if (!estEdition) {
      if (!mdpSaisi || mdpSaisi.length < 8) {
        setSoumissionEnCours(false)
        setErreur('Le mot de passe doit contenir au moins 8 caractères.')
        return
      }
      payload.mot_de_passe = mdpSaisi
    } else if (mdpSaisi) {
      if (mdpSaisi.length < 8) {
        setSoumissionEnCours(false)
        setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.')
        return
      }
      payload.mot_de_passe = mdpSaisi
    }
    const url = estEdition ? `/utilisateurs/${formulaireUtilisateur.id}/` : '/utilisateurs/'
    const method = estEdition ? 'PUT' : 'POST'

    try {
      const { response, data } = await apiFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok || !data || typeof data !== 'object' || !('success' in data) || !(data as any).success) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || `Erreur lors ${estEdition ? 'de la mise à jour' : 'de la création'} de l’utilisateur`)
      }

      await chargerUtilisateurs(false)
      const utilisateurReponse = (data as any).utilisateur as UtilisateurDRF | undefined
      if (utilisateurReponse) {
        setMessageSucces(`Utilisateur ${utilisateurReponse.prenom} ${utilisateurReponse.nom} ${estEdition ? 'mis à jour' : 'créé'}.`)
      } else {
        setMessageSucces(`Utilisateur ${estEdition ? 'mis à jour' : 'créé'} avec succès.`)
      }

      fermerFormulaire()
    } catch (error: any) {
      console.error('Erreur soumission utilisateur:', error)
      setErreur(error?.message || 'Erreur lors de l’enregistrement de l’utilisateur')
    } finally {
      setSoumissionEnCours(false)
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

  if (!peutVoirUtilisateurs) {
    return (
      <div className="min-h-screen bg-theme-base text-theme-primary flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-auto flex flex-col items-center text-center gap-6">
          <div className="flex items-center gap-3 text-red-600">
            <Icon name="shield" size="lg" />
            <h1 className="text-3xl font-bold text-gray-900">Accès restreint</h1>
          </div>
          <p className="text-gray-600 max-w-xl">
            Vous n'avez pas la permission de consulter la gestion des utilisateurs. Veuillez contacter un administrateur si vous pensez qu'il s'agit d'une erreur.
          </p>
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
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Administration</p>
              <h1 className="text-3xl font-semibold text-theme-primary">Utilisateurs</h1>
              <p className="text-sm text-theme-secondary mt-1">{utilisateursFiltres.length} utilisateur{utilisateursFiltres.length > 1 ? 's' : ''} · {stats.actifs} actif{stats.actifs > 1 ? 's' : ''}</p>
            </div>
            {peutGerersUtilisateurs && (
              <button
                onClick={ouvrirCreation}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Icon name="plus" size="sm" />
                Nouveau
              </button>
            )}
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

        {/* Stats compactes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          <div className="bg-theme-card border border-theme rounded-xl p-4">
            <p className="text-2xl font-semibold text-red-600">{stats.admins}</p>
            <p className="text-xs text-theme-secondary">Admins</p>
          </div>
          <div className="bg-theme-card border border-theme rounded-xl p-4">
            <p className="text-2xl font-semibold text-blue-600">{stats.archivistes}</p>
            <p className="text-xs text-theme-secondary">Archivistes</p>
          </div>
          <div className="bg-theme-card border border-theme rounded-xl p-4">
            <p className="text-2xl font-semibold text-green-600">{stats.consultants}</p>
            <p className="text-xs text-theme-secondary">Consultants</p>
          </div>
          <div className="bg-theme-card border border-theme rounded-xl p-4">
            <p className="text-2xl font-semibold text-theme-primary">{stats.total}</p>
            <p className="text-xs text-theme-secondary">Total</p>
          </div>
        </motion.div>

        {/* Filtres */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
            value={filtreRole}
            onChange={(e) => setFiltreRole(e.target.value)}
            className="px-4 py-2.5 text-sm bg-theme-card border border-theme rounded-lg focus:border-blue-400 outline-none min-w-[160px]"
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </motion.div>


        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {utilisateursPagination.items.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.03 }}
              className="group bg-theme-card border border-theme rounded-xl overflow-hidden hover:shadow-lg hover:border-red-200 transition-all duration-300"
            >
              {/* Header avec avatar et statut */}
              <div className="relative p-5 pb-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm"
                    style={{ backgroundColor: user.couleur }}
                  >
                    {user.avatar}
                  </div>

                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-theme-primary truncate group-hover:text-red-600 transition-colors">
                        {user.prenom} {user.nom}
                      </h3>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${user.estActif ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                    <p className="text-sm text-theme-secondary truncate">@{user.nomUtilisateur}</p>
                  </div>

                  {/* Badge rôle */}
                  <span 
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-white flex-shrink-0"
                    style={{ backgroundColor: getRoleInfo(user.role).couleur }}
                  >
                    {getRoleInfo(user.role).label}
                  </span>
                </div>
              </div>

              {/* Détails */}
              <div className="px-5 pb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-theme-secondary">
                  <Icon name="at" size="xs" className="text-theme-secondary/60" />
                  <span className="truncate">{user.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-theme-secondary">
                  <Icon name="clock" size="xs" className="text-theme-secondary/60" />
                  <span>{user.dernierAccesLibelle}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-3 bg-theme-base/50 border-t border-theme flex items-center gap-2">
                <button
                  onClick={() => ouvrirProfil(user)}
                  className="flex-1 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-card rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icon name="eye" size="xs" />
                  Voir
                </button>
                {peutGerersUtilisateurs && (
                  <>
                    <button
                      onClick={() => ouvrirEdition(user)}
                      className="flex-1 py-2 text-sm font-medium text-theme-secondary hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Icon name="edit" size="xs" />
                      Modifier
                    </button>
                    <button
                      onClick={() => basculerActivation(user)}
                      disabled={actionEnCours === user.id}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                        user.estActif
                          ? 'text-theme-secondary hover:text-red-600 hover:bg-red-50'
                          : 'text-theme-secondary hover:text-green-600 hover:bg-green-50'
                      }`}
                    >
                      <Icon name={user.estActif ? 'close' : 'check'} size="xs" />
                      {user.estActif ? 'Désactiver' : 'Activer'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {utilisateurSelectionne && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Icon name="user" size="md" />
                    {utilisateurSelectionne.prenom} {utilisateurSelectionne.nom}
                  </h2>
                  <p className="text-sm text-gray-500">{getRoleInfo(utilisateurSelectionne.role).label}</p>
                </div>
                <button onClick={fermerProfil} className="text-gray-400 hover:text-gray-600">
                  <Icon name="close" size="sm" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="flex items-center gap-2 text-gray-700">
                  <Icon name="at" size="sm" />
                  <span>{utilisateurSelectionne.email || '—'}</span>
                </p>
                <p className="flex items-center gap-2 text-gray-700">
                  <Icon name="clock" size="sm" />
                  <span>Dernière connexion : {utilisateurSelectionne.dernierAccesLibelle}</span>
                </p>
                <p className="flex items-center gap-2 text-gray-700">
                  <Icon name={utilisateurSelectionne.estActif ? 'check' : 'close'} size="sm" />
                  <span>{utilisateurSelectionne.estActif ? 'Compte actif' : 'Compte désactivé'}</span>
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                {peutGerersUtilisateurs ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      fermerProfil()
                      ouvrirEdition(utilisateurSelectionne)
                    }}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition"
                  >
                    Modifier
                  </motion.button>
                ) : null}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={fermerProfil}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
                >
                  Fermer
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {utilisateursFiltres.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-2xl shadow-lg"
          >
            <Icon name="users" size="xl" className="mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-semibold text-gray-700 mb-2">Aucun utilisateur trouvé</p>
            <p className="text-gray-500">Modifiez vos filtres ou ajoutez un nouvel utilisateur</p>
          </motion.div>
        )}

        {/* Pagination */}
        {utilisateursPagination.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex items-center justify-between"
          >
            <p className="text-sm text-theme-secondary">
              Page {utilisateursPagination.page} sur {utilisateursPagination.totalPages} · {utilisateursPagination.total} utilisateur{utilisateursPagination.total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPageUtilisateurs(1)}
                disabled={utilisateursPagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ««
              </button>
              <button
                type="button"
                onClick={() => setPageUtilisateurs((prev) => Math.max(1, prev - 1))}
                disabled={utilisateursPagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-theme-primary">
                {utilisateursPagination.page}
              </span>
              <button
                type="button"
                onClick={() => setPageUtilisateurs((prev) => Math.min(utilisateursPagination.totalPages, prev + 1))}
                disabled={utilisateursPagination.page >= utilisateursPagination.totalPages}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => setPageUtilisateurs(utilisateursPagination.totalPages)}
                disabled={utilisateursPagination.page >= utilisateursPagination.totalPages}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                »»
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Modale de création/modification utilisateur */}
      {peutGerersUtilisateurs && formulaireUtilisateur && (
        <FormModal
          isOpen={afficherFormulaire}
          onClose={fermerFormulaire}
          title={formulaireUtilisateur.id ? 'Modifier un utilisateur' : 'Nouvel utilisateur'}
          isDark={isDark}
          size="lg"
        >
          <form onSubmit={soumettreUtilisateur} className="space-y-4">
            {erreur && (
              <div className={`rounded-lg px-4 py-3 text-sm ${isDark ? 'bg-red-900/30 border border-red-800 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {erreur}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Prénom</label>
                <input
                  type="text"
                  value={formulaireUtilisateur.prenom}
                  onChange={(event) => mettreAJourFormulaire('prenom', event.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  placeholder="Ex. Jeanne"
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Nom</label>
                <input
                  type="text"
                  value={formulaireUtilisateur.nom}
                  onChange={(event) => mettreAJourFormulaire('nom', event.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  placeholder="Ex. Martin"
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Adresse e-mail</label>
                <input
                  type="email"
                  value={formulaireUtilisateur.email}
                  onChange={(event) => mettreAJourFormulaire('email', event.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  placeholder="exemple@entreprise.fr"
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Nom d'utilisateur</label>
                <input
                  type="text"
                  value={formulaireUtilisateur.nomUtilisateur}
                  onChange={(event) => mettreAJourFormulaire('nomUtilisateur', event.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  placeholder="Identifiant de connexion"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Rôle</label>
                <select
                  value={formulaireUtilisateur.role}
                  onChange={(event) => mettreAJourFormulaire('role', event.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-blue-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  {roles
                    .filter((r) => r.value)
                    .map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                </select>
              </div>
              <label className={`flex items-center gap-3 px-3 py-2 border rounded-lg ${
                isDark ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <input
                  type="checkbox"
                  checked={formulaireUtilisateur.estActif}
                  onChange={(event) => mettreAJourFormulaire('estActif', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Compte actif</span>
              </label>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                {formulaireUtilisateur.id ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}
              </label>
              <div className="relative">
                <input
                  type={voirMotDePasse ? 'text' : 'password'}
                  value={formulaireUtilisateur.motDePasse}
                  onChange={(event) => mettreAJourFormulaire('motDePasse', event.target.value)}
                  className={`w-full px-3 py-2 pr-10 text-sm border rounded-lg focus:border-purple-400 outline-none ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  placeholder={formulaireUtilisateur.id ? "Laisser vide pour conserver l'actuel" : 'Minimum 8 caractères'}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setVoirMotDePasse((v) => !v)} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`} tabIndex={-1}>
                  <Icon name={voirMotDePasse ? 'eye-slash' : 'eye'} size="xs" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={fermerFormulaire}
                disabled={soumissionEnCours}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  isDark ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={soumissionEnCours}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {soumissionEnCours
                  ? 'Enregistrement...'
                  : formulaireUtilisateur.id
                    ? 'Mettre à jour'
                    : 'Créer l\'utilisateur'}
              </button>
            </div>
          </form>
        </FormModal>
      )}
    </div>
  )
}
