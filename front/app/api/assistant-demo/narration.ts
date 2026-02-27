/**
 * Module de génération de narration pour l'assistant
 * Source unique de vérité pour : TONES, insights, actions, narration
 */

import type { DocumentPiece, Statistiques } from './types'
import type { CriteresRecherche } from './criteria'
import { extraireClientMentionne } from './api-client'

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
// INSIGHTS ET ACTIONS - DOCUMENTS
// ============================================================================

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

// ============================================================================
// NARRATION
// ============================================================================

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

// ============================================================================
// INSIGHTS ET ACTIONS - STATISTIQUES
// ============================================================================

export function construireResumeStatistiques(statistiques: Statistiques): string {
  const introductions = [
    "Voici un aperçu de vos archives actuelles :",
    "J'ai analysé vos documents et voici ce que j'ai trouvé :",
    "Après analyse de votre base documentaire, voici les points importants :",
    "Voici le bilan actuel de vos archives :"
  ]
  
  const intro = introductions[Math.floor(Math.random() * introductions.length)]
  let resume = intro
  
  const totalDocuments = Object.values(statistiques.documents_par_mois ?? {}).reduce(
    (acc, valeur) => acc + (valeur ?? 0),
    0,
  )
  if (totalDocuments > 0) {
    resume += `\n\nAu total, vous avez actuellement ${totalDocuments} document${totalDocuments > 1 ? 's' : ''} archivés dans ACS.`;
  }

  if (statistiques.kpi) {
    const tauxPct = (statistiques.kpi.taux_conformite * 100).toFixed(1)
    const retards = statistiques.kpi.documents_en_retard
    const peremptions = statistiques.kpi.alertes_peremption
    
    if (retards === 0 && peremptions === 0) {
      resume += `\n\nBonne nouvelle ! Votre taux de conformité est excellent (${tauxPct}%), sans aucun document en retard ni alerte de péremption. Tout est parfaitement en ordre.`;
    } else if (retards === 0) {
      resume += `\n\nVotre taux de conformité est très bon (${tauxPct}%). Vous n'avez aucun document en retard, mais ${peremptions} document${peremptions > 1 ? 's' : ''} approchent de la péremption.`;
    } else if (peremptions === 0) {
      resume += `\n\nVotre taux de conformité est de ${tauxPct}%. Vous avez ${retards} document${retards > 1 ? 's' : ''} en retard, mais aucune alerte de péremption.`;
    } else {
      resume += `\n\nVotre taux de conformité est de ${tauxPct}%. J'ai identifié ${retards} document${retards > 1 ? 's' : ''} en retard et ${peremptions} alerte${peremptions > 1 ? 's' : ''} de péremption.`;
    }
  }

  if (statistiques.top_clients?.length) {
    const topClients = statistiques.top_clients.slice(0, 3)
    
    if (topClients.length === 1) {
      resume += `\n\nLe client ${topClients[0].client} se démarque avec ${topClients[0].compte} document${topClients[0].compte > 1 ? 's' : ''} archivé${topClients[0].compte > 1 ? 's' : ''}.`;
    } else {
      const formatted = topClients
        .map((client, index) => {
          if (index === topClients.length - 1) {
            return `et ${client.client} (${client.compte})`
          }
          return `${client.client} (${client.compte})`
        })
        .join(', ')
      resume += `\n\nVos principaux clients en volume d'archives sont ${formatted}.`
    }
  }

  if (resume === intro) {
    return "Je n'ai pas encore assez de données pour vous fournir des statistiques pertinentes. N'hésitez pas à ajouter des documents pour obtenir une analyse plus complète."
  }

  return resume
}

