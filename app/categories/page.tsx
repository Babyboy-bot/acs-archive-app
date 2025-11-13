'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchJson } from '@/lib/api'

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
  const [recherche, setRecherche] = useState('')
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

  async function supprimerCategorie(id: string) {
    const categorie = categories.find((cat) => cat.id === id)
    if (!categorie) {
      return
    }

    const confirmation = window.confirm(`Supprimer la catégorie "${categorie.nom}" ?`)
    if (!confirmation) {
      return
    }

    setErreur(null)
    setMessageSucces(null)
    setSuppressionEnCours(id)

    try {
      const { response, data } = await apiFetchJson(`/categories/${id}/`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors de la suppression de la catégorie.')
      }

      setCategories((prev) => prev.filter((cat) => cat.id !== id))
      setMessageSucces(`Catégorie "${categorie.nom}" supprimée.`)
      if (categorieEnEdition?.id === id) {
        fermerFormulaire()
      }
    } catch (error: any) {
      console.error('Erreur suppression catégorie:', error)
      setErreur(error?.message || 'Impossible de supprimer la catégorie.')
    } finally {
      setSuppressionEnCours(null)
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
                <Icon name="tag" size="xl" className="text-red-600" />
                Catégories
              </h1>
              <p className="text-gray-600">{categoriesFiltrees.length} catégorie{categoriesFiltrees.length > 1 ? 's' : ''} de documents</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => (afficherFormulaire ? fermerFormulaire() : ouvrirFormulaireCreation())}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Icon name={iconeBoutonPrincipal} size="sm" />
              {texteBoutonPrincipal}
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="relative">
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une catégorie..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Icon name="search" className="text-gray-400" />
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

        {chargement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-500"
          >
            Chargement des catégories...
          </motion.div>
        )}

        {afficherFormulaire && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl shadow-lg p-8 mb-8 border-2 border-red-200"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Icon name={estEdition ? 'edit' : 'plus'} size="md" />
              {titreFormulaire}
            </h3>
            <form ref={formulaireRef} className="space-y-6" onSubmit={soumettreCategorie}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom de la catégorie *</label>
                  <input
                    type="text"
                    value={nouveauNom}
                    onChange={(e) => setNouveauNom(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Ex: Transport Maritime"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Couleur *</label>
                  <div className="flex gap-2">
                    {couleursPredefinies.map((couleur) => (
                      <motion.button
                        key={couleur}
                        type="button"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setNouvelleCouleur(couleur)}
                        className={`w-10 h-10 rounded-full shadow-lg transition-all ${
                          nouvelleCouleur === couleur ? 'ring-4 ring-offset-2 ring-gray-400' : ''
                        }`}
                        style={{ backgroundColor: couleur }}
                      />
                    ))}
                    <input
                      type="color"
                      value={nouvelleCouleur}
                      onChange={(e) => setNouvelleCouleur(e.target.value)}
                      className="w-10 h-10 rounded-full cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={nouvelleDescription}
                  onChange={(e) => setNouvelleDescription(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                  rows={3}
                  placeholder="Décrivez l'usage de cette catégorie"
                />
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={enregistrementEnCours}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name="check" size="sm" />
                  {texteBoutonSoumission}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={fermerFormulaire}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {!chargement && categoriesFiltrees.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500"
          >
            Aucune catégorie pour le moment. Créez votre première catégorie pour organiser vos documents.
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoriesFiltrees.map((cat, index) => {
            const ratioRemplissage = maxDocumentsCategorie > 0
              ? Math.round((cat.nombreDocuments / maxDocumentsCategorie) * 100)
              : 0

            return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer group"
            >
              <div 
                className="h-24 relative overflow-hidden flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${cat.couleur}dd 0%, ${cat.couleur} 100%)` }}
              >
                <Icon name="tag" size="xl" className="text-white opacity-90 group-hover:scale-110 transition-transform" />
              </div>

              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                  {cat.nom}
                </h3>
                <p className="text-sm text-gray-600 mb-4 h-10">
                  {cat.description || 'Aucune description fournie'}
                </p>

                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-3xl font-bold" style={{ color: cat.couleur }}>
                      {cat.nombreDocuments}
                    </p>
                    <p className="text-sm text-gray-500">Documents</p>
                  </div>
                  <Icon name="chart" size="xl" className="text-gray-200 group-hover:text-gray-300 transition-colors" />
                </div>

                <div className="mb-4">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ratioRemplissage}%` }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.couleur }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => preparerEdition(cat)}
                    className="flex-1 py-2 rounded-lg font-medium text-sm text-white transition-all hover:shadow-lg flex items-center justify-center gap-1"
                    style={{ background: `linear-gradient(135deg, ${cat.couleur}dd 0%, ${cat.couleur} 100%)` }}
                  >
                    <Icon name="edit" size="sm" />
                    Modifier
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={suppressionEnCours === cat.id}
                    onClick={() => supprimerCategorie(cat.id)}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Icon name="trash" size="sm" />
                    {suppressionEnCours === cat.id ? 'Suppression...' : 'Supprimer'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )})}
        </div>

        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-8 bg-white rounded-2xl shadow-lg p-8"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Icon name="chart" size="md" />
              Statistiques Globales
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent mb-2">
                  {statsGlobales.total}
                </p>
                <p className="text-sm text-gray-600">Catégories</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">
                  {statsGlobales.totalDocuments}
                </p>
                <p className="text-sm text-gray-600">Total Documents</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent mb-2">
                  {statsGlobales.moyenne}
                </p>
                <p className="text-sm text-gray-600">Moyenne/Catégorie</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-2">
                  {statsGlobales.plusPopulaire?.nom ?? '—'}
                </p>
                <p className="text-sm text-gray-600">Plus Populaire</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
