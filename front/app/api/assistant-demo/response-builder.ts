/**
 * 🏗️ Module de construction des réponses de l'assistant
 * - Construction des résumés (documents, statistiques)
 * - Génération des insights et actions
 * - Gestion des tons de réponse
 */

import type { DocumentPiece, Statistiques } from './types'

// ============================================================================
// CONFIGURATION DES TONS
// ============================================================================

export type ToneType = 'amical' | 'formel' | 'concis' | 'premium'

export interface ToneConfig {
  greeting: string
  noResults: string
  singleResult: string
  multipleResults: string
  statsIntro: string
}

export const TONES: Record<ToneType, ToneConfig> = {
  amical: {
    greeting: 'Salut ! 👋',
    noResults: "Je n'ai pas trouvé de documents correspondant à ta recherche. 🔍\n\nEssaie avec d'autres mots-clés ou vérifie l'orthographe du client.",
    singleResult: "J'ai trouvé ce document pour toi :",
    multipleResults: "Voici les documents que j'ai trouvés :",
    statsIntro: 'Voici les statistiques demandées :',
  },
  formel: {
    greeting: 'Bonjour.',
    noResults: "Aucun document ne correspond à votre recherche. Veuillez reformuler ou vérifier les critères.",
    singleResult: "Un document correspond à votre recherche :",
    multipleResults: "Voici les documents correspondant à votre recherche :",
    statsIntro: 'Veuillez trouver ci-dessous les statistiques demandées :',
  },
  concis: {
    greeting: '',
    noResults: "Aucun résultat.",
    singleResult: "1 document trouvé :",
    multipleResults: "Documents trouvés :",
    statsIntro: 'Statistiques :',
  },
  premium: {
    greeting: 'Bonjour ! ✨',
    noResults: "Je n'ai malheureusement pas trouvé de documents correspondant à votre recherche. Puis-je vous aider autrement ?",
    singleResult: "J'ai identifié un document pertinent pour vous :",
    multipleResults: "J'ai sélectionné les documents les plus pertinents pour vous :",
    statsIntro: 'Voici une synthèse des indicateurs clés :',
  },
}

// ============================================================================
// CONSTRUCTION DES INSIGHTS
// ============================================================================

/**
 * Construit les insights à partir des documents trouvés
 */
export function construireInsightsDocuments(pieces: DocumentPiece[]): string[] {
  if (!pieces.length) return []

  const insights: string[] = []

  // Compter les clients
  const clientsMap = new Map<string, number>()
  for (const piece of pieces) {
    const client = piece.metadata?.client as string | undefined
    if (client) {
      clientsMap.set(client, (clientsMap.get(client) ?? 0) + 1)
    }
  }

  if (clientsMap.size > 0) {
    const topClient = [...clientsMap.entries()].sort((a, b) => b[1] - a[1])[0]
    insights.push(`Client le plus représenté : ${topClient[0]} (${topClient[1]} document${topClient[1] > 1 ? 's' : ''}).`)
  }

  // Nombre de pièces
  insights.push(`Nombre de pièces pertinentes identifiées : ${pieces.length}.`)

  // Score moyen
  const avgScore = pieces.reduce((sum, p) => sum + (p.score ?? 0), 0) / pieces.length
  if (avgScore > 0.8) {
    insights.push('Pertinence élevée des résultats.')
  } else if (avgScore > 0.5) {
    insights.push('Pertinence moyenne des résultats.')
  }

  return insights
}

/**
 * Construit les actions suggérées à partir des documents
 */
