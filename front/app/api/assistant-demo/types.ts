import type { RoleUtilisateur } from '@/types'

export type Statistiques = {
  documents_par_mois: Record<string, number>
  top_categories: { categorie: string; compte: number }[]
  top_clients?: { client: string; compte: number }[]
  kpi?: {
    taux_conformite: number
    documents_en_retard: number
    alertes_peremption: number
  }
}

export type DocumentPiece = {
  id: string
  source: string
  content: string
  metadata: Record<string, unknown>
  score: number
  isFallback?: boolean
}

export type AssistantNarration = {
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

export type AssistantRestriction = {
  reason: 'PERMISSION_DENIED'
  role?: RoleUtilisateur | null
}

export type AssistantResponse = {
  question: string
  type: 'documents' | 'statistiques'
  resume: string
  pieces?: DocumentPiece[]
  statistiques?: Statistiques
  insights?: string[]
  actions?: string[]
  narration?: AssistantNarration
  restriction?: AssistantRestriction
}
