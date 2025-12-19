/**
 * 📝 Module de génération de narration pour l'assistant
 * - Construction des réponses textuelles
 * - Tons de réponse (amical, formel, concis, premium)
 * - Insights et actions sur les documents
 */

import type { DocumentPiece, Statistiques } from './types'
import type { CriteresRecherche } from './criteria'

// ============================================================================
// CONFIGURATION DES TONS
// ============================================================================

export const TONES = {
  amical: {
    intro: (nb: number) => `J'ai retrouvé ${nb === 1 ? 'un document' : `${nb} documents`} qui pourrai${nb > 1 ? 'ent' : 't'} vous être utile${nb > 1 ? 's' : ''}.`,
    conclusion: "\n\nVous pouvez les consulter ou les télécharger à tout moment.\n\nSi vous avez besoin d'aide pour un autre document ou pour effectuer une recherche, je suis là pour ça !",
    noResults: "Je n'ai trouvé aucun document correspondant à votre recherche.\n\nVoulez-vous reformuler votre question ou essayer avec d'autres mots-clés ? Je suis là pour vous aider !",
    useEmojis: true,
  },
  formel: {
    intro: (nb: number) => `${nb} document${nb > 1 ? 's' : ''} correspondant${nb > 1 ? 's' : ''} à votre recherche ${nb > 1 ? 'ont été identifiés' : 'a été identifié'}.`,
    conclusion: "\n\nCes documents sont disponibles pour consultation et téléchargement. Pour toute assistance supplémentaire, n'hésitez pas à formuler une nouvelle requête.",
    noResults: "Aucun document ne correspond aux critères de recherche spécifiés. Veuillez reformuler votre demande avec des termes différents.",
    useEmojis: false,
  },
  concis: {
    intro: (nb: number) => `${nb} document${nb > 1 ? 's' : ''} trouvé${nb > 1 ? 's' : ''}.`,
    conclusion: '\n\nDisponible au téléchargement.',
    noResults: "Aucun résultat. Reformulez votre recherche.",
    useEmojis: false,
  },
  premium: {
    intro: (nb: number) => `Nous avons identifié ${nb} document${nb > 1 ? 's' : ''} pertinent${nb > 1 ? 's' : ''} pour votre demande.`,
    conclusion: "\n\nCes documents sont à votre disposition pour consultation immédiate ou téléchargement sécurisé.\n\nNotre assistant reste à votre écoute pour toute recherche complémentaire ou assistance personnalisée.",
    noResults: "Aucun document ne correspond actuellement à votre recherche.\n\nNous vous invitons à affiner vos critères ou à nous solliciter pour une assistance personnalisée.",
    useEmojis: true,
  },
} as const

export type ToneName = keyof typeof TONES

// ============================================================================
// CONSTANTES
// ============================================================================

const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000

// ============================================================================
// GÉNÉRATION DE NARRATION
// ============================================================================

/**
 * Génère une narration simple et directe pour les résultats de recherche
 */
export function genererNarrationSimple(
  pieces: DocumentPiece[], 
  criteres: CriteresRecherche,
  contexte: { client?: string | null; annee?: string | null; risque?: string | null }
): string {
  const nbPieces = pieces.length
  const client = criteres.client || contexte.client
  const annee = criteres.annee || contexte.annee
  const type = criteres.typeDocument
  const risque = criteres.risque || contexte.risque
  
  // Construire une description des critères
  const parties: string[] = []
  if (type) parties.push(type)
  if (annee) parties.push(`de ${annee}`)
  if (client) parties.push(`pour ${client}`)
  if (risque) parties.push(`risque ${risque}`)
  
  const description = parties.length > 0 ? parties.join(' ') : 'correspondant à ta recherche'
  
  if (nbPieces === 0) {
    return `Je n'ai pas trouvé de document ${description} dans les archives.`
  } else if (nbPieces === 1) {
    return `J'ai trouvé 1 document ${description}. Le voici ci-dessous.`
  } else {
    return `J'ai trouvé ${nbPieces} documents ${description}. Les voici ci-dessous.`
  }
}

/**
 * Construit une narration heuristique basée sur l'intention et le résumé
 */
