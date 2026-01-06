import type { RoleUtilisateur } from '@/types'

export type Statistiques = {
  documents_par_mois: Record<string, number>
  top_clients?: { client: string; compte: number }[]
  kpi?: {
    taux_conformite: number
    documents_en_retard: number
    alertes_peremption: number
  }
  totaux_clients?: {
    total: number
    particuliers: number
    entreprises: number
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

export type AssistantRestrictionReason = 'PERMISSION_DENIED' | 'PROMPT_INJECTION' | 'PII_DETECTED'

export type AssistantRestriction = {
  reason: AssistantRestrictionReason
  role?: RoleUtilisateur | null
  details?: string
}


export type AssistantTrace = {
  mode?:
    | 'recherche_document'
    | 'hors_perimetre'
    | 'salutation'
    | 'confirmation'
    | 'statistiques'
  intent: 'documents' | 'statistiques'
  typeMessage?: string
  criteres?: {
    client?: string | null
    annee?: string | null
    risque?: string | null
    typeDocument?: string | null
  }
  documentSearch?: {
    totalFound: number
    filteredFound: number
    messageNonTrouve: boolean
    criteresUtilises?: Record<string, unknown>
    criteresNonTrouves?: string[]
  }
  llm?: {
    used: boolean
    provider?: string
    model?: string
    durationMs?: number
  }
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
  // Système d'apprentissage
  interactionId?: string  // ID pour le feedback utilisateur (👍/👎)
  // Traçabilité métier de la réponse
  trace?: AssistantTrace
}