export function construireActionsDocuments(pieces: DocumentPiece[]): string[] {
  if (!pieces.length) {
    return ['Essayez de reformuler votre recherche avec des termes différents.']
  }

  const actions: string[] = []

  // Vérifier les documents récents
  const hasRecent = pieces.some((p) => {
    const date = p.metadata?.date_document as string | undefined
    if (!date) return false
    const docDate = new Date(date)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return docDate > thirtyDaysAgo
  })

  if (hasRecent) {
    actions.push('Documents récents détectés - vérifier leur traitement.')
  }

  // Vérifier les avenants
  const hasAvenants = pieces.some((p) => {
    const type = (p.metadata?.type_courrier as string)?.toLowerCase()
    return type?.includes('avenant')
  })

  if (hasAvenants) {
    actions.push('Avenants présents - vérifier leur application.')
  }

  if (actions.length === 0) {
    actions.push('Aucune action urgente détectée sur les pièces proposées.')
  }

  return actions
}

// ============================================================================
// CONSTRUCTION DES STATISTIQUES
// ============================================================================

/**
 * Construit les insights à partir des statistiques
 */
export function construireInsightsStatistiques(statistiques: Statistiques): string[] {
  const insights: string[] = []

  // Top clients
  if (statistiques.top_clients?.length) {
    const topClients = statistiques.top_clients
      .slice(0, 3)
      .map((c) => `${c.client} (${c.compte})`)
      .join(', ')
    insights.push(`Top clients : ${topClients}.`)
  }

  // Tendance mensuelle
  const mois = Object.entries(statistiques.documents_par_mois || {})
  if (mois.length >= 2) {
    const dernierMois = mois[mois.length - 1][1]
    const avantDernier = mois[mois.length - 2][1]
    const diff = dernierMois - avantDernier
    if (diff > 0) {
      insights.push(`Tendance : +${diff} documents ce mois-ci.`)
    } else if (diff < 0) {
      insights.push(`Tendance : ${diff} documents ce mois-ci.`)
    }
  }

  // KPI
  if (statistiques.kpi) {
    const { taux_conformite, documents_en_retard } = statistiques.kpi
    if (taux_conformite < 0.9) {
      insights.push(`⚠️ Taux de conformité bas (${(taux_conformite * 100).toFixed(0)}%).`)
    }
    if (documents_en_retard > 0) {
      insights.push(`⚠️ ${documents_en_retard} document(s) en retard.`)
    }
  }

  return insights
}

/**
 * Construit les actions suggérées à partir des statistiques
 */
export function construireActionsStatistiques(statistiques: Statistiques): string[] {
  const actions: string[] = []

  if (statistiques.kpi) {
    const { taux_conformite, documents_en_retard, alertes_peremption } = statistiques.kpi

    if (documents_en_retard > 0) {
      actions.push('Prioriser le traitement des documents en retard.')
    }

    if (alertes_peremption > 0) {
      actions.push(`Vérifier les ${alertes_peremption} alerte(s) de péremption.`)
    }

    if (taux_conformite < 0.9) {
      actions.push('Améliorer le taux de conformité (objectif : 90%).')
    }
  }

  if (actions.length === 0) {
    actions.push('Aucune action urgente requise.')
  }

  return actions
}

/**
 * Construit le résumé des statistiques
 */
export function construireResumeStatistiques(
  statistiques: Statistiques,
  tone: ToneType = 'amical'
): string {
  const toneConfig = TONES[tone]
  const lines: string[] = [toneConfig.statsIntro]

  // KPI principaux
  if (statistiques.kpi) {
    const { taux_conformite, documents_en_retard, alertes_peremption } = statistiques.kpi
    lines.push(`• Taux de conformité : ${(taux_conformite * 100).toFixed(1)}%`)
    lines.push(`• Documents en retard : ${documents_en_retard}`)
    lines.push(`• Alertes de péremption : ${alertes_peremption}`)
  }

  // Total documents
  const totalDocs = Object.values(statistiques.documents_par_mois || {}).reduce((a, b) => a + b, 0)
  if (totalDocs > 0) {
    lines.push(`• Total documents (période) : ${totalDocs}`)
  }

  return lines.join('\n')
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formate une date pour l'affichage
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Tronque un texte avec ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}