export function construireNarrationHeuristique(
  intent: 'documents' | 'statistiques',
  resume: string,
  insights?: string[],
  actions?: string[]
): string {
  // Pour les documents, le résumé est déjà rédigé dans un ton conversationnel
  if (intent === 'documents') {
    return resume
  }

  // Pour les statistiques, créer une réponse plus humaine et engageante
  let reponse = resume
  
  // Ajouter une analyse personnalisée basée sur les insights
  if (insights && insights.length) {
    const insightText = insights[0]
    if (!resume.includes(insightText)) {
      reponse += `\n\nJ'ai également remarqué que ${insightText.charAt(0).toLowerCase()}${insightText.slice(1)}`
    }
  }
  
  // Ajouter une recommandation basée sur les actions
  if (actions && actions.length) {
    const actionText = actions[0]
    if (actionText.includes('Maintenir la surveillance')) {
      reponse += `\n\nTout semble bien se passer avec votre archivage. Je vous suggère simplement de maintenir votre rigueur actuelle.`
    } else if (actionText.includes('Prioriser')) {
      reponse += `\n\nJe vous recommande de prioriser la mise à jour des documents en retard pour améliorer votre taux de conformité.`
    } else if (actionText.includes('Planifier une revue')) {
      reponse += `\n\nIl serait judicieux de planifier une revue des documents approchant de leur date de péremption.`
    } else if (!resume.includes(actionText)) {
      reponse += `\n\n${actionText}`
    }
  }

  // Ajouter une conclusion personnalisée
  const conclusions = [
    "Souhaitez-vous que j'analyse plus en détail un aspect particulier de ces statistiques ?",
    "Y a-t-il un point spécifique sur lequel vous aimeriez que je me concentre davantage ?",
    "Je peux vous aider à approfondir n'importe quel aspect de ces données si vous le souhaitez.",
    "N'hésitez pas à me demander plus de détails sur un point qui vous intéresse particulièrement."
  ]
  
  const conclusion = conclusions[Math.floor(Math.random() * conclusions.length)]
  reponse += `\n\n${conclusion}`

  return reponse
}

// ============================================================================
// INSIGHTS ET ACTIONS SUR LES DOCUMENTS
// ============================================================================

/**
 * Construit des insights sur les documents trouvés
 */
export function construireInsightsDocuments(pieces: DocumentPiece[]): string[] {
  if (!pieces.length) {
    return []
  }

  const insights: string[] = []
  const clients = new Map<string, number>()

  pieces.forEach((piece) => {
    const metadata = piece.metadata ?? {}
    const client = (metadata.client as string | undefined) ?? 'Client non renseigné'
    clients.set(client, (clients.get(client) ?? 0) + 1)
  })

  if (clients.size) {
    const principal = [...clients.entries()].sort((a, b) => b[1] - a[1])[0]
    if (principal) {
      insights.push(`Client le plus représenté : ${principal[0]} (${principal[1]} document${principal[1] > 1 ? 's' : ''}).`)
    }
  }

  const total = pieces.length
  insights.push(`Nombre de pièces pertinentes identifiées : ${total}.`)

  return insights
}

/**
 * Construit des actions recommandées sur les documents
 */
export function construireActionsDocuments(pieces: DocumentPiece[]): string[] {
  if (!pieces.length) {
    return []
  }

  const actions: string[] = []
  let docsSansDescription = 0
  let docsAnciennete = 0

  const maintenant = Date.now()

  pieces.forEach((piece) => {
    const metadata = piece.metadata ?? {}
    const description = metadata.description as string | null | undefined
    const dateDoc = metadata.date_document as string | null | undefined
    if (!description || description.trim().length < 20) {
      docsSansDescription += 1
    }
    if (dateDoc) {
      const parsed = Date.parse(dateDoc)
      if (!Number.isNaN(parsed) && maintenant - parsed > FIVE_YEARS_MS) {
        docsAnciennete += 1
      }
    }
  })

  if (docsSansDescription) {
    actions.push(`Compléter la description de ${docsSansDescription} document${docsSansDescription > 1 ? 's' : ''} pour faciliter la recherche.`)
  }

  if (docsAnciennete) {
    actions.push(`Revoir la conservation de ${docsAnciennete} document${docsAnciennete > 1 ? 's' : ''} âgé${docsAnciennete > 1 ? 's' : ''} de plus de 5 ans.`)
  }

  if (!actions.length) {
    actions.push("Aucune action urgente détectée sur les pièces proposées. Vérifier que leur indexation reste à jour.")
  }

  return actions
}

/**
 * Génère des suggestions intelligentes basées sur le contexte de recherche
 */