export function construireInsightsStatistiques(statistiques: Statistiques): string[] {
  const insights: string[] = []

  if (statistiques.top_clients?.length) {
    const premiers = statistiques.top_clients
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
// RÉSUMÉ DOCUMENTS
// ============================================================================

export function construireResumeDocuments(_question: string, pieces: DocumentPiece[], tone: 'amical' | 'formel' | 'concis' | 'premium' = 'amical'): string {
  const toneConfig = TONES[tone]
  
  const clientMentionne = extraireClientMentionne(_question)
  
  if (!pieces || pieces.length === 0) {
    if (clientMentionne) {
      return `Je n'ai trouvé aucun document pour le client ${clientMentionne} dans les archives.\n\nEs-tu sûr du code client ? Sinon, essaie avec d'autres critères de recherche.`
    }
    return toneConfig.noResults
  }

  const premiere = pieces[0]
  const metadata = premiere.metadata ?? {}
  const nbDocs = pieces.length

  const normalizedQuestion = _question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  const demandeListeComplete =
    normalizedQuestion.includes('tous les documents') ||
    normalizedQuestion.includes('tout les documents') ||
    normalizedQuestion.includes('liste moi tous les documents') ||
    normalizedQuestion.includes('liste tous les documents')

  let reponse: string
  if (demandeListeComplete) {
    const clientNom = (metadata.client as string | undefined) || 'ce client'
    if (nbDocs === 1) {
      reponse = `Tu m'as demandé la liste des documents pour le client ${clientNom}. La liste complète serait trop longue à afficher en une seule fois, donc je te montre le document suivant.`
    } else {
      reponse = `Tu m'as demandé la liste des documents pour le client ${clientNom}. La liste complète serait trop longue à afficher en une seule fois, donc je te montre ici ${nbDocs} documents parmi les plus pertinents ou les plus récents.`
    }
  } else {
    reponse = nbDocs === 1
      ? "J'ai retrouvé un document qui pourrait vous être utile."
      : `J'ai retrouvé ${nbDocs} documents qui pourraient vous être utiles.`
  }
  reponse += "\n\n"

  let emoji = ''
  const type = (metadata.type as string)?.toLowerCase() || ''
  if (toneConfig.useEmojis) {
    if (type.includes('sinistre')) emoji = '🚨 '
    else if (type.includes('contrat')) emoji = '📄 '
    else if (type.includes('facture')) emoji = '🧾 '
    else if (type.includes('rapport')) emoji = '📊 '
    else if (type.includes('courrier')) emoji = '✉️ '
    else emoji = '📎 '
  }

  const titre = metadata.titre || 'Document';
  reponse += `${emoji}${titre}\n`;

  if (metadata.client) reponse += `Client : ${metadata.client}\n`;
  if (metadata.type) reponse += `Type : ${metadata.type}\n`;
  if (metadata.date_document) {
    const date = new Date(metadata.date_document as string);
    if (!isNaN(date.getTime())) reponse += `Date : ${date.toLocaleDateString('fr-FR')}\n`;
  }
  if (metadata.reference) reponse += `Référence : ${metadata.reference}\n`;

  const contenu = premiere.content || '';
  if (contenu.length > 50) {
    const montantMatch = contenu.match(/\d+[\s\u00A0]?(?:\d{3}[\s\u00A0]?)*[€$¢]|montant[:\s]+\d+/i);
    const statutMatch = contenu.match(/(?:statut|état|status)[:\s]+([^\n.]+)|(?:en cours|traité|validé|en attente|clos)/i);
    const details: string[] = [];
    if (montantMatch) details.push(montantMatch[0]);
    if (statutMatch) {
      const statut = statutMatch[1] || statutMatch[0];
      details.push(statut.trim());
    }
    if (details.length > 0) {
      reponse += `\nRésumé : ${details.join('. ')}.`;
    } else {
      const lignes = contenu.split('\n').map(l => l.trim()).filter(l => l.length > 10 && l.length < 150).slice(0, 2);
      if (lignes.length > 0) reponse += `\nRésumé : ${lignes.join(' ')}`;
    }
  }

  if (nbDocs > 1) {
    const clientPremierDoc = (metadata.client as string)?.toUpperCase()
    const autresClients = new Set(
      pieces.slice(1)
        .map(p => (p.metadata?.client as string)?.toUpperCase())
        .filter(Boolean)
    );
    
    if (clientMentionne && autresClients.size === 1 && Array.from(autresClients)[0] === clientMentionne) {
      reponse += `\n\nTous ces documents concernent le client ${clientMentionne}.`;
    } else if (autresClients.size === 1 && Array.from(autresClients)[0] === clientPremierDoc) {
      reponse += `\n\nTous ces documents concernent le client ${clientPremierDoc}.`;
    } else if (autresClients.size === 1) {
      reponse += `\n\nLes autres documents sont liés au client ${Array.from(autresClients)[0]}.`;
    } else if (autresClients.size > 1) {
      reponse += `\n\nLes autres documents concernent : ${Array.from(autresClients).join(', ')}.`;
    } else {
      reponse += `\n\n${nbDocs - 1} autre${nbDocs > 2 ? 's' : ''} document${nbDocs > 2 ? 's' : ''} disponible${nbDocs > 2 ? 's' : ''}.`;
    }
  }

  reponse += '\n\nVous pouvez les consulter ou les télécharger à tout moment.';
  reponse += "\n\nSi vous avez besoin d'aide pour un autre document ou pour une recherche, je suis là pour vous aider !";
  return reponse;
}
