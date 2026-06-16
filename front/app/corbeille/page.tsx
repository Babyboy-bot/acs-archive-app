'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/AppLayout'
import { Icon } from '@/components/Icon'
import { apiFetchJson } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'
import { AuthLoadingScreen } from '@/components/common'
import { RoleUtilisateur } from '@/types'

type BordCorbEille = {
  id: string
  titre: string
  reference: string | null
  annee: number
  compagnie: string | null
  taille_fichier: number
  deleted_at: string
  deleted_by: string | null
}

type DocCorbeille = {
  id: string
  titre: string
  reference: string | null
  type_courrier: string
  taille_fichier: number
  cree_le: string
  deleted_at: string
  deleted_by: string | null
  client: string | null
}

function formaterDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formaterTaille(octets: number) {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

export default function CorbeillePage() {
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  const utilisateur = useUtilisateurCourant()
  const router = useRouter()

  const [onglet, setOnglet] = useState<'documents' | 'bordereaux'>('documents')

  // ── Documents ──
  const [documents, setDocuments] = useState<DocCorbeille[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [confirmerPurgeId, setConfirmerPurgeId] = useState<string | null>(null)
  const [confirmerPurgeAll, setConfirmerPurgeAll] = useState(false)

  // ── Bordereaux ──
  const [bordereaux, setBordereaux] = useState<BordCorbEille[]>([])
  const [chargBord, setChargBord] = useState(true)
  const [enCoursBord, setEnCoursBord] = useState<string | null>(null)
  const [confirmerPurgeBordId, setConfirmerPurgeBordId] = useState<string | null>(null)

  const charger = async () => {
    setChargement(true)
    setErreur(null)
    try {
      const { data } = await apiFetchJson<{ documents: DocCorbeille[]; total: number }>('/corbeille/')
      setDocuments(data?.documents ?? [])
    } catch {
      setErreur('Impossible de charger la corbeille.')
    } finally {
      setChargement(false)
    }
  }

  const chargerBordereaux = async () => {
    setChargBord(true)
    try {
      const { data } = await apiFetchJson<{ bordereaux: BordCorbEille[] }>('/corbeille/bordereaux/')
      setBordereaux(data?.bordereaux ?? [])
    } catch {
      setErreur('Impossible de charger les bordereaux supprimés.')
    } finally {
      setChargBord(false)
    }
  }

  useEffect(() => {
    if (estAuthentifie && utilisateur?.role === RoleUtilisateur.ADMIN) {
      charger()
      chargerBordereaux()
    }
  }, [estAuthentifie, utilisateur])

  const restaurer = async (id: string) => {
    setEnCours(id)
    try {
      await apiFetchJson<{ detail: string }>(`/corbeille/${id}/restaurer/`, { method: 'POST' })
      setMessage('Document restauré avec succès.')
      setDocuments(prev => prev.filter(d => d.id !== id))
    } catch {
      setErreur('Erreur lors de la restauration.')
    } finally {
      setEnCours(null)
    }
  }

  const purgerUn = async (id: string) => {
    setEnCours(id)
    setConfirmerPurgeId(null)
    try {
      await apiFetchJson<void>(`/corbeille/${id}/purger/`, { method: 'DELETE' })
      setMessage('Document supprimé définitivement.')
      setDocuments(prev => prev.filter(d => d.id !== id))
    } catch {
      setErreur('Erreur lors de la suppression définitive.')
    } finally {
      setEnCours(null)
    }
  }

  const restaurerBordereau = async (id: string) => {
    setEnCoursBord(id)
    try {
      await apiFetchJson(`/corbeille/bordereaux/${id}/restaurer/`, { method: 'POST' })
      setMessage('Bordereau restauré avec succès.')
      setBordereaux(prev => prev.filter(b => b.id !== id))
    } catch {
      setErreur('Erreur lors de la restauration.')
    } finally {
      setEnCoursBord(null)
    }
  }

  const purgerBordereau = async (id: string) => {
    setEnCoursBord(id)
    setConfirmerPurgeBordId(null)
    try {
      await apiFetchJson(`/corbeille/bordereaux/${id}/purger/`, { method: 'DELETE' })
      setMessage('Bordereau supprimé définitivement.')
      setBordereaux(prev => prev.filter(b => b.id !== id))
    } catch {
      setErreur('Erreur lors de la suppression définitive.')
    } finally {
      setEnCoursBord(null)
    }
  }

  const purgerTout = async () => {
    setConfirmerPurgeAll(false)
    setEnCours('all')
    try {
      const { data } = await apiFetchJson<{ detail: string }>('/corbeille/purger-tout/', { method: 'DELETE' })
      setMessage(data?.detail ?? 'Corbeille vidée.')
      setDocuments([])
    } catch {
      setErreur('Erreur lors du vidage de la corbeille.')
    } finally {
      setEnCours(null)
    }
  }

  if (authChargement || !estAuthentifie) return <AuthLoadingScreen />

  if (utilisateur?.role !== RoleUtilisateur.ADMIN) {
    return (
      <AppLayout>
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <Icon name="shield" size="xl" className="mx-auto mb-4 text-red-500" />
            <h1 className="text-xl font-semibold text-theme-primary">Accès réservé aux administrateurs</h1>
          </div>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-10 overflow-auto">

        {/* En-tête */}
        <motion.header initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Administration</p>
              <h1 className="text-3xl font-semibold text-theme-primary flex items-center gap-3">
                <Icon name="trash" size="lg" className="text-red-500" />
                Corbeille
              </h1>
              <p className="text-sm text-theme-secondary mt-1">Éléments supprimés — restauration ou purge définitive</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/documents')}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-theme rounded-lg hover:bg-theme-muted transition-colors"
              >
                <Icon name="arrow-left" size="sm" />
                Retour
              </button>
              {documents.length > 0 && (
                <button
                  onClick={() => setConfirmerPurgeAll(true)}
                  disabled={enCours === 'all'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Icon name="trash" size="sm" />
                  Vider la corbeille
                </button>
              )}
            </div>
          </div>
        </motion.header>

        {/* Messages */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-sm flex justify-between"
            >
              {message}
              <button onClick={() => setMessage(null)} className="ml-4 opacity-60 hover:opacity-100"><Icon name="close" size="xs" /></button>
            </motion.div>
          )}
          {erreur && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm flex justify-between"
            >
              {erreur}
              <button onClick={() => setErreur(null)} className="ml-4 opacity-60 hover:opacity-100"><Icon name="close" size="xs" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Onglets */}
        <div className="flex gap-1 mb-6 bg-theme-muted/40 p-1 rounded-xl w-fit">
          <button
            onClick={() => setOnglet('documents')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === 'documents'
                ? 'bg-theme-card text-theme-primary shadow-sm'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon name="document" size="xs" /> Documents {documents.length > 0 && `(${documents.length})`}
            </span>
          </button>
          <button
            onClick={() => setOnglet('bordereaux')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === 'bordereaux'
                ? 'bg-theme-card text-theme-primary shadow-sm'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon name="card" size="xs" /> Bordereaux {bordereaux.length > 0 && `(${bordereaux.length})`}
            </span>
          </button>
        </div>

        {/* Contenu Documents */}
        {onglet === 'documents' && (chargement ? (
          <div className="flex items-center gap-3 text-theme-secondary py-12 justify-center">
            <div className="w-5 h-5 border-2 border-theme-secondary border-t-transparent rounded-full animate-spin" />
            Chargement...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 bg-theme-card border border-theme rounded-xl">
            <Icon name="trash" size="xl" className="mx-auto mb-4 text-theme-secondary opacity-40" />
            <p className="text-lg font-medium text-theme-primary">Aucun document dans la corbeille</p>
          </div>
        ) : (
          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-theme bg-theme-muted/50">
              <span className="text-sm text-theme-secondary font-medium">{documents.length} document{documents.length > 1 ? 's' : ''} dans la corbeille</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-theme">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary">Document</th>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden md:table-cell">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden lg:table-cell">Supprimé le</th>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden lg:table-cell">Supprimé par</th>
                    <th className="text-right px-4 py-3 font-medium text-theme-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {documents.map((doc, i) => (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-theme-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                            <Icon name="document" size="xs" className="text-red-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-theme-primary truncate max-w-xs">{doc.titre}</p>
                            <p className="text-xs text-theme-secondary font-mono">{doc.reference || '—'} · {formaterTaille(doc.taille_fichier)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-theme-secondary hidden md:table-cell">{doc.client || '—'}</td>
                      <td className="px-4 py-3 text-theme-secondary hidden lg:table-cell whitespace-nowrap">{formaterDate(doc.deleted_at)}</td>
                      <td className="px-4 py-3 text-theme-secondary hidden lg:table-cell">{doc.deleted_by || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => restaurer(doc.id)}
                            disabled={enCours === doc.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-lg transition-colors disabled:opacity-50"
                            title="Restaurer"
                          >
                            <Icon name="check" size="xs" />
                            <span className="hidden sm:inline">Restaurer</span>
                          </button>
                          <button
                            onClick={() => setConfirmerPurgeId(doc.id)}
                            disabled={enCours === doc.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                            title="Supprimer définitivement"
                          >
                            <Icon name="trash" size="xs" />
                            <span className="hidden sm:inline">Purger</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Contenu Bordereaux */}
        {onglet === 'bordereaux' && (chargBord ? (
          <div className="flex items-center gap-3 text-theme-secondary py-12 justify-center">
            <div className="w-5 h-5 border-2 border-theme-secondary border-t-transparent rounded-full animate-spin" />
            Chargement...
          </div>
        ) : bordereaux.length === 0 ? (
          <div className="text-center py-20 bg-theme-card border border-theme rounded-xl">
            <Icon name="trash" size="xl" className="mx-auto mb-4 text-theme-secondary opacity-40" />
            <p className="text-lg font-medium text-theme-primary">Aucun bordereau dans la corbeille</p>
          </div>
        ) : (
          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-theme bg-theme-muted/50">
              <span className="text-sm text-theme-secondary font-medium">{bordereaux.length} bordereau(x) dans la corbeille</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-theme">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary">Bordereau</th>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden md:table-cell">Compagnie</th>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden lg:table-cell">Supprimé le</th>
                    <th className="text-left px-4 py-3 font-medium text-theme-secondary hidden lg:table-cell">Supprimé par</th>
                    <th className="text-right px-4 py-3 font-medium text-theme-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {bordereaux.map((b, i) => (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-theme-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                            <Icon name="document" size="xs" className="text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-theme-primary truncate max-w-xs">{b.titre}</p>
                            <p className="text-xs text-theme-secondary font-mono">{b.reference ?? '—'} · {b.annee} · {formaterTaille(b.taille_fichier)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-theme-secondary hidden md:table-cell">{b.compagnie ?? '—'}</td>
                      <td className="px-4 py-3 text-theme-secondary hidden lg:table-cell whitespace-nowrap">{formaterDate(b.deleted_at)}</td>
                      <td className="px-4 py-3 text-theme-secondary hidden lg:table-cell">{b.deleted_by ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => restaurerBordereau(b.id)}
                            disabled={enCoursBord === b.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Icon name="check" size="xs" />
                            <span className="hidden sm:inline">Restaurer</span>
                          </button>
                          <button
                            onClick={() => setConfirmerPurgeBordId(b.id)}
                            disabled={enCoursBord === b.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Icon name="trash" size="xs" />
                            <span className="hidden sm:inline">Purger</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Modal purge bordereau */}
        <AnimatePresence>
          {confirmerPurgeBordId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setConfirmerPurgeBordId(null)}
            >
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-theme-card rounded-xl p-6 max-w-md w-full shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="font-semibold text-theme-primary mb-2">Suppression définitive</h3>
                <p className="text-sm text-theme-secondary mb-6">Le fichier bordereau sera effacé du serveur de façon irréversible.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmerPurgeBordId(null)}
                    className="flex-1 py-2 text-sm border border-theme rounded-lg hover:bg-theme-muted transition-colors">
                    Annuler
                  </button>
                  <button onClick={() => purgerBordereau(confirmerPurgeBordId)}
                    className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                    Supprimer définitivement
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modale confirmation purge unitaire */}
        <AnimatePresence>
          {confirmerPurgeId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setConfirmerPurgeId(null)}
            >
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-theme-card rounded-xl p-6 max-w-md w-full shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Icon name="trash" size="sm" className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Suppression définitive</h3>
                    <p className="text-sm text-theme-secondary">Cette action est irréversible</p>
                  </div>
                </div>
                <p className="text-sm text-theme-secondary mb-6">
                  Le fichier sera effacé du serveur et ne pourra plus être récupéré.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmerPurgeId(null)}
                    className="flex-1 py-2 text-sm border border-theme rounded-lg hover:bg-theme-muted transition-colors">
                    Annuler
                  </button>
                  <button onClick={() => purgerUn(confirmerPurgeId)}
                    className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                    Supprimer définitivement
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modale confirmation vider corbeille */}
        <AnimatePresence>
          {confirmerPurgeAll && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setConfirmerPurgeAll(false)}
            >
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-theme-card rounded-xl p-6 max-w-md w-full shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Icon name="trash" size="sm" className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Vider la corbeille</h3>
                    <p className="text-sm text-theme-secondary">{documents.length} document{documents.length > 1 ? 's' : ''} seront supprimés</p>
                  </div>
                </div>
                <p className="text-sm text-theme-secondary mb-6">
                  Tous les fichiers de la corbeille seront effacés définitivement du serveur. Cette action est irréversible.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmerPurgeAll(false)}
                    className="flex-1 py-2 text-sm border border-theme rounded-lg hover:bg-theme-muted transition-colors">
                    Annuler
                  </button>
                  <button onClick={purgerTout}
                    className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                    Vider définitivement
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </AppLayout>
  )
}
