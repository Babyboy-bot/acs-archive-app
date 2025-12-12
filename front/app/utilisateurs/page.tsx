'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { apiFetchJson } from '@/lib/api'
import { hasPermission, canAccessSection } from '@/lib/permissions'
import { PreviewPDF } from '@/components/PreviewPDF'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'

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
  useEnforceNonConsultant()
  const utilisateurCourant = useUtilisateurCourant()
  const role = utilisateurCourant?.role ?? null
  const peutVoirUtilisateurs = hasPermission(role, 'utilisateurs', 'voir')
  const peutGerersUtilisateurs =
    hasPermission(role, 'utilisateurs', 'creer') ||
    hasPermission(role, 'utilisateurs', 'modifier') ||
    hasPermission(role, 'utilisateurs', 'supprimer')

  const [recherche, setRecherche] = useState('')
  const [filtreRole, setFiltreRole] = useState('')
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurAPI[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [messageSucces, setMessageSucces] = useState('')
  const [utilisateurSelectionne, setUtilisateurSelectionne] = useState<UtilisateurAffiche | null>(null)
  const [formulaireUtilisateur, setFormulaireUtilisateur] = useState<FormulaireUtilisateur | null>(null)
  const [soumissionEnCours, setSoumissionEnCours] = useState(false)
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)

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
    if (!estEdition) {
      if (!formulaireUtilisateur.motDePasse || formulaireUtilisateur.motDePasse.trim().length < 8) {
        setSoumissionEnCours(false)
        setErreur('Le mot de passe doit contenir au moins 8 caractères.')
        return
      }
      payload.mot_de_passe = formulaireUtilisateur.motDePasse.trim()
    }
    const url = estEdition ? `/utilisateurs/${formulaireUtilisateur.id}/` : '/utilisateurs/'
    const method = estEdition ? 'PUT' : 'POST'

    try {
      const { response, data } = await apiFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        let msg = ''
        if (data && typeof data === 'object') {
          msg = Object.entries(data as any)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n')
        } else {
          msg = (data as any)?.erreur || (data as any)?.detail || ''
        }
        console.error('Erreur API création/mise à jour utilisateur:', data)
        setErreur(msg || `Erreur HTTP ${response.status}`)
        return
      }

      if (!data || typeof data !== 'object' || !('success' in data) || !(data as any).success) {
        const msg =
          (data as any)?.erreur ||
          (data as any)?.detail ||
          `Réponse inattendue lors ${estEdition ? 'de la mise à jour' : 'de la création'} de l’utilisateur`
        console.error('Réponse inattendue API utilisateurs:', data)
        setErreur(msg)
        return
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
      console.error('Erreur réseau ou inattendue lors de la soumission utilisateur:', error)
      setErreur(error?.message || 'Erreur de connexion au serveur')
    } finally {
      setSoumissionEnCours(false)
    }
  }

  if (!peutVoirUtilisateurs) {
    return (
      <div className="min-h-screen bg-theme-base text-theme-primary">
        <Navigation />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center text-center gap-6">
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
    <div className="min-h-screen bg-theme-base text-theme-primary">
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
                <Icon name="users" size="xl" className="text-red-600" />
                Utilisateurs
              </h1>
              <p className="text-gray-600">{utilisateursFiltres.length} utilisateur{utilisateursFiltres.length > 1 ? 's' : ''} • {stats.actifs} actif{stats.actifs > 1 ? 's' : ''}</p>
            </div>
            {peutGerersUtilisateurs ? (
              <button
                onClick={ouvrirCreation}
                className="px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <Icon name="user" size="sm" />
                Nouvel utilisateur
              </button>
            ) : null}
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
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="star" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.admins}</p>
            <p className="text-sm opacity-90">Administrateurs</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="shield" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.archivistes}</p>
            <p className="text-sm opacity-90">Archivistes</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="users" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.consultants}</p>
            <p className="text-sm opacity-90">Consultants</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="users" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm opacity-90">Total</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher par nom, prénom, email..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="search" className="text-gray-400" />
              </div>
            </div>

            <select
              value={filtreRole}
              onChange={(e) => setFiltreRole(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {peutGerersUtilisateurs && afficherFormulaire && formulaireUtilisateur ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 bg-white rounded-2xl shadow-lg border border-red-100"
          >
            <form onSubmit={soumettreUtilisateur} className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Icon name="user" size="md" />
                    {formulaireUtilisateur.id ? 'Modifier un utilisateur' : 'Nouvel utilisateur'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {formulaireUtilisateur.id
                      ? 'Mettre à jour les informations du compte sélectionné.'
                      : 'Renseignez les informations du consultant à créer.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fermerFormulaire}
                  className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Annuler
                </button>
              </div>

              {erreur && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {erreur}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={formulaireUtilisateur.prenom}
                    onChange={(event) => mettreAJourFormulaire('prenom', event.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none"
                    placeholder="Ex. Jeanne"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom</label>
                  <input
                    type="text"
                    value={formulaireUtilisateur.nom}
                    onChange={(event) => mettreAJourFormulaire('nom', event.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none"
                    placeholder="Ex. Martin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse e-mail</label>
                  <input
                    type="email"
                    value={formulaireUtilisateur.email}
                    onChange={(event) => mettreAJourFormulaire('email', event.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    placeholder="exemple@entreprise.fr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom d’utilisateur</label>
                  <input
                    type="text"
                    value={formulaireUtilisateur.nomUtilisateur}
                    onChange={(event) => mettreAJourFormulaire('nomUtilisateur', event.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    placeholder="Identifiant de connexion"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rôle</label>
                  <select
                    value={formulaireUtilisateur.role}
                    onChange={(event) => mettreAJourFormulaire('role', event.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    {roles
                      .filter((role) => role.value)
                      .map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                  </select>
                </div>
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formulaireUtilisateur.estActif}
                    onChange={(event) => mettreAJourFormulaire('estActif', event.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Compte actif</span>
                </label>
              </div>

              {!formulaireUtilisateur.id ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mot de passe</label>
                  <input
                    type="password"
                    value={formulaireUtilisateur.motDePasse}
                    onChange={(event) => mettreAJourFormulaire('motDePasse', event.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                    placeholder="Minimum 8 caractères"
                    autoComplete="new-password"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nouveau mot de passe (optionnel)</label>
                  <input
                    type="password"
                    value={formulaireUtilisateur.motDePasse}
                    onChange={(event) => mettreAJourFormulaire('motDePasse', event.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                    placeholder="Laisser vide pour conserver l’actuel"
                    autoComplete="new-password"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={fermerFormulaire}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
                  disabled={soumissionEnCours}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={soumissionEnCours}
                  className="px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-60"
                >
                  {soumissionEnCours
                    ? 'Enregistrement...'
                    : formulaireUtilisateur.id
                      ? 'Mettre à jour'
                      : 'Créer l’utilisateur'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {utilisateursFiltres.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0"
                    style={{ backgroundColor: user.couleur }}
                  >
                    {user.avatar}
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-red-600 transition-colors">
                        {user.prenom} {user.nom}
                      </h3>
                      {user.estActif ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                          <Icon name="check" size="xs" />
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                      <Icon name="at" size="xs" />
                      {user.email}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: getRoleInfo(user.role).couleur }}
                      >
                        {getRoleInfo(user.role).label}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Icon name="clock" size="xs" />
                        {user.dernierAccesLibelle}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => ouvrirProfil(user)}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1"
                  >
                    <Icon name="eye" size="sm" />
                    Profil
                  </motion.button>
                  {peutGerersUtilisateurs ? (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => ouvrirEdition(user)}
                        className="flex-1 py-2 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                      >
                        Modifier
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => basculerActivation(user)}
                        disabled={actionEnCours === user.id}
                        className={`flex-1 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                          user.estActif
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        <Icon name={user.estActif ? 'user' : 'check'} size="sm" />
                        {user.estActif ? 'Désactiver' : 'Activer'}
                      </motion.button>
                    </>
                  ) : null}
                </div>
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
      </main>
    </div>
  )
}
