'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { apiFetchJson } from '@/lib/api'
import { getUtilisateurActif } from '@/lib/session'

interface TokensParUtilisateur {
  utilisateur_id: string
  nom_utilisateur: string
  nom_complet: string
  tokens_used: number
  limit: number
  percentage: number
}

interface UsageMensuel {
  year_month: string
  total_tokens: number
}

interface LlmHistoryItem {
  id: number
  utilisateur: {
    id: string
    nom_utilisateur: string
    nom_complet: string
  }
  timestamp: string
  provider: string
  model: string
  purpose: string
  tokens_input: number
  tokens_output: number
  tokens_total: number
}

interface AdminStats {
  tokens_par_utilisateur: TokensParUtilisateur[]
  usage_mensuel: UsageMensuel[]
  top_utilisateurs: TokensParUtilisateur[]
  total_tokens: number
  current_month: string
}

interface AssistantHealth {
  provider: string
  llm_enabled: boolean
  config_ok: boolean
  errors: string[]
  semantic_search_available: boolean
}

export default function AdminLlmPage() {
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [history, setHistory] = useState<LlmHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'history'>('overview')
  const [filterUser, setFilterUser] = useState<string>('')
  const [filterProvider, setFilterProvider] = useState<string>('')
  const [filterPurpose, setFilterPurpose] = useState<string>('')
  const [health, setHealth] = useState<AssistantHealth | null>(null)

  useEffect(() => {
    const user = getUtilisateurActif()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'ARCHIVISTE')) {
      router.push('/tableau-de-bord')
      return
    }

    const fetchData = async () => {
      try {
        const [statsData, historyData, healthData] = await Promise.all([
          apiFetchJson<AdminStats>('assistant/llm/admin/stats/'),
          apiFetchJson<{ history: LlmHistoryItem[] }>('assistant/llm/admin/history/?limit=100'),
          apiFetchJson<AssistantHealth>('assistant/health/'),
        ])
        if (statsData.data) setStats(statsData.data)
        if (historyData.data) setHistory(historyData.data.history)
        if (healthData.data) setHealth(healthData.data)
      } catch (error) {
        console.error('Erreur lors du chargement des stats LLM ou de l\'état technique:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const safeHistory = Array.isArray(history) ? history : []
  const filteredHistory = safeHistory.filter((item) => {
    if (filterUser && !item.utilisateur.nom_complet.toLowerCase().includes(filterUser.toLowerCase())) {
      return false
    }
    if (filterProvider && item.provider !== filterProvider) {
      return false
    }
    if (filterPurpose && item.purpose !== filterPurpose) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary mx-auto mb-4"></div>
          <p className="text-theme-secondary">Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-theme-base flex items-center justify-center">
        <p className="text-theme-secondary">Impossible de charger les statistiques</p>
      </div>
    )
  }

  // Sécuriser les tableaux statistiques pour éviter les erreurs runtime
  const safeTokensParUtilisateur = Array.isArray(stats.tokens_par_utilisateur)
    ? stats.tokens_par_utilisateur
    : []
  const safeUsageMensuel = Array.isArray(stats.usage_mensuel) ? stats.usage_mensuel : []
  const safeTopUtilisateurs = Array.isArray(stats.top_utilisateurs) ? stats.top_utilisateurs : []

  return (
    <div className="min-h-screen bg-theme-base">
      {/* Header */}
      <header className="bg-theme-card border-b border-theme shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/tableau-de-bord')}
                className="p-2 hover:bg-theme-base rounded-lg transition-colors"
              >
                <Icon name="arrow-left" size="sm" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-theme-primary">Statistiques LLM</h1>
                <p className="text-sm text-theme-secondary">Gestion des quotas et usage de l'assistant IA</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-theme-secondary">Mois actuel</p>
              <p className="text-lg font-semibold text-theme-primary">{stats.current_month}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-2 border-b border-theme">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-theme-primary border-b-2 border-theme-primary'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-theme-primary border-b-2 border-theme-primary'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Par utilisateur
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-theme-primary border-b-2 border-theme-primary'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Historique
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* État technique de l'assistant */}
            <div className="bg-theme-card border border-theme rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-theme-primary mb-1">État technique de l'assistant</h2>
                {health ? (
                  <p className="text-sm text-theme-secondary">
                    Provider&nbsp;: <span className="font-medium text-theme-primary">{health.provider}</span>
                    {' · '}LLM activé&nbsp;: <span className="font-medium">{health.llm_enabled ? 'Oui' : 'Non'}</span>
                    {' · '}Recherche sémantique&nbsp;: <span className="font-medium">{health.semantic_search_available ? 'Disponible' : 'Désactivée'}</span>
                  </p>
                ) : (
                  <p className="text-sm text-theme-secondary">Impossible de charger l'état technique de l'assistant.</p>
                )}
                {health && health.errors && health.errors.length > 0 && (
                  <ul className="mt-2 text-xs text-red-500 list-disc list-inside">
                    {health.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-2">
                {health ? (
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                      health.config_ok
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        health.config_ok ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    {health.config_ok ? 'Configuration LLM opérationnelle' : 'Configuration LLM à vérifier'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    État technique inconnu
                  </span>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-theme-card border border-theme rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-theme-secondary">Total tokens (tous temps)</p>
                    <p className="text-3xl font-bold text-theme-primary mt-2">
                      {(typeof stats.total_tokens === 'number' && Number.isFinite(stats.total_tokens)
                        ? stats.total_tokens
                        : 0
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Icon name="bolt" size="lg" className="text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-theme-card border border-theme rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-theme-secondary">Utilisateurs actifs (ce mois)</p>
                    <p className="text-3xl font-bold text-theme-primary mt-2">
                      {safeTokensParUtilisateur.length}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Icon name="users" size="lg" className="text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-theme-card border border-theme rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-theme-secondary">Tokens ce mois</p>
                    <p className="text-3xl font-bold text-theme-primary mt-2">
                      {safeUsageMensuel[0]?.total_tokens?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Icon name="sparkles" size="lg" className="text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Top utilisateurs */}
            <div className="bg-theme-card border border-theme rounded-lg p-6">
              <h2 className="text-lg font-semibold text-theme-primary mb-4">
                Top 10 utilisateurs (ce mois)
              </h2>
              <div className="space-y-3">
                {safeTopUtilisateurs.map((user, index) => (
                  <div key={user.utilisateur_id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-theme-primary">{user.nom_complet}</p>
                      <p className="text-xs text-theme-secondary">{user.nom_utilisateur}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-theme-primary">
                        {user.tokens_used.toLocaleString()} tokens
                      </p>
                      <p className="text-xs text-theme-secondary">
                        {(user.percentage * 100).toFixed(1)}% du quota
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage mensuel */}
            <div className="bg-theme-card border border-theme rounded-lg p-6">
              <h2 className="text-lg font-semibold text-theme-primary mb-4">Usage mensuel</h2>
              <div className="space-y-2">
                {safeUsageMensuel.map((month) => (
                  <div key={month.year_month} className="flex items-center justify-between py-2 border-b border-theme last:border-0">
                    <span className="text-sm font-medium text-theme-primary">{month.year_month}</span>
                    <span className="text-sm text-theme-secondary">
                      {month.total_tokens.toLocaleString()} tokens
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-theme-card border border-theme rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-theme">
                <thead className="bg-theme-base">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                      Tokens utilisés
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                      Limite
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                      Utilisation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-theme-card divide-y divide-theme">
                  {safeTokensParUtilisateur.map((user) => (
                    <tr key={user.utilisateur_id} className="hover:bg-theme-base transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-theme-primary">{user.nom_complet}</div>
                          <div className="text-xs text-theme-secondary">{user.nom_utilisateur}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-primary">
                        {user.tokens_used.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-secondary">
                        {user.limit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${
                                user.percentage >= 0.95
                                  ? 'bg-red-500'
                                  : user.percentage >= 0.8
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(user.percentage * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-theme-primary">
                            {(user.percentage * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Filtres */}
            <div className="bg-theme-card border border-theme rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    Utilisateur
                  </label>
                  <input
                    type="text"
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full px-3 py-2 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    Provider
                  </label>
                  <select
                    value={filterProvider}
                    onChange={(e) => setFilterProvider(e.target.value)}
                    className="w-full px-3 py-2 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary"
                  >
                    <option value="">Tous</option>
                    <option value="mistral">Mistral</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    Purpose
                  </label>
                  <select
                    value={filterPurpose}
                    onChange={(e) => setFilterPurpose(e.target.value)}
                    className="w-full px-3 py-2 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary"
                  >
                    <option value="">Tous</option>
                    <option value="router">Router</option>
                    <option value="answer">Answer</option>
                    <option value="summary">Summary</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tableau historique */}
            <div className="bg-theme-card border border-theme rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-theme">
                  <thead className="bg-theme-base">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                        Date/Heure
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                        Modèle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                        Purpose
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">
                        Tokens
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-theme-card divide-y divide-theme">
                    {filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-theme-base transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-primary">
                          {new Date(item.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-theme-primary">
                            {item.utilisateur.nom_complet}
                          </div>
                          <div className="text-xs text-theme-secondary">
                            {item.utilisateur.nom_utilisateur}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {item.provider}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-secondary">
                          {item.model}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              item.purpose === 'answer'
                                ? 'bg-green-100 text-green-800'
                                : item.purpose === 'router'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.purpose}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-theme-primary">
                            <span className="font-medium">{item.tokens_total}</span>
                            <span className="text-theme-secondary text-xs ml-1">
                              ({item.tokens_input}→{item.tokens_output})
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredHistory.length === 0 && (
                <div className="text-center py-8 text-theme-secondary">
                  Aucun résultat trouvé
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