export function genererSuggestionsIntelligentes(
  pieces: DocumentPiece[],
  criteres: CriteresRecherche,
  contexte: { client?: string | null; annee?: string | null; risque?: string | null }
): string[] {
  const suggestions: string[] = []
  
  // Si on a trouvé des documents d'un client, proposer d'autres types de documents
  if (contexte.client && pieces.length > 0) {
    const typesPresents = new Set(pieces.map(p => p.metadata?.type_document).filter(Boolean))
    const typesSuggeres = ['facture', 'avenant', 'contrat', 'sinistre', 'attestation']
    
    for (const type of typesSuggeres) {
      if (!typesPresents.has(type) && suggestions.length < 3) {
        suggestions.push(`Voir les ${type}s de ${contexte.client}`)
      }
    }
  }
  
  // Si on a une année, proposer les années adjacentes
  if (contexte.annee && pieces.length > 0) {
    const anneeNum = parseInt(contexte.annee, 10)
    if (!isNaN(anneeNum)) {
      const anneePrecedente = anneeNum - 1
      const anneeSuivante = anneeNum + 1
      const currentYear = new Date().getFullYear()
      
      if (anneePrecedente >= 2010 && suggestions.length < 4) {
        suggestions.push(`Voir les documents de ${anneePrecedente}`)
      }
      if (anneeSuivante <= currentYear && suggestions.length < 4) {
        suggestions.push(`Voir les documents de ${anneeSuivante}`)
      }
    }
  }
  
  // Si aucun document trouvé, proposer des alternatives
  if (pieces.length === 0) {
    if (contexte.client) {
      suggestions.push(`Voir tous les documents de ${contexte.client}`)
    }
    suggestions.push("Voir les derniers documents ajoutés")
    suggestions.push("Afficher les statistiques générales")
  }
  
  // Toujours proposer une action de recherche élargie si on a des résultats limités
  if (pieces.length > 0 && pieces.length < 5 && contexte.client) {
    suggestions.push(`Voir tous les documents de ${contexte.client}`)
  }
  
  return suggestions.slice(0, 4)
}

// ============================================================================
// INSIGHTS ET ACTIONS SUR LES STATISTIQUES
// ============================================================================

/**
 * Construit des insights sur les statistiques
 */
export function construireInsightsStatistiques(statistiques: Statistiques): string[] {
  const insights: string[] = []

  const topClients = statistiques.top_clients ?? []
  if (topClients.length > 0) {
    const premiers = topClients
      .slice(0, 3)
      .map((client) => `${client.client} (${client.compte})`)
      .join(', ')
    insights.push(`Top clients : ${premiers}.`)
  }

  const evolution = Object.entries(statistiques.documents_par_mois ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
  if (evolution.length >= 2) {
    const [prevKey, prevValue] = evolution[evolution.length - 2]
    const [lastKey, lastValue] = evolution[evolution.length - 1]
    if (prevValue && lastValue) {
      const delta = ((lastValue - prevValue) / prevValue) * 100
      insights.push(`Variation du volume entre ${prevKey} et ${lastKey} : ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} %.`)
    }
  }

  return insights
}

/**
 * Construit des actions recommandées sur les statistiques
 */
export function construireActionsStatistiques(statistiques: Statistiques): string[] {
  const actions: string[] = []

  const kpi = statistiques.kpi
  if (kpi) {
    if (kpi.taux_conformite < 0.9) {
      actions.push('Prioriser la réduction des documents en retard pour améliorer le taux de conformité.')
    } else {
      actions.push('Maintenir la surveillance : le taux de conformité reste satisfaisant.')
    }

    if (kpi.alertes_peremption > 0) {
      actions.push(`Planifier une revue des ${kpi.alertes_peremption} document${kpi.alertes_peremption > 1 ? 's' : ''} proche${kpi.alertes_peremption > 1 ? 's' : ''} de la péremption.`)
    }
  }

  if (!actions.length) {
    actions.push('Aucune action prioritaire détectée. Continuer le suivi régulier des indicateurs.')
  }

  return actions
}

// ============================================================================
// RÉSUMÉS
// ============================================================================

/**
 * Construit un résumé des documents trouvés
 */
export function construireResumeDocuments(
  pieces: DocumentPiece[],
  tone: ToneName = 'amical'
): string {
  const toneConfig = TONES[tone]
  
  if (pieces.length === 0) {
    return toneConfig.noResults
  }
  
  return toneConfig.intro(pieces.length) + toneConfig.conclusion
}

/**
 * Construit un résumé des statistiques
 */
export function construireResumeStatistiques(statistiques: Statistiques): string {
  // Calculer le total des documents depuis documents_par_mois
  const documentsParMois = statistiques.documents_par_mois ?? {}
  const total = Object.values(documentsParMois).reduce((sum, count) => sum + count, 0)
  const totalClients = statistiques.totaux_clients?.total ?? 0
  
  let resume = `Actuellement, l'application ACS contient ${total} document${total > 1 ? 's' : ''} archivé${total > 1 ? 's' : ''}.`
  
  if (totalClients > 0) {
    resume += ` La base compte ${totalClients} client${totalClients > 1 ? 's' : ''}.`
  }
  
  return resume
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie si une réponse LLM est un "filler" (réponse vide ou générique)
 */
export function estReponseLlmFiller(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return true

  if (trimmed.length < 120) {
    const fillers = [
      /je vais (t'|te |vous )?(expliquer|te dire|repondre)/i,
      /laisse[- ]moi (t'|te |vous )?expliquer/i,
      /voici (ce que|comment)/i,
      /en (gros|resume|clair)/i,
    ]
    if (fillers.some((p) => p.test(trimmed))) return true
  }

  return false
}
