'use client'

import Link from 'next/link'
import { FormEvent, ReactElement, ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { getToken, getUtilisateurActif, SessionUtilisateur, supprimerSession } from '@/lib/session'

type ReponseType = 'documents' | 'statistiques'

interface PieceJustificative {
  id: string
  source: string
  content: string
  metadata: Record<string, unknown>
  score: number
  isFallback?: boolean
}

interface ReponseAssistant {
  question: string
  type: ReponseType
  resume: string
  pieces?: PieceJustificative[]
  statistiques?: {
    documents_par_mois: Record<string, number>
    top_categories: { categorie: string; compte: number }[]
    top_clients?: { client: string; compte: number }[]
    kpi?: {
      taux_conformite: number
      documents_en_retard: number
      alertes_peremption: number
    }
  }
  insights?: string[]
  actions?: string[]
  narration?: {
    texte: string
    source: 'llm' | 'heuristique'
    telemetry?: {
      provider: string
      model: string
      durationMs: number
      tokensInput?: number
      tokensOutput?: number
    }
  }
  restriction?: {
    reason: 'PERMISSION_DENIED'
    role?: string | null
  }
}

const QUESTION_SUGGESTIONS = [
  'Quels documents concernent la responsabilité civile ?',
  'Quels sont les documents ajoutés cette semaine ?',
  'Montre-moi les pièces liées au client SANLAM.'
]

type SectionCardProps = {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  children: ReactNode
  badge?: ReactNode
  testId?: string
}

function SectionCard({ icon, title, badge, children, testId }: SectionCardProps) {
  return (
    <article
      data-testid={testId}
      className="bg-white rounded-2xl shadow p-6 space-y-4 border border-gray-100"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-blue-600 text-white shadow-sm">
            <Icon name={icon} size="sm" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        {badge ? <div className="flex-shrink-0">{badge}</div> : null}
      </header>
      <div className="space-y-3 text-gray-800">{children}</div>
    </article>
  )
}

function formatMetadataLabel(value: unknown, label: string, key?: string) {
  const text =
    typeof value === 'number'
      ? value.toString()
      : typeof value === 'string'
      ? replaceCategorieTerminology(value.trim())
      : null
  if (!text) return null
  return (
    <span
      key={key ?? label}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
    >
      <Icon name="tag" size="xs" />
      <span className="font-medium capitalize">{label.toLowerCase()}</span>
      <span className="text-gray-700">{text}</span>
    </span>
  )
}

const isNotNull = <T,>(value: T | null): value is T => value !== null

function replaceCategorieTerminology(value: string): string {
  return value.replace(/cat[ée]gori(e|es)/gi, (match) => {
    const isPlural = match.toLowerCase().endsWith('es')
    const replacement = isPlural ? 'thématiques' : 'thématique'
    if (match === match.toUpperCase()) {
      return replacement.toUpperCase()
    }
    if (match[0] === match[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1)
    }
    return replacement
  })
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return replaceCategorieTerminology(trimmed)
}

function normalizeHighlights(highlights: unknown): string[] {
  if (!Array.isArray(highlights)) return []
  return highlights
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => replaceCategorieTerminology(entry).trim())
    .filter((entry) => entry.length > 0)
}

type MetadataDetail = {
  label: string
  value: string
}

function formatMetadataValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'string') return sanitizeText(value)
  return null
}

function getPieceDetails(metadata: Record<string, unknown> | undefined): MetadataDetail[] {
  if (!metadata) return []

  const details: MetadataDetail[] = []
  const addDetail = (label: string, raw: unknown) => {
    const formatted = formatMetadataValue(raw)
    if (formatted) {
      details.push({ label, value: formatted })
    }
  }

  addDetail('Référence', metadata.reference)
  if (typeof metadata.statut_archive === 'boolean') {
    details.push({ label: 'Statut', value: metadata.statut_archive ? 'Archivé' : 'Disponible' })
  } else {
    addDetail('Statut', metadata.statut_archive)
  }
  addDetail('Dernière mise à jour', metadata.derniere_mise_a_jour_formatee ?? metadata.derniere_mise_a_jour)

  return details
}

function getPieceTitle(piece: PieceJustificative, index: number): string {
  const raw = piece.metadata?.titre
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim()
  }
  return `Document ${index + 1}`
}

function getPieceSubtitle(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  const description = metadata.description
  return sanitizeText(description)
}

