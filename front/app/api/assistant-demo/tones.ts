/**
 * Configuration des tons de réponse pour l'assistant
 */

import type { DocumentPiece } from './types'

export type ToneName = 'amical' | 'formel' | 'concis' | 'premium'

export type ToneConfig = {
  intro: (nb: number) => string
  conclusion: string
  noResults: string
  useEmojis: boolean
}

export const TONES: Record<ToneName, ToneConfig> = {
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
}

const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000

/**
 * Construit des insights à partir des documents trouvés
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
 * Construit des actions recommandées à partir des documents
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
 * Construit une narration heuristique pour les résultats
 */
export function construireNarrationHeuristique(
  intent: 'documents' | 'statistiques',
  resume: string,
  insights?: string[],
  actions?: string[]
): string {
  if (intent === 'documents') {
    return resume
  }

  let reponse = resume
  
  if (insights && insights.length) {
    const insightText = insights[0]
    if (!resume.includes(insightText)) {
      reponse += `\n\nJ'ai également remarqué que ${insightText.charAt(0).toLowerCase()}${insightText.slice(1)}`
    }
  }
  
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
