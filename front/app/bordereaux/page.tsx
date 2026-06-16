'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AppLayout } from '@/components'
import { Icon } from '@/components/Icon'
import { apiFetchJson } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'

type Compagnie = {
  id: string
  nom: string
  numero_client: string | null
}

type Bordereau = {
  id: string
  titre: string
  reference: string | null
  annee: number
  compagnie: string
  compagnie_detail: Compagnie
  type_fichier: string
  taille_fichier: number
  fichier_url: string | null
  auteur_nom: string
  cree_le: string
}

const formatTaille = (b: number) => {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${b} B`
}

const formatDate = (v?: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export default function PageBordereaux() {
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  useEnforceNonConsultant()

  const [bordereaux, setBordereaux] = useState<Bordereau[]>([])
  const [compagnies, setCompagnies] = useState<Compagnie[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  const [filtreCompagnie, setFiltreCompagnie] = useState('')
  const [filtreAnnee, setFiltreAnnee] = useState('')
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 20

  const rechercheRef = useRef(recherche)
  rechercheRef.current = recherche

  const chargerBordereaux = useCallback(async (q: string, compagnie: string, annee: string, p: number) => {
    setChargement(true)
    setErreur('')
    try {
      const params = new URLSearchParams()
      if (compagnie) params.set('compagnie', compagnie)
      if (annee) params.set('annee', annee)
      if (q.trim()) params.set('q', q.trim())
      params.set('page', String(p))
      params.set('page_size', String(PAGE_SIZE))
      const res = await apiFetchJson<{ results: Bordereau[]; count: number; num_pages: number }>(`/bordereaux/?${params}`)
      setBordereaux(res.data?.results ?? [])
      setTotal(res.data?.count ?? 0)
      setNumPages(res.data?.num_pages ?? 1)
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur de chargement')
    } finally {
      setChargement(false)
    }
  }, [])

  // Chargement initial des compagnies (une seule fois)
  useEffect(() => {
    if (!estAuthentifie) return
    apiFetchJson<Compagnie[]>('/compagnies/').then(res => setCompagnies(res.data ?? []))
  }, [estAuthentifie])

  // Rechargement bordereaux sur changement de filtres (reset page)
  useEffect(() => {
    if (!estAuthentifie) return
    setPage(1)
    chargerBordereaux(rechercheRef.current, filtreCompagnie, filtreAnnee, 1)
  }, [estAuthentifie, filtreCompagnie, filtreAnnee, chargerBordereaux])

  // Debounce sur la recherche texte (400 ms) + reset page
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!estAuthentifie) return
      setPage(1)
      chargerBordereaux(recherche, filtreCompagnie, filtreAnnee, 1)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche])

  // Rechargement sur changement de page seul
  useEffect(() => {
    if (estAuthentifie && page > 1) chargerBordereaux(rechercheRef.current, filtreCompagnie, filtreAnnee, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // ── États modal édition ──
  const [bordereauEdit, setBordereauEdit] = useState<Bordereau | null>(null)
  const [editTitre, setEditTitre] = useState('')
  const [editReference, setEditReference] = useState('')
  const [editAnnee, setEditAnnee] = useState('')
  const [editCompagnie, setEditCompagnie] = useState('')
  const [editChargement, setEditChargement] = useState(false)
  const [editErreur, setEditErreur] = useState('')

  // ── États modal suppression ──
  const [bordereauSuppr, setBordereauSuppr] = useState<Bordereau | null>(null)
  const [supprChargement, setSupprChargement] = useState(false)

  const ouvrirFichier = (url: string | null) => {
    if (!url) return
    window.open(url, '_blank')
  }

  const ouvrirEdit = (b: Bordereau) => {
    setBordereauEdit(b)
    setEditTitre(b.titre)
    setEditReference(b.reference ?? '')
    setEditAnnee(String(b.annee))
    setEditCompagnie(b.compagnie)
    setEditErreur('')
  }

  const sauvegarderEdit = async () => {
    if (!bordereauEdit || !editTitre.trim()) return
    setEditChargement(true)
    setEditErreur('')
    try {
      const { response, data } = await apiFetchJson(`/bordereaux/${bordereauEdit.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: editTitre.trim(),
          reference: editReference,
          annee: editAnnee,
          compagnie_id: editCompagnie,
        }),
      })
      if (!response.ok) {
        const err = data as any
        throw new Error(err?.erreur ?? `Erreur ${response.status}`)
      }
      setBordereaux(prev => prev.map(b => b.id === bordereauEdit.id ? (data as Bordereau) : b))
      setBordereauEdit(null)
    } catch (e: any) {
      setEditErreur(e?.message ?? 'Erreur lors de la modification.')
    } finally {
      setEditChargement(false)
    }
  }

  const confirmerSuppression = async () => {
    if (!bordereauSuppr) return
    setSupprChargement(true)
    try {
      await apiFetchJson(`/bordereaux/${bordereauSuppr.id}/`, { method: 'DELETE' })
      setBordereaux(prev => prev.filter(b => b.id !== bordereauSuppr.id))
      setBordereauSuppr(null)
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors de la suppression.')
      setBordereauSuppr(null)
    } finally {
      setSupprChargement(false)
    }
  }

  if (authChargement) return null

  const anneesCourantes = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-theme-primary">Bordereaux</h1>
            <p className="text-sm text-theme-secondary mt-1">
              {chargement ? '…' : `${total} bordereau(x)`}
            </p>
          </div>
          <Link
            href="/bordereaux/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D32027] text-white font-medium text-sm hover:bg-[#b91c1c] transition-colors"
          >
            <Icon name="upload" size="sm" />
            Nouveau bordereau
          </Link>
        </div>

        {/* Filtres */}
        <div className="bg-theme-card border border-theme rounded-xl p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex gap-2 flex-1 min-w-[200px] relative">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher titre, référence, compagnie…"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>

          <select
            value={filtreCompagnie}
            onChange={e => setFiltreCompagnie(e.target.value)}
            className="px-3 py-2 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
          >
            <option value="">Toutes les compagnies</option>
            {compagnies.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>

          <select
            value={filtreAnnee}
            onChange={e => setFiltreAnnee(e.target.value)}
            className="px-3 py-2 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
          >
            <option value="">Toutes les années</option>
            {anneesCourantes.map(a => (
              <option key={a} value={String(a)}>{a}</option>
            ))}
          </select>
        </div>

        {/* Erreur */}
        {erreur && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {erreur}
          </div>
        )}

        {/* Contenu */}
        {chargement ? (
          <div className="flex items-center justify-center py-20 text-theme-secondary">
            <Icon name="clock" size="lg" className="animate-spin mr-3" />
            Chargement…
          </div>
        ) : bordereaux.length === 0 ? (
          <div className="text-center py-20 text-theme-secondary">
            <Icon name="folder" size="lg" className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun bordereau trouvé.</p>
            <Link href="/bordereaux/nouveau" className="mt-4 inline-flex items-center gap-1 text-[#D32027] text-sm hover:underline">
              <Icon name="upload" size="sm" />
              Uploader un bordereau
            </Link>
          </div>
        ) : (
          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme bg-theme-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-theme-secondary">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden md:table-cell">Référence</th>
                  <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden sm:table-cell">Compagnie</th>
                  <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden lg:table-cell">Année</th>
                  <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden lg:table-cell">Taille</th>
                  <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden xl:table-cell">Déposé le</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {bordereaux.map((b, idx) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-b border-theme last:border-0 hover:bg-theme-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon name="document" size="sm" className="text-[#D32027] shrink-0" />
                        <span className="font-medium text-theme-primary truncate max-w-[200px]">{b.titre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-theme-secondary hidden md:table-cell">{b.reference ?? '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                        {b.compagnie_detail?.nom ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-theme-secondary hidden lg:table-cell">{b.annee}</td>
                    <td className="px-4 py-3 text-theme-secondary hidden lg:table-cell">{formatTaille(b.taille_fichier)}</td>
                    <td className="px-4 py-3 text-theme-secondary hidden xl:table-cell">{formatDate(b.cree_le)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {b.fichier_url && (
                          <button
                            onClick={() => ouvrirFichier(b.fichier_url)}
                            className="p-1.5 rounded-lg text-theme-secondary hover:text-[#D32027] hover:bg-theme-muted transition-colors"
                            title="Ouvrir le fichier"
                          >
                            <Icon name="eye" size="sm" />
                          </button>
                        )}
                        <button
                          onClick={() => ouvrirEdit(b)}
                          className="p-1.5 rounded-lg text-theme-secondary hover:text-blue-500 hover:bg-theme-muted transition-colors"
                          title="Modifier"
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                        <button
                          onClick={() => setBordereauSuppr(b)}
                          className="p-1.5 rounded-lg text-theme-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Supprimer"
                        >
                          <Icon name="trash" size="sm" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {numPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-sm text-theme-secondary">
              Page {page} / {numPages} &nbsp;·&nbsp; {total} résultat(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || chargement}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-theme text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="arrow-left" size="xs" /> Précédent
              </button>

              {/* Pages proches */}
              <div className="flex gap-1">
                {Array.from({ length: numPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === numPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-theme-secondary">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        disabled={chargement}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                          item === page
                            ? 'bg-[#D32027] text-white'
                            : 'border border-theme text-theme-secondary hover:text-theme-primary'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )
                }
              </div>

              <button
                onClick={() => setPage(p => Math.min(numPages, p + 1))}
                disabled={page === numPages || chargement}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-theme text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant <Icon name="arrow-right" size="xs" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Édition ── */}
      {bordereauEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-theme-card border border-theme rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-theme-primary flex items-center gap-2">
                <Icon name="edit" size="sm" className="text-[#D32027]" />
                Modifier le bordereau
              </h2>
              <button onClick={() => setBordereauEdit(null)} className="p-1 rounded-lg text-theme-secondary hover:text-theme-primary">
                <Icon name="close" size="sm" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">Titre *</label>
                <input
                  type="text"
                  value={editTitre}
                  onChange={e => setEditTitre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">Référence</label>
                <input
                  type="text"
                  value={editReference}
                  onChange={e => setEditReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">Année *</label>
                  <select
                    value={editAnnee}
                    onChange={e => setEditAnnee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
                  >
                    {anneesCourantes.map(a => (
                      <option key={a} value={String(a)}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">Compagnie *</label>
                  <select
                    value={editCompagnie}
                    onChange={e => setEditCompagnie(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
                  >
                    {compagnies.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editErreur && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <Icon name="warning" size="sm" />{editErreur}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setBordereauEdit(null)}
                className="px-4 py-2 rounded-lg border border-theme text-theme-secondary hover:text-theme-primary text-sm"
              >
                Annuler
              </button>
              <button
                onClick={sauvegarderEdit}
                disabled={editChargement || !editTitre.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D32027] text-white text-sm font-medium hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {editChargement ? <Icon name="clock" size="sm" className="animate-spin" /> : <Icon name="check" size="sm" />}
                Enregistrer
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal Suppression ── */}
      {bordereauSuppr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-theme-card border border-theme rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Icon name="trash" size="sm" className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="font-bold text-theme-primary">Supprimer le bordereau</h2>
                <p className="text-xs text-theme-secondary">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-theme-secondary mb-6">
              Confirmer la suppression de <strong className="text-theme-primary">{bordereauSuppr.titre}</strong> ?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBordereauSuppr(null)}
                disabled={supprChargement}
                className="px-4 py-2 rounded-lg border border-theme text-theme-secondary hover:text-theme-primary text-sm"
              >
                Annuler
              </button>
              <button
                onClick={confirmerSuppression}
                disabled={supprChargement}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {supprChargement ? <Icon name="clock" size="sm" className="animate-spin" /> : <Icon name="trash" size="sm" />}
                Supprimer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  )
}
