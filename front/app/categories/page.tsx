'use client'

import { Sidebar } from '@/components/Sidebar'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchJson } from '@/lib/api'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useTheme } from '@/hooks/useTheme'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FormModal } from '@/components/ui/FormModal'

type CategorieDRF = {
  id: string
  nom: string
  description: string | null
  couleur: string
  cree_le: string
  modifie_le: string
  nombreDocuments?: number
}

type Categorie = {
  id: string
  nom: string
  description: string | null
  couleur: string
  creeLe: string
  modifieLe: string
  nombreDocuments: number
}

function mapCategorie(categorie: CategorieDRF): Categorie {
  return {
    id: categorie.id,
    nom: categorie.nom,
    description: categorie.description,
    couleur: categorie.couleur,
    creeLe: categorie.cree_le,
    modifieLe: categorie.modifie_le,
    nombreDocuments: categorie.nombreDocuments ?? 0
  }
}

export default function PageCategories() {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  useEnforceNonConsultant()
  const { isDark } = useTheme()

  const [recherche, setRecherche] = useState('')
  const [pageCategories, setPageCategories] = useState(1)
  const CATEGORIES_PAR_PAGE = 9
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleCouleur, setNouvelleCouleur] = useState('#D32027')
  const [nouvelleDescription, setNouvelleDescription] = useState('')
  const [categories, setCategories] = useState<Categorie[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false)
  const [categorieEnEdition, setCategorieEnEdition] = useState<Categorie | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null)

  // État pour la modale de confirmation
  const [modaleSuppressionCategorie, setModaleSuppressionCategorie] = useState<{ open: boolean; categorie: Categorie | null }>({
    open: false,
    categorie: null
  })

  const formulaireRef = useRef<HTMLFormElement | null>(null)
  const estEdition = Boolean(categorieEnEdition)

  const texteBoutonPrincipal = afficherFormulaire
    ? estEdition
      ? 'Annuler la modification'
      : 'Annuler'
    : 'Nouvelle catégorie'
  const iconeBoutonPrincipal = afficherFormulaire ? 'close' : 'plus'
  const titreFormulaire = estEdition ? 'Modifier une catégorie' : 'Nouvelle Catégorie'
  const texteBoutonSoumission = enregistrementEnCours
    ? estEdition
      ? 'Enregistrement...'
      : 'Création...'
    : estEdition
      ? 'Enregistrer les modifications'
      : 'Créer la catégorie'

  function reinitialiserChamps() {
    setNouveauNom('')
    setNouvelleDescription('')
    setNouvelleCouleur('#D32027')
  }

  function fermerFormulaire() {
    setAfficherFormulaire(false)
    setCategorieEnEdition(null)
    reinitialiserChamps()
  }

  function ouvrirFormulaireCreation() {
    setErreur(null)
    setMessageSucces(null)
    setCategorieEnEdition(null)
    reinitialiserChamps()
    setAfficherFormulaire(true)
  }

  function preparerEdition(categorie: Categorie) {
    setErreur(null)
    setMessageSucces(null)
    setCategorieEnEdition(categorie)
    setNouveauNom(categorie.nom)
    setNouvelleDescription(categorie.description ?? '')
    setNouvelleCouleur(categorie.couleur)
    setAfficherFormulaire(true)
  }

  async function chargerCategories(showLoader = true) {
    if (showLoader) {
      setChargement(true)
    }
    setErreur(null)
    try {
      const { response, data } = await apiFetchJson('/categories/')
      if (!response.ok) {
        throw new Error((data as any)?.detail || 'Erreur lors du chargement des catégories')
      }

      const bruts: CategorieDRF[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.results)
          ? (data as any).results
          : []

      setCategories(bruts.map(mapCategorie))
    } catch (error: any) {
      console.error('Erreur chargement catégories:', error)
      setErreur(error?.message || 'Impossible de charger les catégories.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    chargerCategories()
  }, [])

  const categoriesFiltrees = useMemo(() => {
    const rechercheMin = recherche.toLowerCase()
    return categories.filter(cat =>
      cat.nom.toLowerCase().includes(rechercheMin) ||
      (cat.description ?? '').toLowerCase().includes(rechercheMin)
    )
  }, [categories, recherche])

  const categoriesPagination = useMemo(() => {
    const total = categoriesFiltrees.length
    const totalPages = Math.max(1, Math.ceil(total / CATEGORIES_PAR_PAGE))
    const page = Math.min(Math.max(1, pageCategories), totalPages)
    const start = (page - 1) * CATEGORIES_PAR_PAGE
    const end = start + CATEGORIES_PAR_PAGE
    const items = categoriesFiltrees.slice(start, end)
    return { items, total, page, totalPages }
  }, [categoriesFiltrees, pageCategories])

  // Réinitialiser la page lors du changement de filtres
  useEffect(() => {
    setPageCategories(1)
  }, [recherche])

  const couleursPredefinies = [
    '#D32027', '#0066B3', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
    '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]

  async function soumettreCategorie(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nouveauNom.trim()) {
      setErreur('Le nom de la catégorie est obligatoire.')
      return
    }

    setErreur(null)
    setMessageSucces(null)
    setEnregistrementEnCours(true)

    const payload = {
      nom: nouveauNom.trim(),
      couleur: nouvelleCouleur,
      description: nouvelleDescription.trim() !== '' ? nouvelleDescription.trim() : null
    }

    const estCreation = !estEdition || !categorieEnEdition

    try {
      const url = estCreation ? '/categories/' : `/categories/${categorieEnEdition.id}/`
      const method = estCreation ? 'POST' : 'PUT'

      const { response, data } = await apiFetchJson(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || `Erreur lors ${estCreation ? 'de la création' : 'de la mise à jour'} de la catégorie.`)
      }

      const categorieSource = (data as any)?.categorie ?? data
      const categorieAPI = categorieSource ? mapCategorie(categorieSource as CategorieDRF) : null

      if (estCreation) {
        if (categorieAPI) {
          setCategories(prev => [...prev, categorieAPI].sort((a, b) => a.nom.localeCompare(b.nom)))
          setMessageSucces(`Catégorie "${categorieAPI.nom}" créée avec succès.`)
        } else {
          await chargerCategories(false)
          setMessageSucces('Catégorie créée avec succès.')
        }
      } else {
        if (categorieAPI) {
          setCategories(prev => prev
            .map(cat => (cat.id === categorieAPI.id ? categorieAPI : cat))
            .sort((a, b) => a.nom.localeCompare(b.nom))
          )
          setMessageSucces(`Catégorie "${categorieAPI.nom}" mise à jour.`)
        } else {
          await chargerCategories(false)
          setMessageSucces('Catégorie mise à jour.')
        }
      }

      fermerFormulaire()
    } catch (error: any) {
      console.error('Erreur soumission catégorie:', error)
      setErreur(error?.message || `Impossible ${estCreation ? 'de créer' : 'de mettre à jour'} la catégorie.`)
    } finally {
      setEnregistrementEnCours(false)
    }
  }

  function ouvrirModaleSuppressionCategorie(categorie: Categorie) {
    setModaleSuppressionCategorie({ open: true, categorie })
  }

  function fermerModaleSuppressionCategorie() {
    setModaleSuppressionCategorie({ open: false, categorie: null })
  }

  async function confirmerSuppressionCategorie() {
    const { categorie } = modaleSuppressionCategorie
    if (!categorie) return

    setErreur(null)
    setMessageSucces(null)
    setSuppressionEnCours(categorie.id)

    try {
      const { response, data } = await apiFetchJson(`/categories/${categorie.id}/`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors de la suppression de la catégorie.')
      }

      setCategories((prev) => prev.filter((cat) => cat.id !== categorie.id))
      setMessageSucces(`Catégorie "${categorie.nom}" supprimée.`)
      if (categorieEnEdition?.id === categorie.id) {
        fermerFormulaire()
      }
    } catch (error: any) {
      console.error('Erreur suppression catégorie:', error)
      setErreur(error?.message || 'Impossible de supprimer la catégorie.')
    } finally {
      setSuppressionEnCours(null)
      fermerModaleSuppressionCategorie()
    }
  }

  const statsGlobales = useMemo(() => {
    if (categories.length === 0) {
      return {
        total: 0,
        totalDocuments: 0,
        moyenne: 0,
        plusPopulaire: null as Categorie | null
      }
    }

    const totalDocuments = categories.reduce((sum, cat) => sum + cat.nombreDocuments, 0)
    const plusPopulaire = categories.reduce((prev, current) =>
      current.nombreDocuments > prev.nombreDocuments ? current : prev
    , categories[0])

    return {
      total: categories.length,
      totalDocuments,
      moyenne: Math.round(totalDocuments / categories.length),
      plusPopulaire
    }
  }, [categories])

  const maxDocumentsCategorie = categories.length > 0
    ? Math.max(...categories.map((cat) => cat.nombreDocuments))
    : 0

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
              <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Configuration</p>
              <h1 className="text-3xl font-semibold text-theme-primary">Catégories</h1>
              <p className="text-sm text-theme-secondary mt-1">{categoriesFiltrees.length} catégorie{categoriesFiltrees.length > 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={ouvrirFormulaireCreation}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <Icon name="plus" size="sm" />
              Nouvelle catégorie
            </button>
          </div>
        </motion.header>

        {/* Recherche */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-theme-card border border-theme rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all outline-none"
            />
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

        {messageSucces && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-sm"
          >
            {messageSucces}
          </motion.div>
        )}

        {chargement && (
          <div className="mb-6 flex items-center gap-3 text-theme-secondary text-sm">
            <div className="w-4 h-4 border-2 border-theme-secondary border-t-transparent rounded-full animate-spin" />
            Chargement...
          </div>
        )}


        {!chargement && categoriesFiltrees.length === 0 && (
          <div className="text-center py-16 bg-theme-card border border-theme rounded-xl">
            <Icon name="tag" size="lg" className="mx-auto mb-3 text-theme-secondary" />
            <p className="text-sm font-medium text-theme-primary mb-1">Aucune catégorie</p>
            <p className="text-xs text-theme-secondary">Créez votre première catégorie pour organiser vos documents</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {categoriesPagination.items.map((cat, index) => {
            const ratioRemplissage = maxDocumentsCategorie > 0
              ? Math.round((cat.nombreDocuments / maxDocumentsCategorie) * 100)
              : 0

            return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.02 }}
              className="bg-theme-card border border-theme rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.couleur}20` }}>
                  <Icon name="tag" size="sm" className="text-theme-secondary" />
                </div>
                <span className="text-lg font-semibold" style={{ color: cat.couleur }}>{cat.nombreDocuments}</span>
              </div>

              <h3 className="font-medium text-theme-primary text-sm mb-1">{cat.nom}</h3>
              <p className="text-xs text-theme-secondary mb-3 line-clamp-2">
                {cat.description || 'Aucune description'}
              </p>

              <div className="mb-3">
                <div className="h-1.5 bg-theme-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ratioRemplissage}%` }}
                    transition={{ delay: 0.3 + index * 0.05, duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.couleur }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 pt-3 border-t border-theme">
                <button
                  onClick={() => preparerEdition(cat)}
                  className="p-2 text-theme-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Icon name="edit" size="sm" />
                </button>
                <button
                  disabled={suppressionEnCours === cat.id}
                  onClick={() => ouvrirModaleSuppressionCategorie(cat)}
                  className="p-2 text-theme-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 ml-auto"
                  title="Supprimer"
                >
                  <Icon name="trash" size="sm" />
                </button>
              </div>
            </motion.div>
          )})}
        </div>

        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <div className="bg-theme-card border border-theme rounded-xl p-4">
              <p className="text-2xl font-semibold text-red-600">{statsGlobales.total}</p>
              <p className="text-xs text-theme-secondary">Catégories</p>
            </div>
            <div className="bg-theme-card border border-theme rounded-xl p-4">
              <p className="text-2xl font-semibold text-blue-600">{statsGlobales.totalDocuments}</p>
              <p className="text-xs text-theme-secondary">Documents</p>
            </div>
            <div className="bg-theme-card border border-theme rounded-xl p-4">
              <p className="text-2xl font-semibold text-green-600">{statsGlobales.moyenne}</p>
              <p className="text-xs text-theme-secondary">Moyenne</p>
            </div>
            <div className="bg-theme-card border border-theme rounded-xl p-4">
              <p className="text-sm font-medium text-theme-primary truncate">{statsGlobales.plusPopulaire?.nom ?? '—'}</p>
              <p className="text-xs text-theme-secondary">Plus populaire</p>
            </div>
          </motion.div>
        )}

        {/* Pagination */}
        {!chargement && categoriesPagination.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex items-center justify-between"
          >
            <p className="text-sm text-theme-secondary">
              Page {categoriesPagination.page} sur {categoriesPagination.totalPages} · {categoriesPagination.total} catégorie{categoriesPagination.total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPageCategories(1)}
                disabled={categoriesPagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ««
              </button>
              <button
                type="button"
                onClick={() => setPageCategories((prev) => Math.max(1, prev - 1))}
                disabled={categoriesPagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-theme-primary">
                {categoriesPagination.page}
              </span>
              <button
                type="button"
                onClick={() => setPageCategories((prev) => Math.min(categoriesPagination.totalPages, prev + 1))}
                disabled={categoriesPagination.page >= categoriesPagination.totalPages}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => setPageCategories(categoriesPagination.totalPages)}
                disabled={categoriesPagination.page >= categoriesPagination.totalPages}
                className="px-3 py-1.5 text-sm border border-theme rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                »»
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Modale de création/modification catégorie */}
      <FormModal
        isOpen={afficherFormulaire}
        onClose={fermerFormulaire}
        title={titreFormulaire}
        isDark={isDark}
        size="md"
      >
        <form ref={formulaireRef} className="space-y-4" onSubmit={soumettreCategorie}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Nom *</label>
              <input
                type="text"
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
                placeholder="Ex: Transport Maritime"
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Couleur *</label>
              <div className="flex gap-1.5 items-center">
                {couleursPredefinies.map((couleur) => (
                  <button
                    key={couleur}
                    type="button"
                    onClick={() => setNouvelleCouleur(couleur)}
                    className={`w-7 h-7 rounded-full transition-all ${nouvelleCouleur === couleur ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                    style={{ backgroundColor: couleur }}
                  />
                ))}
                <input
                  type="color"
                  value={nouvelleCouleur}
                  onChange={(e) => setNouvelleCouleur(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Description</label>
            <textarea
              value={nouvelleDescription}
              onChange={(e) => setNouvelleDescription(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:border-red-400 outline-none resize-none ${
                isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
              rows={2}
              placeholder="Description optionnelle"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={fermerFormulaire}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={enregistrementEnCours}
              className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {texteBoutonSoumission}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Modale de confirmation suppression catégorie */}
      <ConfirmModal
        isOpen={modaleSuppressionCategorie.open}
        onClose={fermerModaleSuppressionCategorie}
        onConfirm={confirmerSuppressionCategorie}
        title="Supprimer la catégorie"
        message={`Êtes-vous sûr de vouloir supprimer la catégorie "${modaleSuppressionCategorie.categorie?.nom}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={suppressionEnCours === modaleSuppressionCategorie.categorie?.id}
        isDark={isDark}
      />
    </div>
  )
}
