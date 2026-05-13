'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetchJson } from '@/lib/api'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { AppLayout } from '@/components/AppLayout'

type AuditLog = {
  id: number
  utilisateur: string
  utilisateur_nom_complet: string
  action: string
  resource_type: string
  resource_id: string
  resource_name: string
  details: Record<string, unknown>
  ip_address: string | null
  success: boolean
  date: string
}

type AuditResponse = {
  logs: AuditLog[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN:        { label: 'Connexion',       color: 'bg-green-100 text-green-800' },
  LOGOUT:       { label: 'Déconnexion',     color: 'bg-gray-100 text-gray-600' },
  CREATE:       { label: 'Ajout',           color: 'bg-blue-100 text-blue-800' },
  READ:         { label: 'Consultation',    color: 'bg-cyan-100 text-cyan-800' },
  UPDATE:       { label: 'Modification',    color: 'bg-yellow-100 text-yellow-800' },
  DELETE:       { label: 'Suppression',     color: 'bg-red-100 text-red-800' },
  DOWNLOAD:     { label: 'Téléchargement',  color: 'bg-purple-100 text-purple-800' },
  PRINT:        { label: 'Impression',      color: 'bg-orange-100 text-orange-800' },
  EXPORT:       { label: 'Export',          color: 'bg-teal-100 text-teal-800' },
  SEARCH:       { label: 'Recherche',       color: 'bg-indigo-100 text-indigo-800' },
  ACCESS_DENIED:{ label: 'Accès refusé',    color: 'bg-red-200 text-red-900' },
}

const RESOURCE_LABELS: Record<string, string> = {
  document:     'Document',
  session:      'Session',
  utilisateur:  'Utilisateur',
  client:       'Client',
  exercice:     'Exercice',
  risque:       'Risque',
  assistant:    'Assistant IA',
}

const ACTIONS = ['', 'LOGIN', 'LOGOUT', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'DOWNLOAD', 'PRINT', 'EXPORT', 'SEARCH', 'ACCESS_DENIED']
const RESOURCES = ['', 'document', 'session', 'utilisateur', 'client', 'exercice', 'risque', 'assistant']

export default function JournalPage() {
  const utilisateur = useUtilisateurCourant()
  const router = useRouter()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  const [filtreAction, setFiltreAction] = useState('')
  const [filtreResource, setFiltreResource] = useState('')
  const [filtreSearch, setFiltreSearch] = useState('')
  const [filtreDebut, setFiltreDebut] = useState('')
  const [filtreFin, setFiltreFin] = useState('')

  const chargerLogs = useCallback(async () => {
    setChargement(true)
    setErreur('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('page_size', '50')
      if (filtreAction) params.set('action', filtreAction)
      if (filtreResource) params.set('resource_type', filtreResource)
      if (filtreSearch) params.set('search', filtreSearch)
      if (filtreDebut) params.set('date_debut', filtreDebut)
      if (filtreFin) params.set('date_fin', filtreFin)

      const { response, data } = await apiFetchJson<AuditResponse>(`/audit/logs/?${params.toString()}`)
      if (!response.ok || !data) throw new Error('Impossible de charger les logs')
      setLogs(data.logs)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch {
      setErreur('Erreur lors du chargement du journal')
    } finally {
      setChargement(false)
    }
  }, [page, filtreAction, filtreResource, filtreSearch, filtreDebut, filtreFin])

  useEffect(() => {
    if (utilisateur && utilisateur.role !== 'ADMIN') {
      router.push('/')
    }
  }, [utilisateur, router])

  useEffect(() => {
    chargerLogs()
  }, [chargerLogs])

  const resetFiltres = () => {
    setFiltreAction('')
    setFiltreResource('')
    setFiltreSearch('')
    setFiltreDebut('')
    setFiltreFin('')
    setPage(1)
  }

  const formaterDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (utilisateur?.role !== 'ADMIN') return null

  return (
    <AppLayout>
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary mb-4 transition-colors"
        >
          <Icon name="arrow-left" size="sm" />
          Retour
        </button>
        <h1 className="text-2xl font-bold text-theme-primary mb-1">Journal d'activité</h1>
        <p className="text-sm text-theme-secondary">{total} action{total > 1 ? 's' : ''} enregistrée{total > 1 ? 's' : ''}</p>
      </div>

      {/* Filtres */}
      <div className="bg-theme-card border border-theme-border rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Rechercher..."
            value={filtreSearch}
            onChange={e => { setFiltreSearch(e.target.value); setPage(1) }}
            className="input-field text-sm"
          />
          <select
            value={filtreAction}
            onChange={e => { setFiltreAction(e.target.value); setPage(1) }}
            className="input-field text-sm"
          >
            <option value="">Toutes les actions</option>
            {ACTIONS.filter(Boolean).map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
            ))}
          </select>
          <select
            value={filtreResource}
            onChange={e => { setFiltreResource(e.target.value); setPage(1) }}
            className="input-field text-sm"
          >
            <option value="">Tous les types</option>
            {RESOURCES.filter(Boolean).map(r => (
              <option key={r} value={r}>{RESOURCE_LABELS[r] ?? r}</option>
            ))}
          </select>
          <input
            type="date"
            value={filtreDebut}
            onChange={e => { setFiltreDebut(e.target.value); setPage(1) }}
            className="input-field text-sm"
          />
          <input
            type="date"
            value={filtreFin}
            onChange={e => { setFiltreFin(e.target.value); setPage(1) }}
            className="input-field text-sm"
          />
        </div>
        {(filtreAction || filtreResource || filtreSearch || filtreDebut || filtreFin) && (
          <button onClick={resetFiltres} className="mt-3 text-xs text-theme-secondary hover:text-theme-primary flex items-center gap-1">
            <Icon name="close" size="xs" /> Effacer les filtres
          </button>
        )}
      </div>

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{erreur}</div>
      )}

      {/* Tableau */}
      <div className="bg-theme-card border border-theme-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-theme-secondary">Date</th>
                <th className="text-left px-4 py-3 font-medium text-theme-secondary">Utilisateur</th>
                <th className="text-left px-4 py-3 font-medium text-theme-secondary">Action</th>
                <th className="text-left px-4 py-3 font-medium text-theme-secondary">Type</th>
                <th className="text-left px-4 py-3 font-medium text-theme-secondary">Ressource</th>
              </tr>
            </thead>
            <tbody>
              {chargement ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-theme-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
                      Chargement...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-theme-secondary">Aucune activité trouvée</td>
                </tr>
              ) : (
                logs.map(log => {
                  const actionInfo = ACTION_LABELS[log.action]
                  return (
                    <tr key={log.id} className="border-b border-theme-border/50 hover:bg-theme-muted/30 transition-colors">
                      <td className="px-4 py-3 text-theme-secondary whitespace-nowrap">{formaterDate(log.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-theme-primary">{log.utilisateur_nom_complet || log.utilisateur}</div>
                        <div className="text-xs text-theme-secondary">{log.utilisateur}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionInfo?.color ?? 'bg-gray-100 text-gray-600'}`}>
                          {actionInfo?.label ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-theme-secondary">{RESOURCE_LABELS[log.resource_type] ?? log.resource_type}</td>
                      <td className="px-4 py-3">
                        <div className="text-theme-primary truncate max-w-xs" title={log.resource_name}>{log.resource_name || '—'}</div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="text-xs text-theme-secondary mt-0.5">
                            {Object.entries(log.details)
                              .filter(([, v]) => v !== null && v !== undefined && v !== '')
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border">
            <span className="text-sm text-theme-secondary">
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  )
}