function buildMetadataBadges(piece: PieceJustificative): ReactElement[] {
  const metadata = piece.metadata ?? {}
  const dateValue =
    (metadata.date_document_formatee as string | undefined) ??
    (metadata.date_document as string | undefined) ??
    (metadata.date as string | undefined)

  return [
    formatMetadataLabel(metadata.client, 'Client', `client-${piece.id}`),
    formatMetadataLabel(metadata.exercice, 'Exercice', `exercice-${piece.id}`),
    formatMetadataLabel(metadata.type, 'Type', `type-${piece.id}`),
    formatMetadataLabel(dateValue, 'Date', `date-${piece.id}`),
  ].filter(isNotNull)
}

export default function AssistantDemoPage() {
  const [question, setQuestion] = useState('Quels documents concernent la responsabilité civile ?')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [reponse, setReponse] = useState<ReponseAssistant | null>(null)
  const [utilisateur, setUtilisateur] = useState<SessionUtilisateur | null>(null)
  const router = useRouter()

  useEffect(() => {
    setUtilisateur(getUtilisateurActif())
  }, [])

  const gererDeconnexion = () => {
    supprimerSession()
    router.push('/connexion')
  }

  const interrogerAssistant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const propre = question.trim()
    if (!propre) {
      setErreur('Merci de saisir une question.')
      return
    }
    setChargement(true)
    setErreur(null)
    setReponse(null)

    try {
      const token = getToken()
      const utilisateur = getUtilisateurActif()
      const response = await fetch('/api/assistant-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(utilisateur?.role ? { 'x-user-role': utilisateur.role } : {}),
        },
        body: JSON.stringify({ question: propre }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.erreur ?? 'Erreur inconnue')
      }

      setReponse(payload as ReponseAssistant)
    } catch (error) {
      console.error('Assistant demo', error)
      setErreur((error as Error).message)
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-10">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}
            >
              {(utilisateur?.prenom?.[0] ?? utilisateur?.nom?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Connecté en tant que</p>
              <p className="text-lg font-semibold text-gray-900">
                {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : 'Consultant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/parametres"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-100 transition-colors"
            >
              <Icon name="settings" size="sm" />
              Mes paramètres
            </Link>
            <button
              type="button"
              onClick={gererDeconnexion}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium shadow-sm hover:bg-black transition-colors"
            >
              <Icon name="logout" size="sm" />
              Se déconnecter
            </button>
          </div>
        </header>

        <div className="max-w-3xl mx-auto space-y-8">
          <header className="text-center space-y-3">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent">
              Assistant IA (démo)
            </h1>
            <p className="text-gray-600">
              Découvrez rapidement les documents disponibles en posant une question en langage naturel.
            </p>
          </header>

          <section className="bg-white rounded-2xl shadow-lg p-6">
            <form onSubmit={interrogerAssistant} className="space-y-4">
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                  Votre question
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={3}
                  placeholder="Exemple : Quels documents dois-je envoyer au client SANLAM pour 2024 ?"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {QUESTION_SUGGESTIONS.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => setQuestion(suggestion)}
                    className="px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={chargement}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  <Icon name="sparkles" size="sm" />
                  {chargement ? 'Recherche…' : 'Interroger'}
                </button>
              </div>
            </form>

            {erreur ? (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {erreur}
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            {reponse ? (
              <div className="space-y-5">
                {reponse.restriction?.reason === 'PERMISSION_DENIED' ? (
                  <SectionCard icon="lock" title="Accès restreint">
                    <p className="text-sm text-gray-600">{reponse.resume}</p>
                  </SectionCard>
                ) : (
                  <SectionCard
                    icon={reponse.type === 'documents' ? 'folder' : 'chart'}
                    title={reponse.type === 'documents' ? 'Synthèse documentaire' : 'Synthèse des indicateurs'}
                    badge={
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        <Icon name={reponse.type === 'documents' ? 'document' : 'chart'} size="xs" />
                        {reponse.type === 'documents' ? 'Documents' : 'Statistiques'}
                      </span>
                    }
                  >
                    <p className="leading-relaxed whitespace-pre-line">{reponse.resume}</p>
                    {reponse.narration?.texte && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-2">
                        <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
                          <Icon name={reponse.narration.source === 'llm' ? 'sparkles' : 'shield'} size="xs" />
                          {reponse.narration.source === 'llm' ? 'Réponse générée par l’IA' : 'Synthèse automatique'}
                        </div>
                        <p className="whitespace-pre-line">{reponse.narration.texte}</p>
                      </div>
                    )}
                  </SectionCard>
                )}

                {!reponse.restriction && reponse.insights?.length ? (
                  <SectionCard icon="star" title="Points marquants" testId="assistant-insights">
                    <ul className="space-y-1 text-sm text-gray-700">
                      {reponse.insights.map((insight) => (
                        <li key={insight} className="flex items-start gap-2">
                          <Icon name="check" size="xs" className="mt-1 text-green-500" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                ) : null}

                {!reponse.restriction && reponse.actions?.length ? (
                  <SectionCard icon="bolt" title="Actions recommandées" testId="assistant-actions">
                    <ul className="space-y-1 text-sm text-gray-700">
                      {reponse.actions.map((action) => (
                        <li key={action}>{replaceCategorieTerminology(action)}</li>
                      ))}
                    </ul>
                  </SectionCard>
                ) : null}

                {!reponse.restriction && reponse.type === 'documents' && reponse.pieces && reponse.pieces.length > 0 ? (
                  <SectionCard icon="document" title="Pièces justificatives">
                    <div className="space-y-4">
                      {reponse.pieces.map((piece, index) => {
                        const titre = replaceCategorieTerminology(getPieceTitle(piece, index))
                        const sousTitre = getPieceSubtitle(piece.metadata)
                        const badges = buildMetadataBadges(piece)
                        const highlights = normalizeHighlights(piece.metadata?.highlights)
                        const details = getPieceDetails(piece.metadata)

                        return (
                          <article
                            key={piece.id}
                            data-testid="assistant-piece"
                            className="rounded-2xl border border-gray-200 p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                                  {replaceCategorieTerminology(piece.source)}
                                </span>
                                {piece.isFallback ? (
                                  <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-medium">
                                    <Icon name="clock" size="xs" />
                                    Document récent
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-xs text-gray-400">Score : {piece.score.toFixed(3)}</span>
                            </div>

                            <header className="space-y-1">
                              <h3 className="text-base font-semibold text-gray-900">{titre}</h3>
                              {sousTitre ? (
                                <p className="text-sm text-gray-600">{replaceCategorieTerminology(sousTitre)}</p>
                              ) : null}
                            </header>

                            {badges.length ? <div className="flex flex-wrap gap-2">{badges}</div> : null}

                            <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                              {replaceCategorieTerminology(piece.content)}
                            </p>

                            {highlights.length ? (
                              <ul data-testid="assistant-piece-metadata" className="flex flex-wrap gap-2 text-xs text-gray-600">
                                {highlights.map((element, highlightIndex) => (
                                  <li
                                    key={`${piece.id}-highlight-${highlightIndex}`}
                                    className="px-2 py-1 bg-gray-100 rounded-full border border-gray-200"
                                  >
                                    {element}
                                  </li>
                                ))}
                              </ul>
                            ) : null}

                          {details.length ? (
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600">
                              {details.map((detail) => (
                                <div key={`${piece.id}-${detail.label}`}>
                                  <dt className="font-semibold text-gray-700">{detail.label}</dt>
                                  <dd>{detail.value}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                </SectionCard>
              ) : null}

              {!reponse.restriction && reponse.type === 'statistiques' && reponse.statistiques ? (
                <SectionCard icon="chart" title="Indicateurs détaillés">
                  {reponse.statistiques.kpi ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs text-blue-500 uppercase">Taux de conformité</p>
                        <p className="text-lg font-semibold text-blue-800">
                          {(reponse.statistiques.kpi.taux_conformite * 100).toFixed(1)} %
                        </p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3">
                          <p className="text-xs text-rose-500 uppercase">Alertes péremption</p>
                          <p className="text-lg font-semibold text-rose-700">
                            {reponse.statistiques.kpi.alertes_peremption}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {reponse.statistiques.top_categories?.length ? (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Top thématiques</p>
                        <ul className="space-y-1 text-sm text-gray-700">
                          {reponse.statistiques.top_categories.map((element) => (
                            <li key={element.categorie} className="flex justify-between">
                              <span>{replaceCategorieTerminology(element.categorie)}</span>
                              <span className="font-semibold">{element.compte}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {reponse.statistiques.top_clients?.length ? (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Top clients</p>
                        <ul className="space-y-1 text-sm text-gray-700">
                          {reponse.statistiques.top_clients.map((client) => (
                            <li key={client.client} className="flex justify-between">
                              <span>{client.client}</span>
                              <span className="font-semibold">{client.compte}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {Object.keys(reponse.statistiques.documents_par_mois ?? {}).length ? (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-2">Volume par mois</p>
                        <ul className="space-y-1 text-sm text-gray-700">
                          {Object.entries(reponse.statistiques.documents_par_mois).map(([mois, total]) => (
                            <li key={mois} className="flex justify-between">
                              <span>{mois}</span>
                              <span className="font-semibold">{total}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </SectionCard>
                ) : null}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                {chargement ? 'Recherche en cours…' : "Aucune réponse pour l'instant."}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
