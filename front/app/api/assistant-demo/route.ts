function extraireCleClient(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'local'
}

function verifierRateLimit(request: Request): { ok: boolean; remaining: number } {
  const key = extraireCleClient(request)
  const now = Date.now()
  const timestamps = rateLimitStore.get(key)?.filter((time) => now - time < RATE_LIMIT_WINDOW_MS) ?? []

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(key, timestamps)
    return { ok: false, remaining: 0 }
  }

  timestamps.push(now)
  rateLimitStore.set(key, timestamps)
  return { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS - timestamps.length }
}

import { NextResponse } from 'next/server'
import type { AssistantResponse, AssistantTrace, DocumentPiece, Statistiques } from './types'
import { RoleUtilisateur } from '../../../types'
import { generateLlmAnswer, isLlmConfigured, validateResponse, addToConversation, getConversationHistory, getConversationHistoryWithPersistence, addToConversationWithPersistence, buildConversationSystemPrompt, buildClarificationSystemPrompt } from './llm'
import { 
  recordInteraction, 
  getSimilarGoodResponse, 
  enrichPromptWithLearning,
  getContextualExamples 
} from './learning'

// ============================================================================
// RÉSOLUTION DES RÉFÉRENCES CONTEXTUELLES
// Permet de comprendre "il", "lui", "ce client", "ses factures" en se basant
// sur l'historique de conversation
// ============================================================================

// Patterns qui indiquent une référence à un client précédent
const REFERENCE_PATTERNS: RegExp[] = [
  /\b(il|lui|elle|le|la|ce client|son|sa|ses|leur|leurs)\b/i,
  /\b(en a-t-il|en a-t-elle|combien en a)\b/i,
  /\b(le même|la même|les mêmes|celui-ci|celle-ci)\b/i,
]

// Types de documents reconnus dans ACS pour le filtrage de pertinence
const TYPE_DOCUMENT_KEYWORDS: Record<string, string[]> = {
  // Types de courrier ACS
  'acs vers client': ['acs vers client', 'acs client', 'courrier client', 'lettre client'],
  'acs vers compagnie': ['acs vers compagnie', 'acs compagnie', 'courrier compagnie', 'lettre compagnie'],
  // Types de documents
  'avenant': ['avenant', 'modification', 'amendement', 'modification contrat'],
  'facture': ['facture', 'fact', 'invoice', 'facturation'],
  'règlement': ['règlement', 'reglement', 'paiement', 'payment', 'versement'],
  'divers': ['divers', 'autre', 'autres', 'miscellaneous'],
  'sinistre': ['sinistre', 'déclaration sinistre', 'claim', 'accident'],
  // Types additionnels courants
  'contrat': ['contrat', 'police', 'contract', 'police d\'assurance'],
  'attestation': ['attestation', 'certificat', 'certificate'],
  'quittance': ['quittance', 'reçu', 'receipt'],
  'devis': ['devis', 'proposition', 'quote', 'offre'],
}

/**
 * Contexte extrait de l'historique de conversation
 * Inclut tous les critères de recherche pour les requêtes de suivi
 */
type ContexteHistorique = {
  client: string | null
  typeDocument: string | null
  annee: string | null
  risque: string | null
  dernierResultatVide: boolean // Si la dernière réponse disait "pas trouvé"
}

/**
 * Extrait le contexte complet de l'historique de conversation
 * (client + type de document + résultat précédent)
 */
function extraireContexteHistorique(sessionId: string): ContexteHistorique {
  const history = getConversationHistory(sessionId)

  let client: string | null = null
  let typeDocument: string | null = null
  let annee: string | null = null
  let risque: string | null = null
  let dernierResultatVide = false

  // Parcourir l'historique de la fin vers le début
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i]
    const content = message.content.toLowerCase()
    const contentOriginal = message.content

    // Vérifier si la dernière réponse assistant disait "pas trouvé"
    if (message.role === 'assistant' && i === history.length - 1) {
      if (content.includes('pas trouvé') || content.includes('aucun') || content.includes("n'ai pas")) {
        dernierResultatVide = true
      }
    }

    // Chercher le type de document dans les questions user
    if (message.role === 'user' && !typeDocument) {
      for (const [type, keywords] of Object.entries(TYPE_DOCUMENT_KEYWORDS)) {
        if (keywords.some((kw) => content.includes(kw))) {
          typeDocument = type
          break
        }
      }
    }

    // Chercher un client mentionné
    if (!client) {
      const clientMatch = contentOriginal.match(/(?:client|pour)\s+([A-Z0-9][A-Z0-9\s\-]{1,50})/i)
      if (clientMatch) {
        client = clientMatch[1].trim().toUpperCase()
      }

      // Chercher aussi les patterns comme "documents de X"
      const docMatch = contentOriginal.match(
        /(?:documents?|archives?|factures?|dossiers?)\s+(?:de|du|pour)\s+(?:le client\s+)?([A-Z0-9][A-Z0-9\s\-]{1,50})/i,
      )
      if (docMatch) {
        client = docMatch[1].trim().toUpperCase()
      }
    }

    // Chercher une année mentionnée (2018, 2024, etc.)
    if (!annee && message.role === 'user') {
      const anneeMatch = contentOriginal.match(/\b(19\d{2}|20[0-2]\d)\b/)
      if (anneeMatch) {
        annee = anneeMatch[1]
      }
    }

    // Chercher un risque mentionné (santé, auto, etc.)
    if (!risque && message.role === 'user') {
      const risquesConnus = ['sante', 'santé', 'auto', 'habitation', 'vie', 'prevoyance', 'prévoyance', 'rc', 'transport', 'construction', 'flotte']
      for (const r of risquesConnus) {
        if (content.includes(r)) {
          risque = r.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Normaliser (santé → sante)
          break
        }
      }
    }

    // Dernier recours: réutiliser l'extraction globale de critères (plus robuste)
    if (message.role === 'user') {
      const criteres = extraireCriteresRecherche(contentOriginal)
      if (!client && criteres.client) client = criteres.client
      if (!typeDocument && criteres.typeDocument) typeDocument = criteres.typeDocument
      if (!annee && criteres.annee) annee = criteres.annee
      if (!risque && criteres.risque) risque = criteres.risque
    }

    // On a trouvé tous les critères importants, on peut arrêter
    if (client && typeDocument && annee && risque) break
  }

  return { client, typeDocument, annee, risque, dernierResultatVide }
}

/**
 * Extrait le dernier client mentionné dans l'historique de conversation
 */
function extraireDernierClientContexte(sessionId: string): string | null {
  return extraireContexteHistorique(sessionId).client
}

/**
 * Vérifie si la question contient une référence contextuelle (il, lui, ce client, etc.)
 */
function contientReferenceContextuelle(question: string): boolean {
  return REFERENCE_PATTERNS.some((pattern) => pattern.test(question))
}

/**
 * Résultat de l'enrichissement avec contexte complet
 */
type ResultatEnrichissement = {
  questionEnrichie: string
  clientContexte: string | null
  anneeContexte: string | null
  risqueContexte: string | null
  typeDocumentContexte: string | null
}

/**
 * Enrichit la question avec le contexte complet de la conversation
 * (client + année + risque + type de document)
 */
function enrichirQuestionAvecContexte(question: string, sessionId: string | null): ResultatEnrichissement {
  if (!sessionId) {
    return {
      questionEnrichie: question,
      clientContexte: null,
      anneeContexte: null,
      risqueContexte: null,
      typeDocumentContexte: null,
    }
  }

  // Récupérer le contexte complet de la conversation
  const contexte = extraireContexteHistorique(sessionId)

  // Si la question contient déjà un client explicite, utiliser seulement les critères manquants
  const clientExplicite = extraireClientMentionne(question)
  const criteresQuestion = extraireCriteresRecherche(question)

  // Utiliser les critères explicites ou ceux du contexte
  const clientFinal = clientExplicite || criteresQuestion.client || contexte.client
  const anneeFinal = criteresQuestion.annee || contexte.annee
  const risqueFinal = criteresQuestion.risque || contexte.risque
  const typeDocFinal = criteresQuestion.typeDocument || contexte.typeDocument

  // Si la question contient une référence contextuelle ou est vague, enrichir avec le contexte
  const estReferenceContextuelle = contientReferenceContextuelle(question)

  // Patterns de requêtes de suivi (demandes qui font référence à quelque chose mentionné avant)
  const patternsRequeteSuivi = [
    /^(montre|affiche|voir|ouvre|donne|envoie|telecharge|imprime)/i, // Verbes d'action au début
    /\b(montre|affiche|voir)\s+(le|la|les|ce|cette|ces|moi)\b/i, // "montre le", "affiche moi"
    /\b(le|la|les)\s+(document|fichier|avenant|facture)s?\b/i, // "le document", "la facture"
    /^(oui|ok|d'accord|vas-?y|go)\b/i, // Confirmations
    /^c'?est\s+(ca|ça|celui|celle)/i, // "c'est ça", "c'est celui-là"
    /\b(cherche|recherche)\s+encore\b/i, // "cherche encore"
  ]
  const estRequeteSuivi = patternsRequeteSuivi.some((p) => p.test(question.trim()))

  if (estReferenceContextuelle || estRequeteSuivi) {
    // Construire une question enrichie avec tous les critères du contexte
    const partiesContexte: string[] = []
    if (clientFinal) partiesContexte.push(`client ${clientFinal}`)
    if (typeDocFinal) partiesContexte.push(`type ${typeDocFinal}`)
    if (anneeFinal) partiesContexte.push(`exercice ${anneeFinal}`)
    if (risqueFinal) partiesContexte.push(`risque ${risqueFinal}`)

    if (partiesContexte.length > 0) {
      const contexteStr = partiesContexte.join('\n- ')
      console.log(`=== Contexte résolu: "${question}" ===`)
      console.log(`=== Critères du contexte: ${partiesContexte.join(', ')} ===`)
      const questionEnrichie = `${question} (contexte: ${contexteStr})`
      return {
        questionEnrichie,
        clientContexte: clientFinal,
        anneeContexte: anneeFinal,
        risqueContexte: risqueFinal,
        typeDocumentContexte: typeDocFinal,
      }
    }
  }

  return {
    questionEnrichie: question,
    clientContexte: clientExplicite,
    anneeContexte: criteresQuestion.annee,
    risqueContexte: criteresQuestion.risque,
    typeDocumentContexte: criteresQuestion.typeDocument,
  }
}

// Génère un ID de session stable à partir du token
function generateSessionId(token: string | null): string {
  if (!token) return 'anonymous'
  // Utiliser les 16 premiers caractères du token comme ID de session
  const cleaned = token.replace(/^Bearer\s+/i, '')
  return cleaned.substring(0, 16)
}

import {
  incrementRequest,
  incrementLlmSuccess,
  incrementLlmFallback,
  incrementErrors,
  journaliserAssistant,
} from './telemetry'

type QueryPayload = {
  question?: string
  topK?: number
  tone?: 'amical' | 'formel' | 'concis' | 'premium'
}

// Configuration des tons de réponse
const TONES = {
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

function construireInsightsDocuments(pieces: DocumentPiece[]): string[] {
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

function construireActionsDocuments(pieces: DocumentPiece[]): string[] {
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

function construireNarrationHeuristique(
  intent: 'documents' | 'statistiques',
  resume: string,
  insights?: string[],
  actions?: string[]
): string {
  // Pour les documents, le résumé est déjà rédigé dans un ton conversationnel
  // (construireResumeDocuments ajoute une conclusion naturelle).
  if (intent === 'documents') {
    return resume
  }

  // Pour les statistiques, créer une réponse plus humaine et engageante
  let reponse = resume
  
  // Ajouter une analyse personnalisée basée sur les insights
  if (insights && insights.length) {
    // Éviter de répéter les informations déjà dans le résumé
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

  // Ajouter une conclusion personnalisée et engageante avec une question
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

type DocumentSearchResult = {
  id: string
  titre: string
  reference?: string | null
  client?: string | null
  risque?: string | null
  creeLe?: string | null
}

type AssistantSearchResult = {
  id: string
  titre: string
  content: string
  metadata: Record<string, unknown>
  score: number
  highlights?: string[] | null
}

type DocumentDetail = {
  id: string
  titre: string
  description?: string | null
  type_courrier?: string | null
  categorie?: string | null
  categorie_nom?: string | null
  reference?: string | null
  date_document?: string | null
  date_archivage?: string | null
  est_archive?: boolean
  cree_le?: string | null
  fichier_url?: string | null
  risque_detail?: {
    exercice_info?: {
      client?: string | null
      annee?: number | null
    }
    type?: string | null
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api'
const API_BASE = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`
const DEFAULT_TOP_K = 30 // Permet de remonter davantage de documents pertinents (ex: plusieurs avenants)
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000
const USE_FAISS = process.env.NEXT_PUBLIC_ASSISTANT_USE_FAISS === 'true'
const ASSISTANT_ENABLED = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? 'true').toLowerCase() !== 'false'
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.NEXT_PUBLIC_ASSISTANT_RATE_LIMIT ?? '12')

const rateLimitStore = new Map<string, number[]>()

const ROLES_AUTORISES_DOCUMENTS = new Set<RoleUtilisateur>([
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.ARCHIVISTE,
  RoleUtilisateur.CONSULTANT,
])
const ROLES_AUTORISES_STATISTIQUES = new Set<RoleUtilisateur>([
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.ARCHIVISTE,
  RoleUtilisateur.CONSULTANT,
])

function extraireRole(request: Request): RoleUtilisateur | null {
  const header = request.headers.get('x-user-role')?.trim().toUpperCase()
  if (!header) {
    return null
  }
  if (header === 'ADMIN' || header === 'ARCHIVISTE' || header === 'CONSULTANT') {
    return header as RoleUtilisateur
  }
  return null
}

function construireReponseRestreinte(
  question: string,
  intent: 'documents' | 'statistiques',
  role: RoleUtilisateur | null
): NextResponse<AssistantResponse> {
  const message =
    "Je suis désolé, mais vous ne disposez pas des droits nécessaires pour accéder à cette information. Merci de contacter un administrateur pour obtenir l'autorisation." as const

  const reponse: AssistantResponse = {
    question,
    type: intent,
    resume: message,
    pieces: intent === 'documents' ? [] : undefined,
    statistiques: intent === 'statistiques' ? undefined : undefined,
    insights: [],
    actions: [],
    narration: {
      texte: message,
      source: 'heuristique',
    },
    restriction: {
      reason: 'PERMISSION_DENIED',
      role,
    },
  }

  journaliserAssistant({
    type: 'response',
    intent,
    durationMs: 0,
    llmUsed: false,
  })

  return NextResponse.json(reponse)
}

class BackendError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function detectIntent(question: string): 'documents' | 'statistiques' {
  const lower = question.toLowerCase()
  const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const statsKeywords = ['combien', 'nombre', 'statistique', 'stats', 'kpi', 'taux', 'top', 'retard', 'alerte', 'volume', 'total']
  
  // Patterns spécifiques pour les stats sur les types de documents
  const statsTypesPatterns = [
    'types de documents les plus',
    'types les plus frequents',
    'documents les plus frequents',
    'augmente ou diminue',
    'evolution des archives',
    'tendance des archives',
  ]

  // Questions explicites de comptage contextuel
  if (estQuestionComptageContextuel(question)) {
    return 'statistiques'
  }

  // Mots-clés statistiques
  if (statsKeywords.some((kw) => normalized.includes(kw))) {
    return 'statistiques'
  }

  // Phrases typiques de stats sur types de documents
  if (statsTypesPatterns.some((pattern) => normalized.includes(pattern))) {
    return 'statistiques'
  }

  return 'documents'
}

// DÉTECTION DES QUESTIONS DE COMPTAGE CONTEXTUEL
// "Combien en a-t-il ?" → statistiques filtrées par le client en contexte
// ============================================================================

const COMPTAGE_PATTERNS = [
  /combien\s+(?:en\s+)?a[- ]?t[- ]?il/i,
  /combien\s+(?:en\s+)?a[- ]?t[- ]?elle/i,
  /combien\s+(?:en\s+)?a[- ]?t[- ]?on/i,
  /combien\s+(?:y\s+)?en\s+a/i,
  /combien\s+(?:il|elle)\s+(?:en\s+)?a/i,
  /quel\s+(?:est\s+le\s+)?nombre/i,
  /il\s+(?:y\s+)?en\s+a\s+combien/i,
]

function estQuestionComptageContextuel(question: string): boolean {
  const lower = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return COMPTAGE_PATTERNS.some(pattern => pattern.test(lower))
}

type SecurityFlags = { promptInjectionSuspect?: boolean; piiSuspect?: boolean }

type SecurityAnalysis = {
  level: 'low' | 'medium' | 'high'
  flags: SecurityFlags
}

function analyserRisqueQuestion(question: string): SecurityAnalysis {
  const normalized = question.toLowerCase()
  const flags: SecurityFlags = {}

  const injectionPatterns = [
    /ignore(?:r)? (?:toutes?|all) les? instructions/,
    /ignore(?:r)? les? consignes precedentes/,
    /system prompt/i,
    /contenu du prompt/i,
    /agis comme si tu etais/i,
    /desactive la securite/,
  ]

  if (injectionPatterns.some((re) => re.test(normalized))) {
    flags.promptInjectionSuspect = true
  }

  let level: SecurityAnalysis['level'] = 'low'
  if (flags.promptInjectionSuspect) {
    level = 'high'
  }

  return { level, flags }
}

// ============================================================================
// SYSTÈME DE FILTRAGE MULTI-CRITÈRES
// Vérifie que les documents correspondent à TOUS les critères demandés :
// - Type de document (facture, avenant, sinistre...)
// - Client (3CB, SANLAM...)
// - Année (2018, 2024...)
// - Risque (santé, auto, habitation...)
// - Type de courrier (ACS vers Client, ACS vers Compagnie...)
// ============================================================================

// Types de risques reconnus dans ACS
const TYPES_RISQUES: Record<string, string[]> = {
  'sante': ['sante', 'santé', 'maladie', 'hospitalisation', 'medical', 'médical'],
  'auto': ['auto', 'automobile', 'vehicule', 'véhicule', 'voiture', 'moto'],
  'habitation': ['habitation', 'maison', 'appartement', 'logement', 'mrh', 'multirisque habitation'],
  'vie': ['vie', 'deces', 'décès', 'epargne', 'épargne', 'retraite'],
  'prevoyance': ['prevoyance', 'prévoyance', 'incapacite', 'incapacité', 'invalidite', 'invalidité'],
  'rc': ['rc', 'responsabilite civile', 'responsabilité civile', 'rcp', 'rcms'],
  'transport': ['transport', 'marchandise', 'maritime', 'aerien', 'aérien'],
  'construction': ['construction', 'decennale', 'décennale', 'dommage ouvrage', 'trc', 'tous risques chantier'],
  'flotte': ['flotte', 'parc automobile', 'vehicules', 'véhicules'],
  'caution': ['caution', 'cautions'],
  'multirisques professionnel': [
    'multirisques professionnel',
    'multirisque professionnel',
    'mrp',
    'multirisque pro',
    'multirisques pro',
    'professionnel',
    'pro',
    'multirisque',
    'multirisques',
    'rc professionnelle',
    'rc pro',
    'responsabilite civile professionnelle',
    'responsabilité civile professionnelle',
  ],
}

// Structure des critères extraits de la question
type CriteresRecherche = {
  typeDocument: string | null
  client: string | null
  annee: string | null
  risque: string | null
  typeCourrier: string | null
  reference: string | null
}

function libelleCritere(critere: keyof CriteresRecherche): string {
  switch (critere) {
    case 'typeDocument':
      return 'type de document'
    case 'client':
      return 'client'
    case 'annee':
      return "année d'exercice"
    case 'risque':
      return 'risque'
    case 'typeCourrier':
      return 'type de courrier'
    case 'reference':
      return 'référence'
    default:
      return critere
  }
}

// Extrait tous les critères de filtrage de la question
function extraireCriteresRecherche(question: string): CriteresRecherche {
  const lower = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  // 1. Type de document
  let typeDocument: string | null = null
  for (const [type, keywords] of Object.entries(TYPE_DOCUMENT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      typeDocument = type
      break
    }
  }
  
  // 2. Client (code client en majuscules ou nom)
  let client: string | null = null
  
  // Mots réservés à ne pas confondre avec des codes clients
  // Inclut les verbes d'action, abréviations courantes et mots du domaine
  const motsReserves = [
    // Abréviations techniques
    'ACS', 'PDF', 'DOC', 'REF', 'TYPE', 'DATE', 'CFA', 'EUR', 'USD',
    // Verbes d'action courants (requêtes de suivi)
    'MONTRE', 'AFFICHE', 'OUVRE', 'DONNE', 'ENVOIE', 'VOIR', 'CHERCHE', 'TROUVE',
    'TELECHARGE', 'IMPRIME', 'COPIE', 'PARTAGE', 'OUVRIR', 'FERME',
    // Pronoms et articles
    'MOI', 'TOI', 'LUI', 'ELLE', 'NOUS', 'VOUS', 'EUX', 'ICI', 'CELA', 'CECI',
    // Mots du domaine document
    'DOCUMENT', 'FICHIER', 'PIECE', 'ARCHIVE', 'DOSSIER',
    // Types de documents (ne pas confondre avec clients)
    'AVENANT', 'FACTURE', 'CONTRAT', 'SINISTRE', 'DEVIS', 'QUITTANCE',
    // Risques (ne pas confondre avec clients)
    'SANTE', 'AUTO', 'VIE', 'FLOTTE', 'RC', 'MRH',
  ]
  
  // Pattern 1: "client XXX" ou "du client XXX"
  const clientExplicite = question.match(/\b(?:du\s+)?client\s+([A-Z0-9][A-Z0-9\-]{1,15})\b/i)
  if (clientExplicite) {
    const candidat = clientExplicite[1].toUpperCase()
    if (!motsReserves.includes(candidat) && !/^(19|20)\d{2}$/.test(candidat)) {
      client = candidat
    }
  }
  
  // Pattern 2: "de XXX" ou "du XXX" (très commun: "de 3CB", "du 3CB")
  if (!client) {
    const deClientMatch = question.match(/\b(?:de|du)\s+([0-9][A-Z]{1,5}|[A-Z][A-Z0-9]{1,5})\b/i)
    if (deClientMatch) {
      const candidat = deClientMatch[1].toUpperCase()
      if (!motsReserves.includes(candidat) && !/^(19|20)\d{2}$/.test(candidat)) {
        client = candidat
      }
    }
  }
  
  // Pattern 3: Code client seul (lettres + chiffres ou chiffres + lettres)
  // Exemples: 3CB, 2FZ, SANLAM, ABC123
  if (!client) {
    const codeMatch = question.match(/\b([A-Z][A-Z0-9]{1,5}|[0-9][A-Z]{1,3}[0-9]*)\b/i)
    if (codeMatch) {
      const candidat = codeMatch[1].toUpperCase()
      if (!motsReserves.includes(candidat) && !/^(19|20)\d{2}$/.test(candidat)) {
        client = candidat
      }
    }
  }
  
  // 3. Année
  let annee: string | null = null
  const anneeMatch = question.match(/\b(19\d{2}|20[0-2]\d)\b/)
  if (anneeMatch) {
    annee = anneeMatch[1]
  }
  
  // 4. Risque
  let risque: string | null = null
  for (const [type, keywords] of Object.entries(TYPES_RISQUES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      risque = type
      break
    }
  }
  
  // 5. Type de courrier (ACS vers Client, ACS vers Compagnie)
  let typeCourrier: string | null = null
  if (/acs\s*(vers|pour|a|à)\s*client/i.test(lower)) {
    typeCourrier = 'acs vers client'
  } else if (/acs\s*(vers|pour|a|à)\s*compagnie/i.test(lower)) {
    typeCourrier = 'acs vers compagnie'
  }
  
  // 6. Référence / Numéro
  let reference: string | null = null
  const refMatch = question.match(/(?:ref|référence|reference|n°|numero|numéro)\s*[:.]?\s*([A-Z0-9\-\/]+)/i)
  if (refMatch) {
    reference = refMatch[1].toUpperCase()
  }
  
  return { typeDocument, client, annee, risque, typeCourrier, reference }
}

// Ancienne fonction maintenue pour compatibilité
function extraireTypeDocumentDemande(question: string): string | null {
  return extraireCriteresRecherche(question).typeDocument
}

// ============================================================================
// CLASSIFICATION SIMPLIFIÉE - VERSION ROBUSTE
// Détermine si la question est une recherche de document ou une conversation
// ============================================================================

type ModeAssistant =
  | 'recherche_document'
  | 'assurance_courtage'
  | 'hors_perimetre'
  | 'salutation'
  | 'confirmation'

function estQuestionAssuranceCourtage(question: string): boolean {
  const lower = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!lower) return false

  const patterns = [
    /\bassurance(s)?\b/,
    /\bassureur(s)?\b/,
    /\bassure(e|es|s)?\b/,
    /\bcourtage\b/,
    /\bcourtier(s)?\b/,
    /\bprime(s)?\b/,
    /\bcotisation(s)?\b/,
    /\brecouvrement(s)?\b/,
    /\bcotation(s)?\b/,
    /\bbordereau(x)?\b/,
    /\bgarantie(s)?\b/,
    /\bsinistre(s)?\b/,
    /\bindemnisation(s)?\b/,
    /\bfranchise(s)?\b/,
    /\brisque(s)?\b/,
    /\bresponsabilite civile\b/,
    /\b(r\.?c\.?|rc)\b/,
    /\bsouscription\b/,
    /\bpolice d'?assurance\b/,
    /\bavenant(s)?\b/,
    /\bquittance(s)?\b/,
    /\battestation(s)?\b/,
    /\bdevis\b/,
  ]

  return patterns.some((p) => p.test(lower))
}

function estQuestionAssuranceCourtageAmbigue(question: string, criteresExtraits: CriteresRecherche): boolean {
  if (!estQuestionAssuranceCourtage(question)) return false

  const lower = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  // Si l'utilisateur demande explicitement une recherche (liste/dernier/archives), ce n'est pas ambigu.
  const mentionneArchives = /\b(documents?|fichiers?|archives?)\b/.test(lower)
  const actionRechercheDocs = /\b(cherche|trouve|retrouve|montre|affiche|liste|donne|envoie|recupere|rappelle|ouvre)\b/.test(lower)
  const demandeRecence = /\b(dernier|derniers|derniere|dernieres|recent|recents)\b/.test(lower)
  const demandeListePieces = /\b(mes|les|tous les|la liste des)\b.*\b(avenants?|factures?|contrats?|attestations?|quittances?|devis|sinistres?)\b/.test(
    lower
  )

  if (mentionneArchives || actionRechercheDocs || demandeRecence || demandeListePieces) return false

  // Si on a des critères forts docs, c'est une recherche, pas ambigu.
  const aCriteresForts = !!(criteresExtraits.client || criteresExtraits.annee || criteresExtraits.reference)
  if (aCriteresForts) return false

  // Si on n'a pas d'indice fort que c'est une définition/explication, ce n'est pas ambigu.
  const isDefinitionLike =
    estQuestionDefinitionGenerale(question) ||
    estQuestionConseilGeneral(question) ||
    estQuestionExplicationConcept(question)
  if (!isDefinitionLike) return false

  // Ici: assurance/courtage + question de type définition/conseil, mais sans intention explicite de recherche → ambigu
  return true
}

function extraireChoixClarification(question: string): { choix: 'A' | 'B'; reste: string } | null {
  const normalized = question.trim()
  if (!normalized) return null

  const m = normalized.match(/^([abAB])\b[\s\-:,.!?]*([\s\S]*)$/)
  if (!m) return null

  const choix = m[1].toUpperCase() as 'A' | 'B'
  const reste = (m[2] ?? '').trim()
  return { choix, reste }
}

function recupererDerniereClarification(
  sessionId: string,
): { questionBase: string } | null {
  const history = getConversationHistory(sessionId)
  if (!history.length) return null

  let idxAssistant = -1
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      idxAssistant = i
      break
    }
  }
  if (idxAssistant < 0) return null

  const lastAssistant = history[idxAssistant].content
  const lastAssistantNorm = lastAssistant
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const isClarif =
    /reponds\s*a/.test(lastAssistantNorm) &&
    /\bou\s*b\b/.test(lastAssistantNorm) &&
    /explication/.test(lastAssistantNorm) &&
    /archives?/.test(lastAssistantNorm)
  if (!isClarif) return null

  let idxUser = -1
  for (let i = idxAssistant - 1; i >= 0; i--) {
    if (history[i].role === 'user') {
      idxUser = i
      break
    }
  }
  if (idxUser < 0) return null

  const questionBase = history[idxUser].content
  if (!questionBase?.trim()) return null
  return { questionBase }
}

function classifierSimple(question: string, criteresExtraits: CriteresRecherche): ModeAssistant {
  const lower = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  
  // 1. Salutations simples
  const salutations = ['bonjour', 'salut', 'coucou', 'hello', 'bonsoir', 'hey', 'hi', 'yo']
  if (salutations.some(s => lower === s || lower === s + '!')) {
    return 'salutation'
  }
  
  // 2. Confirmations simples (oui, ok, etc.) - utiliser le contexte
  //    Inclut "vas y" ou "vas-y" (espace ou tiret)
  if (/^(oui|ok|d'?accord|vas[-\s]?y|go|ouais|yep|yes|non|nan|nope|a|b)$/i.test(lower)) {
    return 'confirmation'
  }
  
  // 3. Détecter une recherche de documents
  // - Les critères "forts" (client/année/référence) sont typiquement des requêtes de recherche.
  // - Les critères "faibles" (type de document/risque) ne suffisent PAS, car ils peuvent être utilisés
  //   dans des questions d’assurance/courtage (définition, explication, conseils).
  const aCriteresForts = !!(criteresExtraits.client || criteresExtraits.annee || criteresExtraits.reference)
  const aCriteresFaibles = !!(criteresExtraits.typeDocument || criteresExtraits.risque)
  const aCriteres = aCriteresForts || aCriteresFaibles

  const mentionneArchives = /\b(documents?|fichiers?|archives?)\b/.test(lower)
  const actionRechercheDocs = /\b(cherche|trouve|retrouve|montre|affiche|liste|donne|envoie|recupere|rappelle|ouvre)\b/.test(lower)
  const demandeRecence = /\b(dernier|derniers|derniere|dernieres|recent|recents)\b/.test(lower)

  const demandeListePieces = /\b(mes|les|tous les|la liste des)\b.*\b(avenants?|factures?|contrats?|attestations?|quittances?|devis|sinistres?)\b/.test(
    lower
  )
  const demandeDernierePiece = /\b(dernier|derniers|derniere|dernieres|recent|recents)\b.*\b(avenant|facture|contrat|attestation|quittance|devis|sinistre)\b/.test(
    lower
  )

  if (aCriteresForts) {
    return 'recherche_document'
  }

  if ((demandeListePieces || demandeDernierePiece) && (aCriteres || mentionneArchives)) {
    return 'recherche_document'
  }

  if (actionRechercheDocs && (mentionneArchives || demandeListePieces || demandeDernierePiece || aCriteres)) {
    return 'recherche_document'
  }

  if (demandeRecence && (mentionneArchives || demandeListePieces || demandeDernierePiece || aCriteres)) {
    return 'recherche_document'
  }

  if (mentionneArchives && aCriteres) {
    return 'recherche_document'
  }

  // 4. Assurance / courtage → LLM-only
  if (estQuestionAssuranceCourtage(question)) {
    return 'assurance_courtage'
  }
  
  // 5. Questions sur les statistiques → recherche aussi
  if (/\b(combien|statistique|stats|nombre|total|compte)\b/.test(lower)) {
    return 'recherche_document'
  }
  
  // 7. Par défaut → hors périmètre
  return 'hors_perimetre'
}

function estReponseLlmFiller(content: string): boolean {
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

// Génère une narration simple et directe pour les résultats de recherche
function genererNarrationSimple(
  pieces: DocumentPiece[], 
  criteres: CriteresRecherche,
  contexte: { client?: string | null, annee?: string | null, risque?: string | null }
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

// Vérifie si un document correspond à un critère
function documentCorrespondAuCritere(piece: DocumentPiece, critere: string, valeur: string): boolean {
  const metadata = piece.metadata || {}
  const titre = (piece.source || '').toLowerCase()
  const contenu = (piece.content || '').toLowerCase()
  
  switch (critere) {
    case 'typeDocument': {
      const keywords = TYPE_DOCUMENT_KEYWORDS[valeur] ?? [valeur]
      const typeCourrier = ((metadata.type_courrier as string) || '').toLowerCase()
      const typeDoc = ((metadata.type as string) || '').toLowerCase()
      return keywords.some(kw => 
        titre.includes(kw) || contenu.includes(kw) || typeCourrier.includes(kw) || typeDoc.includes(kw)
      )
    }
    
    case 'client': {
      const clientDoc = ((metadata.client as string) || '').toUpperCase()
      return clientDoc === valeur.toUpperCase() || clientDoc.includes(valeur.toUpperCase())
    }
    
    case 'annee': {
      // L'exercice EST l'année de référence du document.
      // La date d'ajout ou les dates dans le contenu ne doivent pas influencer ce critère.
      const exercice = String(metadata.exercice || '')
      const exerciceStr = exercice.trim()

      // On considère le document correspondant si l'année d'exercice est égale
      // ou contient l'année demandée (ex : "2018" ou "EXO 2018").
      const matchExercice = exerciceStr === valeur || exerciceStr.includes(valeur)
      console.log(`  → Vérification année ${valeur}: exercice="${exerciceStr}" → ${matchExercice}`)
      return matchExercice
    }
    
    case 'risque': {
      const risqueDoc = ((metadata.risque as string) || '').toLowerCase()
      const keywords = TYPES_RISQUES[valeur] ?? [valeur]
      return keywords.some(kw => risqueDoc.includes(kw) || titre.includes(kw) || contenu.includes(kw))
    }
    
    case 'typeCourrier': {
      // Filtrage strict : égalité exacte après normalisation (pas includes)
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const typeCourrier = normalize((metadata.type_courrier as string) || '')
      const typeDoc = normalize((metadata.type as string) || '')
      const critere = normalize(valeur)
      return typeCourrier === critere || typeDoc === critere
    }
    
    case 'reference': {
      const ref = ((metadata.reference as string) || '').toUpperCase()
      return ref.includes(valeur) || titre.toUpperCase().includes(valeur) || contenu.toUpperCase().includes(valeur)
    }
    
    default:
      return true
  }
}

// Résultat du filtrage multi-critères
type ResultatFiltrage = {
  pertinents: DocumentPiece[]
  nonPertinents: DocumentPiece[]
  tousNonPertinents: boolean
  criteresNonTrouves: string[] // Liste des critères demandés mais non trouvés
  criteresUtilises: CriteresRecherche
}

// Fonction principale de filtrage multi-critères
function filtrerParPertinence(pieces: DocumentPiece[], question: string): ResultatFiltrage {
  const criteres = extraireCriteresRecherche(question)
  
  // Si aucun critère spécifique, retourner tous les résultats
  const hasCriteres = Object.values(criteres).some(v => v !== null)
  if (!hasCriteres || pieces.length === 0) {
    return { 
      pertinents: pieces, 
      nonPertinents: [], 
      tousNonPertinents: false, 
      criteresNonTrouves: [],
      criteresUtilises: criteres
    }
  }
  
  const pertinents: DocumentPiece[] = []
  const nonPertinents: DocumentPiece[] = []
  const criteresNonTrouves: Set<string> = new Set()
  
  for (const piece of pieces) {
    let estPertinent = true
    
    // Vérifier chaque critère non-null
    for (const [critere, valeur] of Object.entries(criteres)) {
      if (valeur === null) continue
      
      if (!documentCorrespondAuCritere(piece, critere, valeur)) {
        estPertinent = false
        criteresNonTrouves.add(critere)
      }
    }
    
    if (estPertinent) {
      pertinents.push(piece)
    } else {
      nonPertinents.push(piece)
    }
  }
  
  // Log pour debug
  console.log(`=== Filtrage multi-critères ===`)
  console.log(`Critères: type=${criteres.typeDocument}, client=${criteres.client}, année=${criteres.annee}, risque=${criteres.risque}`)
  console.log(`Résultat: ${pertinents.length} pertinents, ${nonPertinents.length} non pertinents`)
  if (criteresNonTrouves.size > 0) {
    console.log(`Critères non trouvés: ${[...criteresNonTrouves].join(', ')}`)
  }
  
  return {
    pertinents,
    nonPertinents,
    tousNonPertinents: pertinents.length === 0 && nonPertinents.length > 0,
    criteresNonTrouves: [...criteresNonTrouves],
    criteresUtilises: criteres
  }
}

// Ancienne fonction maintenue pour compatibilité
function verifierPertinenceResultats(pieces: DocumentPiece[], typeDemande: string | null): {
  pertinents: DocumentPiece[]
  nonPertinents: DocumentPiece[]
  tousNonPertinents: boolean
} {
  if (!typeDemande || pieces.length === 0) {
    return { pertinents: pieces, nonPertinents: [], tousNonPertinents: false }
  }

  const keywords = TYPE_DOCUMENT_KEYWORDS[typeDemande] ?? [typeDemande]
  
  const pertinents: DocumentPiece[] = []
  const nonPertinents: DocumentPiece[] = []
  
  for (const piece of pieces) {
    const titre = (piece.source || '').toLowerCase()
    const contenu = (piece.content || '').toLowerCase()
    const typeCourrier = ((piece.metadata?.type_courrier as string) || '').toLowerCase()
    
    const estPertinent = keywords.some(kw => 
      titre.includes(kw) || contenu.includes(kw) || typeCourrier.includes(kw)
    )
    
    if (estPertinent) {
      pertinents.push(piece)
    } else {
      nonPertinents.push(piece)
    }
  }
  
  return {
    pertinents,
    nonPertinents,
    tousNonPertinents: pertinents.length === 0 && nonPertinents.length > 0
  }
}

function estSalutation(question: string): boolean {
	const normalized = question
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()

	if (!normalized) return false

	const greetings = ['bonjour', 'salut', 'coucou', 'hello', 'bonsoir', 'hey', 'hi', 'yo']
	return greetings.some((greeting) =>
		normalized === greeting ||
		normalized.startsWith(greeting + ' ') ||
		normalized.startsWith(greeting + ',') ||
		normalized.startsWith(greeting + '') ||
		normalized.endsWith(' ' + greeting),
	)
}

// ============================================================================
// CLASSIFICATION INTELLIGENTE DES MESSAGES
// Détecte le type de message pour un traitement approprié
// ============================================================================

type TypeMessage = 
  | 'salutation'              // Bonjour, salut...
  | 'conversation'            // ça va, moi aussi, merci...
  | 'question_assistant'      // Qui es-tu, que sais-tu faire...
  | 'hors_scope'             // Quelle heure, météo, calculs...
  | 'action_impossible'      // Supprime, modifie, ajoute...
  | 'confirmation'           // C'est bon, j'ai trouvé, super...
  | 'incomprehensible'       // ???, ..., caractères aléatoires
  | 'expression_emotion'     // Je suis frustré, c'est nul...
  | 'demande_suivi'          // Montre plus, et ensuite, autre chose...
  | 'demande_clarification'  // Je ne comprends pas, c'est quoi...
  | 'test_spam'              // Test, 123, asdf...
  | 'insulte'                // Insultes, propos inappropriés
  | 'question_vague'         // Recherche trop vague nécessitant précision
  | 'demande_urgent'         // Urgent, vite, pressé...
  | 'demande_comparaison'    // Compare, différence entre...
  | 'question_rappel'        // Comme avant, la dernière fois...
  | 'langue_etrangere'       // Message dans une autre langue
  | 'question_negative'      // Pas de X, sauf, sans...
  | 'document'               // Requête de documents (défaut)

// Métadonnées enrichies pour une réponse plus contextuelle
type MessageMetadata = {
  type: TypeMessage
  confidence: number           // 0-1, confiance dans la classification
  langue: 'fr' | 'en' | 'autre'
  sentiment: 'positif' | 'negatif' | 'neutre'
  urgence: boolean
  clientDetecte: string | null
  typeDocDetecte: string | null
  periodeDetectee: string | null
  questionMultiple: boolean    // Plusieurs questions en une
  faibleQualite: boolean       // Fautes, abréviations excessives
}

// ============================================================================
// ANALYSE AVANCÉE DU MESSAGE
// Extraction de toutes les métadonnées utiles
// ============================================================================

function analyserMessageComplet(question: string): MessageMetadata {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  
  const words = normalized.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  
  // Détection de langue
  const langue = detecterLangue(normalized)
  
  // Détection de sentiment
  const sentiment = detecterSentiment(normalized)
  
  // Détection d'urgence
  const urgence = /\b(urgent|vite|rapidement|asap|pressé|presse|immediatement|tout de suite|des que possible)\b/.test(normalized)
  
  // Détection de client potentiel (codes clients typiques: 3CB, 2FZ, SANLAM, etc.)
  const clientMatch = normalized.match(/\b([A-Z0-9]{2,10}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i)
  const clientDetecte = clientMatch ? clientMatch[1].toUpperCase() : null
  
  // Détection de type de document
  let typeDocDetecte: string | null = null
  for (const [type, keywords] of Object.entries(TYPE_DOCUMENT_KEYWORDS)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      typeDocDetecte = type
      break
    }
  }
  
  // Détection de période
  const periodeDetectee = detecterPeriode(normalized)
  
  // Question multiple (plusieurs ?)
  const questionMultiple = (normalized.match(/\?/g) || []).length > 1 || /\bet\b.*\?/.test(normalized)
  
  // Faible qualité (trop d'abréviations, fautes, etc.)
  const faibleQualite = detecterFaibleQualite(normalized, words)
  
  // Classification principale
  const type = classifierMessagePrincipal(normalized, words, wordCount, langue)
  
  // Calcul de confiance
  const confidence = calculerConfiance(type, normalized, wordCount)
  
  return {
    type,
    confidence,
    langue,
    sentiment,
    urgence,
    clientDetecte,
    typeDocDetecte,
    periodeDetectee,
    questionMultiple,
    faibleQualite,
  }
}

function detecterLangue(text: string): 'fr' | 'en' | 'autre' {
  // Mots français courants
  const motsFr = ['je', 'tu', 'il', 'elle', 'nous', 'vous', 'les', 'des', 'une', 'est', 'sont', 'avoir', 'etre', 'pour', 'dans', 'que', 'qui', 'sur', 'avec', 'pas', 'plus', 'tout', 'faire', 'comme', 'mais', 'ou', 'donc', 'car', 'ni', 'quoi', 'comment', 'pourquoi', 'quand', 'merci', 'bonjour', 'montre', 'voir', 'document', 'client', 'cherche']
  
  // Mots anglais courants
  const motsEn = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'need', 'want', 'like', 'know', 'think', 'see', 'come', 'take', 'get', 'make', 'go', 'say', 'tell', 'ask', 'use', 'find', 'give', 'please', 'thank', 'show', 'help', 'what', 'where', 'when', 'why', 'how', 'which', 'who']
  
  const words = text.split(/\s+/)
  let scoreFr = 0
  let scoreEn = 0
  
  for (const word of words) {
    if (motsFr.includes(word)) scoreFr++
    if (motsEn.includes(word)) scoreEn++
  }
  
  if (scoreFr > scoreEn && scoreFr >= 1) return 'fr'
  if (scoreEn > scoreFr && scoreEn >= 2) return 'en'
  
  // Par défaut français si pas clair
  return 'fr'
}

function detecterSentiment(text: string): 'positif' | 'negatif' | 'neutre' {
  const positif = /\b(merci|super|genial|parfait|excellent|bien|content|ravi|bravo|cool|top|nickel|formidable|magnifique)\b/
  const negatif = /\b(nul|mauvais|horrible|frustre|decu|enerve|agace|probleme|erreur|bug|marche pas|fonctionne pas|impossible)\b/
  
  if (positif.test(text)) return 'positif'
  if (negatif.test(text)) return 'negatif'
  return 'neutre'
}

function detecterPeriode(text: string): string | null {
  // Années
  const anneeMatch = text.match(/\b(20[0-2][0-9]|19[0-9]{2})\b/)
  if (anneeMatch) return anneeMatch[1]
  
  // Mois
  const moisMatch = text.match(/\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/)
  if (moisMatch) return moisMatch[1]
  
  // Périodes relatives
  if (/\b(aujourd'?hui|ce jour)\b/.test(text)) return 'aujourdhui'
  if (/\b(hier)\b/.test(text)) return 'hier'
  if (/\b(cette semaine|semaine en cours)\b/.test(text)) return 'cette_semaine'
  if (/\b(ce mois|mois en cours)\b/.test(text)) return 'ce_mois'
  if (/\b(cette annee|annee en cours)\b/.test(text)) return 'cette_annee'
  if (/\b(dernier|derniere|derniers|dernieres)\b/.test(text)) return 'recent'
  
  return null
}

function detecterFaibleQualite(text: string, words: string[]): boolean {
  // Trop court
  if (text.length < 3) return true
  
  // Trop d'abréviations SMS
  const abreviationsSms = ['pk', 'pq', 'stp', 'svp', 'jsp', 'jpp', 'mdr', 'lol', 'ptdr', 'tkt', 'dsl', 'slt', 'bjr', 'cc', 'cv', 'g', 'c', 'ta', 'ct']
  const countAbbr = words.filter(w => abreviationsSms.includes(w)).length
  if (countAbbr > words.length * 0.5 && words.length > 2) return true
  
  // Trop de répétitions de caractères
  if (/(.)\1{4,}/.test(text)) return true
  
  // Pas assez de voyelles (charabia)
  const voyelles = (text.match(/[aeiouy]/gi) || []).length
  const consonnes = (text.match(/[bcdfghjklmnpqrstvwxz]/gi) || []).length
  if (consonnes > 0 && voyelles / consonnes < 0.15 && text.length > 5) return true
  
  return false
}

function calculerConfiance(type: TypeMessage, text: string, wordCount: number): number {
  let confidence = 0.7 // Base
  
  // Plus de mots = plus de contexte = plus de confiance
  if (wordCount >= 3) confidence += 0.1
  if (wordCount >= 5) confidence += 0.1
  
  // Types très clairs
  if (['insulte', 'salutation', 'test_spam'].includes(type)) confidence = 0.95
  
  // Types ambigus
  if (['question_vague', 'document'].includes(type)) confidence -= 0.1
  
  return Math.min(Math.max(confidence, 0.3), 0.99)
}

function classifierMessagePrincipal(normalized: string, words: string[], wordCount: number, langue: 'fr' | 'en' | 'autre'): TypeMessage {
  
  // =========================================================================
  // 0. LANGUE ÉTRANGÈRE (si pas français et message substantiel)
  // =========================================================================
  if (langue === 'en' && wordCount >= 3) {
    // Mais on accepte quand même certains mots anglais dans un contexte archive
    if (!/\b(document|client|archive|facture|sinistre)\b/.test(normalized)) {
      return 'langue_etrangere'
    }
  }

  // =========================================================================
  // 1. INSULTES ET PROPOS INAPPROPRIÉS (priorité haute pour filtrage)
  // =========================================================================
  const insultes = [
    /\b(merde|putain|connard|salaud|enfoiré|nique|foutre|bordel|chier)\b/,
    /\b(idiot|debile|cretin|imbecile|abruti|stupide|con)\b/,
    /\b(fuck|shit|damn|bitch|ass|bastard|dickhead)\b/,
    /va te faire/,
    /ferme[- ]?(la|ta gueule)/,
    /ta gueule/,
    /degage/,
    /casse[- ]?toi/,
  ]
  if (insultes.some(p => p.test(normalized))) {
    return 'insulte'
  }

  // =========================================================================
  // 2. TESTS ET SPAM (messages sans intention réelle)
  // =========================================================================
  const testSpam = [
    /^test[s]?[!.\s]*$/,
    /^(1234?|123456?|0000|1111)$/,
    /^(azerty|qwerty|asdf|zxcv)[a-z]*$/,
    /^[a-z]{1,2}$/,
    /^(blabla|bla bla|truc|machin|chose|toto|tata|titi)$/,
    /^(allo|oui allo|hello hello|allo allo)$/,
    /^([a-z])\1+$/,
    /^[^a-z]*$/,
    /^(rien|vide|null|undefined|nan)$/,
  ]
  if (testSpam.some(p => p.test(normalized))) {
    return 'test_spam'
  }

  // =========================================================================
  // 3. RÉFÉRENCES DE DOCUMENTS (avant incompréhensible car format spécial)
  // =========================================================================
  // Pattern pour références de documents: 2018_3CB_Avenant_Sante_001, AV-2018-004, REF-123, etc.
  const estReferenceDocument = (text: string): boolean => {
    const patterns = [
      /^\d{4}[_-][A-Z0-9]+[_-].+$/i,           // 2018_3CB_Avenant_Sante_001
      /^[A-Z]{2,4}[_-]\d{4}[_-]\d+$/i,         // AV-2018-004, REF-2018-001
      /^[A-Z]{2,4}[_-]\d+$/i,                   // AV-001, REF-123
      /^N[°o]?\s*\d+/i,                         // N° 1234, No 1234
      /^\d+[_-][A-Z]+[_-]\d+$/i,               // 001-AV-2018
      /^[A-Z0-9]+[_-][A-Z0-9]+[_-][A-Z0-9]+/i, // XXX-YYY-ZZZ (pattern générique)
    ]
    return patterns.some(p => p.test(text.trim()))
  }
  
  if (estReferenceDocument(normalized) || estReferenceDocument(words.join('_'))) {
    // C'est une référence de document - on la traite comme une recherche de document
    return 'document'
  }

  // =========================================================================
  // 4. MESSAGES INCOMPRÉHENSIBLES
  // =========================================================================
  if (normalized.length <= 2 && !/^(ok|ca|va|ou|et|si|ni)$/.test(normalized)) return 'incomprehensible'
  if (/^[.?!,;:\-_=+]+$/.test(normalized)) return 'incomprehensible'
  if (/^(.)\1{3,}$/.test(normalized)) return 'incomprehensible'
  if (/^[^a-z0-9\s]+$/.test(normalized)) return 'incomprehensible'
  
  // Trop de caractères spéciaux par rapport aux lettres
  const lettersOnly = normalized.replace(/[^a-z]/g, '')
  if (lettersOnly.length < normalized.length * 0.3 && normalized.length > 3) return 'incomprehensible'
  
  // Charabia détecté
  if (normalized.length > 10 && !/\s/.test(normalized) && !/^[a-z]+$/.test(normalized)) return 'incomprehensible'

  // =========================================================================
  // 4. DEMANDES URGENTES
  // =========================================================================
  if (/\b(urgent|tres urgent|super urgent|asap|vite|rapidement|immediatement|tout de suite|des que possible|c'?est presse|pressant)\b/.test(normalized)) {
    // C'est urgent mais c'est quand même une demande de document
    // On retourne 'demande_urgent' seulement si c'est juste "urgent" sans contexte
    if (wordCount <= 3 && !/document|client|facture|avenant|sinistre/.test(normalized)) {
      return 'demande_urgent'
    }
  }

  // =========================================================================
  // 5. SALUTATIONS
  // =========================================================================
  const salutations = ['bonjour', 'salut', 'coucou', 'hello', 'bonsoir', 'hey', 'hi', 'yo', 'bjr', 'slt', 'cc', 'kikou', 'wesh', 'yop', 'plop']
  const isSalutationOnly = salutations.some(s => normalized === s || normalized === s + '!')
  const startsWithSalutation = salutations.some(s => normalized.startsWith(s + ' ') || normalized.startsWith(s + ',') || normalized.startsWith(s + '.'))
  
  if (isSalutationOnly) return 'salutation'
  // Salutations avec contexte: "bonjour, je cherche..." → document, pas salutation
  if (startsWithSalutation && wordCount > 4) {
    // Continue vers document
  } else if (startsWithSalutation && wordCount <= 4) {
    return 'salutation'
  }

  // =========================================================================
  // 6. QUESTIONS SUR L'ASSISTANT
  // =========================================================================
  const questionsAssistant = [
    /^(qui es[- ]?tu|tu es qui|t'?es qui|vous etes qui)/,
    /^(c'?est quoi ton nom|comment tu t'?appelles|quel est ton nom|ton nom c'?est quoi)/,
    /^(que (sais|peux)[- ]tu faire|qu'?est[- ]ce que tu (sais|peux) faire|tu (sais|peux) faire quoi)/,
    /^(tes capacites|ton role|tu sers a quoi|a quoi tu sers|tu fais quoi|c'?est quoi ton job)/,
    /^(comment (ca marche|tu fonctionnes|tu marches|ca fonctionne))/,
    /^(tu (comprends|parles) (quoi|francais|anglais)|tu parles quelle langue)/,
    /^(tu es (un robot|une ia|intelligent|humain|vrai|reel|une machine))/,
    /^(presente[- ]?toi|qui est l'?assistant|parle[- ]?moi de toi)/,
    /^(tu es la|es[- ]tu la|t'?es la)/,
  ]
  if (questionsAssistant.some(p => p.test(normalized))) {
    return 'question_assistant'
  }

  // =========================================================================
  // 7. ACTIONS IMPOSSIBLES
  // =========================================================================
  const actionsImpossibles = [
    /^(supprime|efface|delete|remove|vire|enleve|retire)/,
    /^(modifie|change|edit|update|corrige|rectifie|mets a jour)/,
    /^(ajoute|cree|create|new|nouveau|insere|rajoute)/,
    /^(envoie|envoi|send|mail|email|fax|poste)/,
    /^(telecharge|download|upload|transfere)/,
    /^(imprime|print|imprimer|impression)/,
    /^(exporte|export|sauvegarde|backup|archive)/,
    /^(connecte|log|login|authentifie|deconnecte|logout)/,
    /^(desactive|active|configure|parametre|regle|setup)/,
    /^(installe|desinstalle|reinstalle)/,
    /^(copie|colle|coupe|deplace|renomme)/,
  ]
  if (actionsImpossibles.some(p => p.test(normalized))) {
    return 'action_impossible'
  }

  // =========================================================================
  // 8. DEMANDES DE COMPARAISON
  // =========================================================================
  const comparaisons = [
    /^(compare|comparaison|difference entre|quelle difference|versus|vs)\b/,
    /\b(compare[rz]?|comparer)\s+(les|le|la|des|du)/,
    /\b(difference|differences)\s+(entre|avec)/,
    /\b(plus|moins)\s+(que|de)\s+\w+\s+(document|client|facture)/,
  ]
  if (comparaisons.some(p => p.test(normalized))) {
    return 'demande_comparaison'
  }

  // =========================================================================
  // 9. QUESTIONS DE RAPPEL (référence au passé)
  // =========================================================================
  const rappels = [
    /\b(comme (avant|la derniere fois|tout a l'?heure|precedemment))\b/,
    /\b(la derniere (fois|recherche|question))\b/,
    /\b(refais|recommence|re[- ]?(fais|montre|cherche))\b/,
    /\b(meme (chose|recherche|question))\b/,
    /\b(encore une fois|a nouveau|de nouveau)\b/,
  ]
  if (rappels.some(p => p.test(normalized))) {
    return 'question_rappel'
  }

  // =========================================================================
  // 10. QUESTIONS AVEC NÉGATION (exclusion)
  // =========================================================================
  const negations = [
    /\b(pas de|pas les|sans les?|sauf les?|except[ée]?|hormis|a part)\s+\w+/,
    /\b(ne (veux|cherche|veut) pas)\b/,
    /\b(tout sauf|tous sauf|toutes sauf)\b/,
    /\b(a l'?exception|en dehors de)\b/,
    /\b(exclure?|exclus|excluant)\b/,
  ]
  if (negations.some(p => p.test(normalized))) {
    return 'question_negative'
  }

  // =========================================================================
  // 11. DEMANDES DE SUIVI (continuation de conversation)
  // =========================================================================
  const demandesSuivi = [
    /^(et (ensuite|apres|maintenant|puis|alors)|ensuite|apres)[?]?$/,
    /^(montre[- ]?(moi)? (plus|d'?autres|la suite|encore|le reste))/,
    /^(autre chose|quoi d'?autre|y'?a[- ]?t[- ]?il (d'?)?autre)/,
    /^(continue[rz]?|vas[- ]?y|go|suite|next)[!]?$/,
    /^(plus de (details|infos|informations|resultats|donnees))/,
    /^(et les autres|les autres|d'?autres|voir plus)[?]?$/,
    /^(suivant|precedent|prochain|previous|back)[!]?$/,
    /^(encore|again|more|davantage)[!]?$/,
    /^(developpe|explique plus|precise|detaille)[!]?$/,
    /^(et[?]?|alors[?]?|donc[?]?)$/,
  ]
  if (demandesSuivi.some(p => p.test(normalized))) {
    return 'demande_suivi'
  }

  // =========================================================================
  // 12. DEMANDES DE CLARIFICATION
  // =========================================================================
  const demandesClarification = [
    /^(je (ne )?(comprends pas|sais pas|vois pas|capte pas))/,
    /^(c'?est quoi (ca|cela|ce truc)?|qu'?est[- ]ce (que c'?est|que ca veut dire|que tu veux dire))/,
    /^(que veux[- ]tu dire|qu'?entends[- ]tu par|tu veux dire quoi)/,
    /^(peux[- ]tu (reformuler|expliquer|preciser|clarifier|detailler|re[- ]?expliquer))/,
    /^(je suis (perdu|confus|paume|largue|pige pas))/,
    /^(pardon|excuse|desole)[,]? (quoi|je n'?ai pas (compris|capte))/,
    /^(hein|quoi|comment|pardon|excuse|plaît)\?*$/,
    /^(repete|redis[- ]?(moi)?|re[- ]?dis)/,
    /^(kesako|koi|kwa|wut|what)\?*$/,
  ]
  if (demandesClarification.some(p => p.test(normalized))) {
    return 'demande_clarification'
  }

  // =========================================================================
  // 13. DÉTECTION DU SCOPE ACS (approche positive)
  // On définit ce qui EST dans le scope, pas ce qui ne l'est pas
  // =========================================================================
  
  // Mots-clés qui indiquent clairement une requête liée aux archives ACS
  const MOTS_CLES_ACS = [
    // Types de documents
    'document', 'documents', 'doc', 'docs', 'fichier', 'fichiers', 'piece', 'pieces',
    'avenant', 'avenants', 'facture', 'factures', 'sinistre', 'sinistres',
    'contrat', 'contrats', 'police', 'polices', 'reglement', 'reglements',
    'attestation', 'attestations', 'quittance', 'quittances', 'devis',
    'courrier', 'courriers', 'lettre', 'lettres',
    
    // Entités ACS
    'client', 'clients', 'assure', 'assures', 'souscripteur',
    'compagnie', 'compagnies', 'assureur', 'assureurs',
    'exercice', 'exercices', 'annee', 'annees',
    
    // Types de risques (assurance)
    'risque', 'risques', 'auto', 'automobile', 'habitation', 'sante', 'prevoyance',
    'rc', 'responsabilite', 'vie', 'deces', 'incendie', 'vol', 'multirisque',
    'flotte', 'transport', 'marchandise', 'construction', 'decennale',
    
    // Actions sur archives
    'archive', 'archives', 'archiver', 'archivage', 'archiviste',
    'dossier', 'dossiers', 'recherche', 'rechercher', 'cherche', 'trouver',
    'consulter', 'voir', 'afficher', 'montre', 'montrer',
    
    // Statistiques
    'statistique', 'statistiques', 'stats', 'combien', 'nombre', 'total',
    'recapitulatif', 'resume', 'bilan',
    
    // Termes métier assurance
    'prime', 'primes', 'cotisation', 'cotisations', 'echeance', 'echeances',
    'souscription', 'resiliation', 'modification', 'renouvellement',
    'garantie', 'garanties', 'franchise', 'indemnisation', 'declaration',
    
    // Identifiants (codes clients typiques)
    'ACS', 'numéro', 'référence', 'ref', 'code',
  ]
  
  // Vérifier si la question contient au moins un mot-clé ACS
  const contientMotCleAcs = MOTS_CLES_ACS.some(mot => {
    const regex = new RegExp(`\\b${mot}\\b`, 'i')
    return regex.test(normalized)
  })
  
  // Patterns de codes clients (3CB, 2FZ, SANLAM, etc.)
  const contientCodeClient = /\b[A-Z0-9]{2,5}\b/.test(normalized) && /\b(client|document|pour|de|du)\b/.test(normalized)
  
  // Si la question contient des éléments ACS → c'est une requête document
  if (contientMotCleAcs || contientCodeClient) {
    // On continue vers le type 'document' (fin de fonction)
  } else {
    // La question ne contient AUCUN mot-clé ACS
    // Vérifier si c'est une question généraliste évidente
    const questionsGeneralistes = [
      /\b(quelle? heure|l'?heure)\b/,
      /\b(meteo|temperature|temps qu'?il fait)\b/,
      /\b(raconte|blague|histoire drole)\b/,
      /\b(joue|jouons|jeu)\b/,
      /\b(tradui|traduction)\b/,
      /\b(dessine|image|photo)\b/,
      /\b(recette|cuisine)\b/,
      /\b(musique|chanson|film|serie)\b/,
      /\b(horoscope|astrologie)\b/,
      /\b(c'?est qui le|qui est le)\b/,
      /\b(capitale de|capitale du)\b/,
      /^\d+\s*[\+\-\*\/]\s*\d+/, // Calculs
    ]
    
    if (questionsGeneralistes.some(p => p.test(normalized))) {
      return 'hors_scope'
    }
  }

  // =========================================================================
  // 14. QUESTIONS VAGUES (trop génériques, besoin de précision)
  // =========================================================================
  const questionsVagues = [
    /^(document|documents|doc|docs)[?!.]?$/,             // Juste "documents"
    /^(client|clients)[?!.]?$/,                          // Juste "clients"
    /^(cherche|recherche|trouve|trouver)[?!.]?$/,        // Verbe seul
    /^(montre|voir|affiche)[?!.]?$/,                     // Action sans objet
    /^(quoi|que|comment|ou|quand|pourquoi)[?!]?$/,       // Question sans contexte
    /^(aide|help|sos|besoin)[?!]?$/,                     // Aide sans précision
    /^(tout|tous|toutes)[?!.]?$/,                        // Trop large
    /^(un truc|quelque chose|n'?importe quoi)[?!.]?$/,   // Très vague
  ]
  if (questionsVagues.some(p => p.test(normalized)) && wordCount <= 2) {
    return 'question_vague'
  }

  // =========================================================================
  // 15. CONFIRMATIONS
  // =========================================================================
  const confirmations = [
    /^(c'?est (bon|parfait|exactement ca|ce que je (cherchais|voulais)|ca|correct|juste))[!.]?$/,
    /^(j'?ai trouve|trouve|ca marche|ca fonctionne|ca roule)[!.]?$/,
    /^(non[,]? (pas (celui[- ]?la|ca|ceux[- ]?la|cet?te)|c'?est pas ca|merci))/,
    /^(oui[,]? (c'?est ca|exactement|voila|parfait|super))/,
    /^(ok|okay|d'?accord|entendu|compris|je vois|vu|roger|recu|done|fait)[!.]?$/,
    /^(valide|confirme|j'?accepte|go|let'?s go)[!.]?$/,
    /^(non merci|pas besoin|ca ira|c'?est tout|rien d'?autre|stop)[!.]?$/,
    /^(oui|non|yes|no|yep|nope|ouais|nan)[!.]?$/,
  ]
  if (confirmations.some(p => p.test(normalized))) {
    return 'confirmation'
  }

  // =========================================================================
  // 16. EXPRESSIONS ÉMOTIONNELLES
  // =========================================================================
  const emotions = [
    /^(super|genial|excellent|magnifique|bravo|formidable|wow|waouh|incroyable|fantastique|extra)[!]*$/,
    /^(nul|pourri|mauvais|decevant|frustrant|horrible|catastrophique|affreux|terrible)[!]*$/,
    /^(je suis (content|frustre|perdu|confus|satisfait|decu|ravi|enchante|heureux|triste|enerve))/,
    /^(merci (beaucoup|infiniment|bien|mille fois|enormement))[!]*$/,
    /^(trop (bien|cool|fort|nul|top|genial))[!]*$/,
    /^(quelle? (chance|horreur|surprise|bonheur|cauchemar))[!]*$/,
    /^(enfin|ouf|pfiou|youpi|hourra|alleluia|yes|yay)[!]*$/,
    /^(omg|oh mon dieu|punaise|flute|zut|mince|dommage)[!]*$/,
  ]
  if (emotions.some(p => p.test(normalized))) {
    return 'expression_emotion'
  }

  // =========================================================================
  // 17. CONVERSATIONS GÉNÉRALES
  // =========================================================================
  const conversations = [
    /^(ca va|comment vas[- ]?tu|comment tu vas|comment allez[- ]?vous|la forme|quoi de neuf|quoi de 9)/,
    /^(merci|thanks|thx|ty|thank you)[!]?$/,
    /^(au revoir|a bientot|bye|ciao|a plus|bonne (journee|soiree|nuit)|a demain|adieu|salut|tchao|a la prochaine)/,
    /^(peut[- ]?etre|pourquoi pas|bien sur|evidemment|certainement|absolument|carrément)$/,
    /^(moi (de meme|aussi|pareil)|pareil|idem|egalement|aussi|same|likewise)$/,
    /^(tres bien|bien|pas mal|tranquille|bof|moyen|couci[- ]?couca|comme ci comme ca)$/,
    /^(et toi|et vous|toi aussi|vous aussi|et de ton cote)[?]?$/,
    /^(a|ha|ah|oh|hm|hmm|euh|bah|bof|mouais|meh)$/,
    /^(lol|mdr|haha|hihi|hoho|xd|ptdr|mort de rire|rofl|lmao)[!]*$/,
    /^(bonne question|interessant|je vois|effectivement|en effet|tout a fait)[!.]?$/,
    /^(de rien|pas de quoi|y'?a pas de quoi|avec plaisir|je t'?en prie)[!]?$/,
  ]
  if (conversations.some(p => p.test(normalized))) {
    return 'conversation'
  }

  // =========================================================================
  // 18. PAR DÉFAUT : REQUÊTE DE DOCUMENTS
  // =========================================================================
  return 'document'
}

// Ancienne fonction maintenue pour compatibilité
function classifierMessage(question: string): TypeMessage {
  return analyserMessageComplet(question).type
}

// Génère une réponse appropriée selon le type de message
function genererReponseNonDocument(type: TypeMessage, question: string): string {
  switch (type) {
    case 'incomprehensible':
      return "Je n'ai pas bien compris votre message. Pouvez-vous reformuler ? Par exemple :\n- \"Montre-moi les documents du client X\"\n- \"Combien de documents dans les archives ?\"\n- \"Quels sont les derniers avenants ?\""
    
    case 'question_assistant':
      return "Je suis l'assistant virtuel ACS, spécialisé dans la gestion des archives d'assurance. Je peux vous aider à :\n- Rechercher des documents par client, type ou date\n- Consulter les statistiques des archives\n- Répondre à vos questions sur les documents\n\nEssayez par exemple : \"Documents du client 3CB\" ou \"Statistiques des archives\""
    
    case 'action_impossible':
      return "Je suis un assistant en lecture seule. Je ne peux pas modifier, supprimer ou créer des documents.\n\nPour ces actions, veuillez :\n- Utiliser l'interface principale d'ACS\n- Contacter un administrateur\n\nEn revanche, je peux vous aider à rechercher et consulter des documents !"
    
    case 'hors_scope':
      return "Cette question dépasse mes compétences. Je suis spécialisé dans les archives ACS.\n\nJe peux vous aider à :\n- Rechercher des documents\n- Consulter les statistiques\n- Répondre à vos questions sur l'archivage\n\nQue souhaitez-vous savoir sur vos archives ?"
    
    case 'confirmation':
      return "Parfait ! N'hésitez pas si vous avez d'autres questions sur vos archives."
    
    case 'expression_emotion':
      return "Je suis là pour vous aider ! Y a-t-il autre chose que je peux faire pour vous concernant vos archives ?"
    
    case 'demande_suivi':
      return "Que souhaitez-vous voir de plus ? Vous pouvez me demander :\n- Plus de documents d'un client spécifique\n- Un autre type de document (factures, avenants...)\n- Les statistiques des archives"
    
    case 'demande_clarification':
      return "Pas de souci, je vais clarifier ! Je suis l'assistant ACS et je peux vous aider à :\n- Rechercher des documents : \"Documents de 3CB\"\n- Voir les statistiques : \"Statistiques des archives\"\n- Filtrer par type : \"Factures du client X\"\n\nQue souhaitez-vous faire ?"
    
    case 'test_spam':
      return "Je suis prêt à vous aider ! Posez-moi une vraie question sur vos archives, par exemple : \"Quels sont les derniers documents ajoutés ?\" ou \"Documents du client 3CB\""
    
    case 'insulte':
      return "Je suis là pour vous aider avec vos archives de manière professionnelle. Comment puis-je vous assister ?"
    
    case 'question_vague':
      return "Votre demande est un peu vague. Pouvez-vous préciser ?\n\nExemples de questions :\n- \"Documents du client 3CB\" (un client spécifique)\n- \"Les factures de ce mois\" (un type de document)\n- \"Derniers documents ajoutés\" (période récente)\n- \"Statistiques des archives\" (vue d'ensemble)"
    
    case 'demande_urgent':
      return "Je comprends que c'est urgent ! Pour vous aider rapidement, précisez :\n- Quel client ?\n- Quel type de document ?\n- Quelle période ?\n\nExemple : \"Documents urgents de 3CB\" ou \"Dernières factures\""
    
    case 'demande_comparaison':
      return "Je peux vous aider à comparer des documents ou des statistiques. Précisez ce que vous souhaitez comparer :\n- \"Documents de 3CB vs SANLAM\"\n- \"Factures 2024 vs 2023\"\n- \"Statistiques par client\""
    
    case 'question_rappel':
      return "Je ne retrouve pas la recherche précédente dans notre conversation. Pouvez-vous reformuler votre demande ?\n\nPar exemple : \"Documents du client X\" ou \"Statistiques du mois dernier\""
    
    case 'langue_etrangere':
      return "I detected English! I'm the ACS assistant, specialized in insurance archives. I work best in French, but I can understand basic requests.\n\nJe suis l'assistant ACS. Je fonctionne mieux en français !\n\nHow can I help you with your archives?"
    
    case 'question_negative':
      return "Je comprends que vous voulez exclure certains éléments. Je vais faire de mon mieux, mais pour l'instant, je fonctionne mieux avec des recherches positives.\n\nEssayez plutôt : \"Documents de type X\" ou \"Documents du client Y\""
    
    default:
      return "Comment puis-je vous aider avec vos archives ?"
  }
}

// Ancienne fonction maintenue pour compatibilité
function estQuestionConversationnelle(question: string): boolean {
  const type = classifierMessage(question)
  return ['conversation', 'confirmation', 'expression_emotion', 'incomprehensible'].includes(type)
}

function estQuestionDefinitionGenerale(question: string): boolean {
	const normalized = question
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()

	if (!normalized) return false

	const normalizedQuotes = normalized
		.replace(/['']/g, "'")
		.replace(/[’‘–—]/g, '-')

	// ÉTAPE 1: Détecter si c'est une question de définition (GÉNÉRIQUE)
	// On utilise des regex pour capturer tous les patterns possibles
	const definitionPatterns = [
		/^c'?e?st quoi/,                          // "c'est quoi", "cest quoi"
		/^qu'?e?st[- ]ce qu/,                     // "qu'est-ce que", "quest ce que"
		/^que signifie/,                          // "que signifie"
		/^que veut dire/,                         // "que veut dire"
		/^ca (veut|signifie|represente) quoi/,   // "ça veut dire quoi"
		/^definition d[eu']/,                     // "définition de", "définition d'un"
		/^defini[rs]/,                            // "définir", "définis"
		/^explique[- ]?moi (ce qu|le |la |les |un |une )/,  // "explique-moi ce que"
		/^(peux-?tu|tu peux) m'?expliquer/,       // "peux-tu m'expliquer"
		/^(dis-?moi|dit-?moi) ce qu/,             // "dis-moi ce que"
		/quelle (est la )?difference entre/,      // "quelle différence entre"
		/qu'?entend[- ]?on par/,                  // "qu'entend-on par"
		/ca correspond a quoi/,                   // "ça correspond à quoi"
		/a quoi (ca |cela )?(sert|correspond)/,  // "à quoi ça sert"
	]

	const isDefinitionQuestion = definitionPatterns.some((pattern) => pattern.test(normalizedQuotes))
	
	if (!isDefinitionQuestion) return false

	// ÉTAPE 2: Exclure si c'est une demande de documents spécifiques
	// Si on détecte un code client ou une demande de liste, ce n'est PAS une définition
	const documentRequestIndicators = [
		/\b[0-9]{1,2}[a-z]{2}\b/i,                // Code client type "3CB", "2FZ"
		/\b(client|pour) [a-z0-9]{2,4}\b/i,      // "client 3CB", "pour ABC"
		/\b(montre|affiche|liste|donne|trouve|cherche|recupere)\b.*\b(moi|les|mes|tous)\b/,
		/\b(mes|les|tous les|la liste des)\b.*(documents?|factures?|contrats?|courriers?)/,
		/\bdu [0-9]{1,2}/,                        // Date spécifique
		/\bn[°o] ?[0-9]+\b/i,                     // Référence document
	]

	const isDocumentRequest = documentRequestIndicators.some((pattern) => pattern.test(normalizedQuotes))
	
	// C'est une question de définition SI c'est un pattern de définition ET PAS une demande de document
	return !isDocumentRequest
}

function estQuestionConseilGeneral(question: string): boolean {
	const normalized = question
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()

	if (!normalized) return false

	const normalizedQuotes = normalized
		.replace(/['']/g, "'")
		.replace(/[’‘–—]/g, '-')

	// ÉTAPE 1: Détecter les patterns de demande de conseil (GÉNÉRIQUE)
	const conseilPatterns = [
		/^comment (bien |faire |puis-?je |peut-?on |dois-?je )?/,  // "comment faire...", "comment bien..."
		/^que (dois-?je|faut-?il|me conseilles?)/,                 // "que dois-je faire"
		/^quels? (sont les |bons? )?(conseils?|reflexes?|pratiques?)/,  // "quels conseils"
		/\b(tu |vous )?(me |nous )?conseille(s|z|rais)/,           // "tu me conseillerais"
		/^si je (demarrais|partais|commencais)/,                   // "si je démarrais de zéro"
		/\bmeilleure? (facon|methode|pratique|maniere)\b/,         // "meilleure façon de"
		/\bbonnes? pratiques?\b/,                                   // "bonnes pratiques"
		/\b(eviter|prevenir|anticiper) (les |des |que )/,          // "éviter les erreurs"
		/\b(organiser|structurer|classer|ranger|gerer)\b.*\b(mes|les|ses)\b/, // "organiser mes archives"
		/^(as-?tu|avez-?vous) (des |un )?(conseils?|suggestions?|recommandations?)/,
	]

	const isConseilQuestion = conseilPatterns.some((pattern) => pattern.test(normalizedQuotes))
	
	if (!isConseilQuestion) return false

	// ÉTAPE 2: Exclure les demandes de documents spécifiques
	const documentRequestIndicators = [
		/\b[0-9]{1,2}[a-z]{2}\b/i,                // Code client type "3CB", "2FZ"
		/\b(client|pour) [a-z0-9]{2,4}\b/i,      // "client 3CB"
		/\b(montre|affiche|liste|donne|trouve)\b.*\b(moi|les)\b/,
		/\bdu [0-9]{1,2}/,                        // Date spécifique
		/\bn[°o] ?[0-9]+\b/i,                     // Référence document
	]

	return !documentRequestIndicators.some((pattern) => pattern.test(normalizedQuotes))
}

function estQuestionExplicationConcept(question: string): boolean {
	const normalized = question
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()

	if (!normalized) return false

	const normalizedQuotes = normalized
		.replace(/['']/g, "'")
		.replace(/[’‘–—]/g, '-')

	// ÉTAPE 1: Détecter les patterns de demande d'explication/clarification (GÉNÉRIQUE)
	const explicationPatterns = [
		/^je (veux|veut|voudrais|souhaite|aimerais) (juste )?(comprendre|savoir)/,  // "je veux comprendre"
		/^(explique|dis|dit)[- ]?(moi|nous)/,                           // "explique-moi", "dis-moi"
		/\b(dis|dit)[- ]?m'?en plus\b/,                                  // "dis m'en plus"
		/^(peux-?tu|tu peux|pourrais-?tu) (m'?|me )?(expliquer|clarifier|detailler)/,
		/^(j'?ai|je) (pas |mal )?(compris|saisi)/,                       // "j'ai pas compris"
		/\b(plus |mieux )?(d'?explications?|de details?|d'?infos?)\b/,   // "plus d'explications"
		/^(c'?est|ca serait) (quoi |comment )?(exactement|precisement|concretement)/,
		/\bje (ne )?(comprends?|sais) (pas|plus)\b/,                     // "je comprends pas"
		/^en (gros|resume|clair|fait)/,                                  // "en gros", "en résumé"
		/\b(reformule|clarifie|precise|developpe)\b/,                    // "reformule", "clarifie"
	]

	const isExplicationQuestion = explicationPatterns.some((pattern) => pattern.test(normalizedQuotes))
	
	if (!isExplicationQuestion) return false

	// ÉTAPE 2: Exclure les demandes de documents spécifiques
	const documentRequestIndicators = [
		/\b[0-9]{1,2}[a-z]{2}\b/i,                // Code client
		/\b(client|pour) [a-z0-9]{2,4}\b/i,      
		/\b(montre|affiche|liste|donne|trouve)\b.*\b(moi|les)\b/,
		/\bdu [0-9]{1,2}/,                        
		/\bn[°o] ?[0-9]+\b/i,
	]

	return !documentRequestIndicators.some((pattern) => pattern.test(normalizedQuotes))
}

// Détecte les questions sur les capacités / limites de l'assistant
function estQuestionCapacitesAssistant(question: string): boolean {
	const normalized = question
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()

	if (!normalized) return false

	const normalizedQuotes = normalized
		.replace(/['']/g, "'")
		.replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')

	// ÉTAPE 1: Détecter les questions sur les capacités/limites de l'assistant (GÉNÉRIQUE)
	const capacitesPatterns = [
		/\b(est-?ce que |)(tu |vous )(peux|pouvez|sais|savez|es capable)\b/,  // "tu peux", "es-tu capable"
		/\b(peux|pouvez|saurais|sauriez)-?(tu|vous)\b/,                        // "peux-tu", "saurais-tu"
		/\bquelles? sont tes (limites|capacites|fonctions|possibilites)\b/,   // "quelles sont tes limites"
		/\bqu'?e?st[- ]ce que tu (ne )?(peux|sais) (pas|faire)\b/,            // "qu'est-ce que tu peux faire"
		/\b(tu|vous) (ne )?(peux|pouvez|sais|savez) (pas|plus)\b/,            // "tu ne peux pas"
		/\bcomment (tu |vous )?(reagis|fonctionnes?|marches?)\b/,              // "comment tu réagis"
		/\bsi (tu|vous) (n'?es|n'?etes) pas (sur|certain|capable)\b/,         // "si tu n'es pas sûr"
		/\b(tes|vos) (limites|capacites|fonctions)\b/,                         // "tes limites"
		/\bqu'?e?st[- ]ce que (tu|vous) (fais|faites) (si|quand)\b/,          // "qu'est-ce que tu fais si"
		/\b(aide|aider|assister)[- ]?(moi|nous) a\b/,                          // "aide-moi à" (question sur capacité)
	]

	const isCapaciteQuestion = capacitesPatterns.some((pattern) => pattern.test(normalizedQuotes))
	
	if (!isCapaciteQuestion) return false

	// ÉTAPE 2: Vérifier que c'est bien une question sur l'assistant lui-même
	// et pas une demande d'action sur les documents
	const actionIndicators = [
		/\b(modifier|supprimer|creer|ajouter|editer|changer)\b.*\b(document|fichier|archive|facture|contrat)\b/,
		/\b(document|fichier|archive|facture|contrat)\b.*\b(modifier|supprimer|creer|ajouter)\b/,
	]

	// Si c'est une demande d'action sur un document, c'est quand même une question sur les capacités
	// car l'utilisateur demande si l'assistant PEUT faire cette action
	return true
}

type QuestionClientsType = 'tous' | 'particuliers' | 'entreprises' | 'client_specifique'

interface ClientSpecifiqueInfo {
  type: 'client_specifique';
  nomClient: string;
  typeDocument?: string;
}

type ResultatAnalyseClient = QuestionClientsType | ClientSpecifiqueInfo | null;

function analyserQuestionClients(question: string): ResultatAnalyseClient {
	const normalized = question
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()

	if (!normalized) return null
	
	// Détecter les questions sur un client spécifique
	const clientRegex = /(?:client|nom(?:\s+de)?|pour)\s+(?:du|de|la)?\s*([a-z0-9]{2,4})/i;
	const clientMatch = normalized.match(clientRegex);
	
	if (clientMatch && clientMatch[1]) {
	  const nomClient = clientMatch[1].toUpperCase();
	  console.log(`=== Détection client spécifique: ${nomClient} ===`);
	  
	  // Détecter le type de document recherché
	  let typeDocument = undefined;
	  if (normalized.includes('facture')) {
	    typeDocument = 'facture';
	  } else if (normalized.includes('avenant')) {
	    typeDocument = 'avenant';
	  } else if (normalized.includes('contrat')) {
	    typeDocument = 'contrat';
	  } else if (normalized.includes('document')) {
	    typeDocument = 'document';
	  }
	  
	  return {
	    type: 'client_specifique',
	    nomClient,
	    typeDocument
	  };
	}

	// Analyse standard pour les statistiques générales de clients
	const mentionsClients = normalized.includes('client') || normalized.includes('clients')
	const mentionsCompte = ['combien', 'nombre', 'total'].some((keyword) => normalized.includes(keyword))
	if (!mentionsClients || !mentionsCompte) return null

	const isParticuliers = normalized.includes('particulier') || normalized.includes('particuliers')
	const isEntreprises = normalized.includes('entreprise') || normalized.includes('entreprises')

	if (isParticuliers) return 'particuliers'
	if (isEntreprises) return 'entreprises'
	return 'tous'
}

// Extrait le nom du client mentionné dans la question (ex: "3CB", "2FZ")
function extraireClientMentionne(question: string): string | null {
	const normalized = question
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()

	if (!normalized) return null

	// Mots à ignorer (articles, prépositions)
	const motsIgnores = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'pour', 'et', 'ou', 'en', 'au', 'aux'])
	
	// Mots réservés à ne pas confondre avec des codes clients
	const motsReserves = new Set([
		'acs', 'pdf', 'doc', 'ref', 'type', 'date', 'cfa', 'eur', 'usd',
		'montre', 'affiche', 'ouvre', 'donne', 'envoie', 'voir', 'cherche', 'trouve',
		'telecharge', 'imprime', 'copie', 'partage', 'ouvrir', 'ferme',
		'moi', 'toi', 'lui', 'elle', 'nous', 'vous', 'eux', 'ici', 'cela', 'ceci',
		'document', 'fichier', 'piece', 'archive', 'dossier',
		'avenant', 'facture', 'contrat', 'sinistre', 'devis', 'quittance',
		'sante', 'auto', 'vie', 'flotte', 'rc', 'mrh',
	])

	// Patterns pour détecter un client mentionné
	const patterns = [
		// "client 2FZ", "client le 2FZ", "pour le client 2FZ"
		/(?:client)\s+(?:le\s+|la\s+)?([a-z0-9]{2,4})(?:\s|$|,|\.|\?)/i,
		// "avenants de 2FZ", "factures du client 2FZ", "documents pour 2FZ"
		/(?:avenants?|factures?|documents?|courriers?|contrats?)\s+(?:de|du|pour)\s+(?:le\s+|la\s+)?(?:client\s+)?([a-z0-9]{2,4})(?:\s|$|,|\.|\?)/i,
		// "avenants 2FZ" (code client directement après le type de doc)
		/(?:avenants?|factures?|documents?|courriers?|contrats?)\s+([a-z0-9]{2,4})(?:\s|$|,|\.|\?)/i,
	]

	for (const pattern of patterns) {
		const match = normalized.match(pattern)
		if (match && match[1]) {
			const candidat = match[1].toUpperCase()
			const candidatLower = candidat.toLowerCase()
			
			// Ignorer les mots courants qui ne sont pas des codes clients
			if (motsIgnores.has(candidatLower)) continue
			
			// Ignorer les mots réservés (verbes, types de documents, etc.)
			if (motsReserves.has(candidatLower)) continue
			
			// Ne pas confondre une année avec un code client
			if (/^(19|20)\d{2}$/.test(candidat)) continue
			
			return candidat
		}
	}

	return null
}

function buildBackendUrl(path: string): URL {
  return new URL(path, API_BASE)
}

/**
 * Journalise l'usage réel d'un appel LLM (télémétrie).
 * Appelé après un appel LLM réussi pour enregistrer les tokens consommés.
 */
async function logLlmUsage(
  telemetry: {
    provider: string
    model: string
    tokensInput?: number
    tokensOutput?: number
    durationMs?: number
  },
  purpose: 'router' | 'answer' | 'summary',
  token: string | null
): Promise<void> {
  if (!token) return

  try {
    const url = buildBackendUrl('/api/assistant/llm/usage/')
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({
        provider: telemetry.provider,
        model: telemetry.model,
        purpose,
        tokens_input: telemetry.tokensInput ?? 0,
        tokens_output: telemetry.tokensOutput ?? 0,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    console.warn('Failed to log LLM usage:', error)
  }
}

function extraireTokenDepuisCookies(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [rawName, ...rest] = part.split('=')
    if (!rawName || rest.length === 0) continue
    const name = rawName.trim()
    if (name !== 'access_token') continue
    const value = rest.join('=').trim()
    if (!value) continue
    return `Bearer ${value}`
  }

  return null
}

const BACKEND_FETCH_TIMEOUT_MS = Number(process.env.ASSISTANT_BACKEND_FETCH_TIMEOUT_MS ?? '12000')

async function fetchJson<T>(url: URL, token: string | null): Promise<T> {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  if (token) {
    headers.set('Authorization', token)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new BackendError(`Timeout backend après ${BACKEND_FETCH_TIMEOUT_MS} ms`, 504)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const text = await response.text()
  
  // Vérifier si la réponse est du HTML (erreur Django)
  if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
    console.error('Le backend a retourné du HTML au lieu de JSON:', text.substring(0, 200))
    throw new BackendError('Erreur interne du serveur Django', 500)
  }
  
  let data = null
  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch (error) {
    console.error('Erreur lors du parsing JSON:', error)
    console.error('Réponse brute:', text.substring(0, 500))
    throw new BackendError('Réponse invalide du serveur', 500)
  }

  if (!response.ok) {
    const detail = (data as { detail?: string; erreur?: string } | null)?.detail ?? (data as { erreur?: string } | null)?.erreur
    throw new BackendError(detail ?? `Erreur API (${response.status})`, response.status)
  }

  return data as T
}

function toTitle(value: string | null | undefined): string | null {
  if (!value) return null
  const formatted = value.replace(/_/g, ' ').toLowerCase()
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

function construireMetadataDocument(doc: DocumentDetail, resultat?: DocumentSearchResult): Record<string, unknown> {
  const exercice = doc.risque_detail?.exercice_info?.annee
  const client = doc.risque_detail?.exercice_info?.client ?? resultat?.client ?? null
  const dateDocument = doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null
  const dateFormatee = formatDate(dateDocument)
  const type = doc.type_courrier ? toTitle(doc.type_courrier) : null

  return {
    titre: doc.titre,
    description: doc.description ?? null,
    type,
    client,
    exercice,
    reference: doc.reference ?? resultat?.reference ?? null,
    date_document: dateDocument,
    date_document_formatee: dateFormatee,
    statut_archive: doc.est_archive ?? null,
    derniere_mise_a_jour: doc.cree_le ?? null,
    fichier_url: doc.fichier_url ?? null,
  }
}

function construireHighlights(metadata: Record<string, unknown>): string[] {
  const highlights: string[] = []
  const client = metadata.client as string | null
  const type = metadata.type as string | null
  const date = metadata.date_document_formatee as string | null

  if (client) {
    highlights.push(`Client : ${client}`)
  }
  if (type) {
    highlights.push(`Type : ${type}`)
  }
  if (date) {
    highlights.push(`Date : ${date}`)
  }
  const reference = metadata.reference as string | null
  if (reference) {
    highlights.push(`Référence : ${reference}`)
  }

  return highlights
}

function construireContenuDocument(doc: DocumentDetail, resultat?: DocumentSearchResult): string {
  const lignes: string[] = []

  if (doc.description) {
    lignes.push(doc.description.trim())
  }

  const client = doc.risque_detail?.exercice_info?.client ?? resultat?.client
  if (client) {
    lignes.push(`Client : ${client}`)
  }

  if (doc.reference ?? resultat?.reference) {
    lignes.push(`Référence : ${doc.reference ?? resultat?.reference}`)
  }

  if (doc.type_courrier) {
    lignes.push(`Type de courrier : ${toTitle(doc.type_courrier)}`)
  }

  const date = formatDate(doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null)
  if (date) {
    lignes.push(`Date : ${date}`)
  }

  return lignes.join('\n') || 'Informations limitées sur ce document.'
}

function tokenizeText(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/gi)
    .filter(Boolean)
}

// Type pour les filtres de recherche
type FiltresRecherche = {
  client?: string | null
  exercice?: string | null
  risque?: string | null
}

// Recherche sémantique avancée (utilise des embeddings multilingues)
async function rechercherDocumentsSemantic(
  question: string,
  token: string | null,
  topK: number,
  filtres?: FiltresRecherche
): Promise<DocumentPiece[] | null> {
  const url = buildBackendUrl('assistant/documents/search/semantic/')
  url.searchParams.set('q', question)
  url.searchParams.set('top_k', String(topK))
  url.searchParams.set('include_fallback', 'true')
  
  // Ajouter les filtres optionnels
  if (filtres?.client) {
    url.searchParams.set('client', filtres.client)
  }
  if (filtres?.exercice) {
    url.searchParams.set('exercice', filtres.exercice)
  }
  if (filtres?.risque) {
    url.searchParams.set('risque', filtres.risque)
  }

  try {
    const data = await fetchJson<{ results?: AssistantSearchResult[]; method?: string }>(url, token)
    const results = data?.results ?? []
    const method = data?.method ?? 'unknown'
    
    console.log(`=== Recherche: méthode=${method}, résultats=${results.length} ===`)
    
    if (!results.length) {
      return null
    }

    return results.map((result) => ({
      id: result.id,
      source: result.titre,
      content: result.content,
      metadata: {
        ...result.metadata,
        highlights: result.highlights ?? [],
        searchMethod: method,
      },
      score: result.score,
      isFallback: result.metadata?.isFallback === true,
    }))
  } catch (error) {
    console.warn('Recherche sémantique indisponible, fallback TF-IDF.', error)
    return null
  }
}

// Ancienne recherche FAISS (fallback)
async function rechercherDocumentsFaiss(
  question: string,
  token: string | null,
  topK: number
): Promise<DocumentPiece[] | null> {
  const url = buildBackendUrl('assistant/documents/search/faiss/')
  url.searchParams.set('q', question)
  url.searchParams.set('top_k', String(topK))
  url.searchParams.set('include_fallback', 'true')

  try {
    const data = await fetchJson<{ results?: AssistantSearchResult[] }>(url, token)
    const results = data?.results ?? []
    if (!results.length) {
      return null
    }

    return results.map((result) => ({
      id: result.id,
      source: result.titre,
      content: result.content,
      metadata: {
        ...result.metadata,
        highlights: result.highlights ?? [],
      },
      score: result.score,
      isFallback: result.metadata?.isFallback === true,
    }))
  } catch (error) {
    console.warn('Assistant FAISS search unavailable, falling back to TF-IDF.', error)
    return null
  }
}

async function rechercherDocuments(
  question: string, 
  token: string | null, 
  topK: number,
  filtres?: FiltresRecherche
): Promise<DocumentPiece[]> {
  if (!token) {
    throw new BackendError('Authentification requise pour interroger les documents.', 401)
  }

  const criteres = extraireCriteresRecherche(question)
  const referenceDemandee = criteres.reference

  // Extraire le client mentionné dans la question pour filtrer les résultats
  const clientMentionne = extraireClientMentionne(question)
  if (clientMentionne) {
    console.log(`=== Filtrage par client: ${clientMentionne} ===`)
  }
  
  // Construire les filtres pour la recherche backend
  const filtresBackend: FiltresRecherche = {
    client: filtres?.client || clientMentionne || null,
    exercice: filtres?.exercice || null,
    risque: filtres?.risque || null,
  }
  
  if (filtresBackend.client || filtresBackend.exercice || filtresBackend.risque) {
    console.log(`=== Filtres backend: client=${filtresBackend.client}, exercice=${filtresBackend.exercice}, risque=${filtresBackend.risque} ===`)
  }

  let pieces: DocumentPiece[] = []

  // 1. Essayer d'abord la recherche sémantique avec filtres (plus intelligente)
  const semanticPieces = await rechercherDocumentsSemantic(question, token, topK * 3, filtresBackend)
  if (semanticPieces && semanticPieces.length > 0) {
    pieces = semanticPieces
    console.log(`=== Recherche sémantique: ${pieces.length} résultats ===`)
  }
  
  // 2. Fallback sur FAISS si la recherche sémantique échoue
  if (!pieces.length && USE_FAISS) {
    const faissPieces = await rechercherDocumentsFaiss(question, token, topK * 3)
    if (faissPieces && faissPieces.length > 0) {
      pieces = faissPieces
      console.log(`=== Recherche FAISS: ${pieces.length} résultats ===`)
    }
  }

  if (!pieces.length) {
    const searchUrl = buildBackendUrl('assistant/documents/search/tfidf/')
    searchUrl.searchParams.set('q', question)
    searchUrl.searchParams.set('top_k', String(topK * 3)) // demander plus pour filtrer ensuite

    const data = await fetchJson<{ results?: AssistantSearchResult[] }>(searchUrl, token)
    const results = data?.results ?? []

    if (!results.length) {
      const fallback = await recupererDocumentRecent(token)
      return fallback ? [fallback] : []
    }

    pieces = results.map((result) => ({
      id: result.id,
      source: result.titre,
      content: result.content,
      metadata: {
        ...result.metadata,
        highlights: result.highlights ?? [],
      },
      score: result.score,
      isFallback: result.metadata?.isFallback === true,
    }))
  }

  // Filtrer par client si un client spécifique est mentionné dans la question
  if (clientMentionne) {
    const piecesFiltrees = pieces.filter((piece) => {
      const clientPiece = (piece.metadata?.client as string)?.toUpperCase()
      return clientPiece === clientMentionne
    })

    // Si on a des résultats filtrés, les utiliser ; sinon, garder les résultats originaux
    // mais signaler qu'on n'a pas trouvé de docs pour ce client spécifique
    if (piecesFiltrees.length > 0) {
      console.log(`=== ${piecesFiltrees.length} documents trouvés pour le client ${clientMentionne} ===`)
      const ordonnees = prioriserPiecesParReference(piecesFiltrees, referenceDemandee)
      return ordonnees.slice(0, topK)
    } else {
      console.log(`=== Aucun document trouvé pour le client ${clientMentionne}, retour des résultats généraux ===`)
      // Retourner un tableau vide pour signaler qu'on n'a rien trouvé pour ce client
      return []
    }
  }

  const ordonnees = prioriserPiecesParReference(pieces, referenceDemandee)
  return ordonnees.slice(0, topK)
}

function prioriserPiecesParReference(pieces: DocumentPiece[], referenceDemandee: string | null): DocumentPiece[] {
  if (!referenceDemandee) {
    return pieces
  }

  const ref = referenceDemandee.toUpperCase()
  const exact: DocumentPiece[] = []
  const partial: DocumentPiece[] = []
  const autres: DocumentPiece[] = []

  for (const piece of pieces) {
    const refPiece = (piece.metadata?.reference as string | undefined)?.toUpperCase()
    if (!refPiece) {
      autres.push(piece)
      continue
    }
    if (refPiece === ref) {
      exact.push(piece)
    } else if (refPiece.includes(ref)) {
      partial.push(piece)
    } else {
      autres.push(piece)
    }
  }

  if (exact.length > 0) {
    return [...exact, ...partial, ...autres]
  }
  if (partial.length > 0) {
    return [...partial, ...autres]
  }
  return pieces
}

function construireResumeDocuments(_question: string, pieces: DocumentPiece[], tone: 'amical' | 'formel' | 'concis' | 'premium' = 'amical'): string {
  const toneConfig = TONES[tone]
  
  // Extraire le client mentionné pour personnaliser le message "aucun résultat"
  const clientMentionne = extraireClientMentionne(_question)
  
  if (!pieces || pieces.length === 0) {
    if (clientMentionne) {
      return `Je n'ai trouvé aucun document pour le client ${clientMentionne} dans les archives. 🔍\n\nEs-tu sûr du code client ? Sinon, essaie avec d'autres critères de recherche.`
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

  // Introduction naturelle
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

  // Emoji selon le type
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

  // Titre du document
  const titre = metadata.titre || 'Document';
  reponse += `${emoji}${titre}\n`;

  // Infos structurées, sans gras
  if (metadata.client) reponse += `Client : ${metadata.client}\n`;
  if (metadata.type) reponse += `Type : ${metadata.type}\n`;
  if (metadata.date_document) {
    const date = new Date(metadata.date_document as string);
    if (!isNaN(date.getTime())) reponse += `Date : ${date.toLocaleDateString('fr-FR')}\n`;
  }
  if (metadata.reference) reponse += `Référence : ${metadata.reference}\n`;

  // Résumé naturel
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

  // Autres documents
  if (nbDocs > 1) {
    const clientPremierDoc = (metadata.client as string)?.toUpperCase()
    const autresClients = new Set(
      pieces.slice(1)
        .map(p => (p.metadata?.client as string)?.toUpperCase())
        .filter(Boolean)
    );
    
    // Si on a filtré par client, tous les docs sont du même client
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

  // Conclusion naturelle
  reponse += '\n\nVous pouvez les consulter ou les télécharger à tout moment.';
  reponse += "\n\nSi vous avez besoin d'aide pour un autre document ou pour une recherche, je suis là pour vous aider !";
  return reponse;
}

async function recupererTousLesDocuments(token: string | null): Promise<DocumentDetail[]> {
  if (!token) {
    throw new BackendError('Authentification requise pour consulter les statistiques.', 401)
  }

  const documents: DocumentDetail[] = []
  let nextUrl: URL | null = buildBackendUrl('documents/')
  nextUrl.searchParams.set('ordering', '-cree_le')
  nextUrl.searchParams.set('page_size', '100')

  let pages = 0
  const maxPages = 5

  while (nextUrl && pages < maxPages) {
    const data = await fetchJson<any>(nextUrl, token)
    const results = Array.isArray(data) ? (data as DocumentDetail[]) : ((data?.results ?? []) as DocumentDetail[])
    documents.push(...results)
    const nextLink = data?.next as string | null | undefined
    nextUrl = nextLink ? new URL(nextLink, API_BASE) : null
    pages += 1
  }

  return documents
}

async function recupererDocumentRecent(token: string | null): Promise<DocumentPiece | null> {
  if (!token) {
    throw new BackendError('Authentification requise pour consulter les documents.', 401)
  }

  const url = buildBackendUrl('documents/')
  url.searchParams.set('ordering', '-cree_le')
  url.searchParams.set('page_size', '1')

  const data = await fetchJson<any>(url, token)
  const results = Array.isArray(data) ? (data as DocumentDetail[]) : ((data?.results ?? []) as DocumentDetail[])
  const doc = results[0]
  if (!doc) {
    return null
  }

  const metadata = construireMetadataDocument(doc)
  const highlights = construireHighlights(metadata)

  return {
    id: doc.id,
    source: doc.titre,
    content: construireContenuDocument(doc),
    metadata: {
      ...metadata,
      highlights,
    },
    score: 0,
    isFallback: true,
  }
}

function calculerStatistiques(documents: DocumentDetail[]): Statistiques {
  const mois = new Map<string, number>()
  const clients = new Map<string, number>()

  let documentsEnRetard = 0
  let alertesPeremption = 0
  const maintenant = Date.now()

  for (const doc of documents) {
    const dateSource = doc.date_document ?? doc.cree_le
    if (dateSource) {
      const date = new Date(dateSource)
      if (!Number.isNaN(date.getTime())) {
        const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        mois.set(cle, (mois.get(cle) ?? 0) + 1)

        if (!(doc.est_archive ?? false) && maintenant - date.getTime() > THIRTY_DAYS_MS) {
          documentsEnRetard += 1
        }

        if (maintenant - date.getTime() > FIVE_YEARS_MS) {
          alertesPeremption += 1
        }
      }
    }

    const client = doc.risque_detail?.exercice_info?.client ?? 'Client inconnu'
    clients.set(client, (clients.get(client) ?? 0) + 1)
  }

  const documents_par_mois = Array.from(mois.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .reduce<Record<string, number>>((acc, [cle, total]) => {
      acc[cle] = total
      return acc
    }, {})

  const top_clients = Array.from(clients.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([client, compte]) => ({ client, compte }))

  const total = documents.length
  const taux_conformite = total > 0 ? Math.max(0, Math.min(1, (total - documentsEnRetard) / total)) : 1

  return {
    documents_par_mois,
    top_clients,
    kpi: {
      taux_conformite,
      documents_en_retard: documentsEnRetard,
      alertes_peremption: alertesPeremption,
    },
  }
}

async function collecterStatistiques(token: string | null): Promise<Statistiques> {
  if (!token) {
    throw new BackendError('Authentification requise pour consulter les statistiques.', 401)
  }

  try {
    const url = buildBackendUrl('assistant/stats/')
    const data = await fetchJson<any>(url, token)

    const statistiques: Statistiques = {
      documents_par_mois: (data?.documents_par_mois as Record<string, number>) ?? {},
      top_clients: (data?.top_clients as { client: string; compte: number }[]) ?? [],
      kpi: data?.kpi as Statistiques['kpi'],
      totaux_clients: data?.totaux_clients as Statistiques['totaux_clients'],
    }

    return statistiques
  } catch (error) {
    console.warn('assistant/stats indisponible, fallback sur calcul local', error)
    const documents = await recupererTousLesDocuments(token)
    if (!documents.length) {
      return {
        documents_par_mois: {},
        top_clients: [],
        kpi: {
          taux_conformite: 1,
          documents_en_retard: 0,
          alertes_peremption: 0,
        },
      }
    }

    return calculerStatistiques(documents)
  }
}

function construireResumeStatistiques(statistiques: Statistiques): string {
  // Phrases d'introduction variées pour plus d'humanité
  const introductions = [
    "Voici un aperçu de vos archives actuelles :",
    "J'ai analysé vos documents et voici ce que j'ai trouvé :",
    "Après analyse de votre base documentaire, voici les points importants :",
    "Voici le bilan actuel de vos archives :"
  ]
  
  const intro = introductions[Math.floor(Math.random() * introductions.length)]
  let resume = intro
  
  // Nombre total de documents archivés (tous mois confondus)
  const totalDocuments = Object.values(statistiques.documents_par_mois ?? {}).reduce(
    (acc, valeur) => acc + (valeur ?? 0),
    0,
  )
  if (totalDocuments > 0) {
    resume += `\n\nAu total, vous avez actuellement ${totalDocuments} document${totalDocuments > 1 ? 's' : ''} archivés dans ACS.`;
  }

  // Taux de conformité et retards
  if (statistiques.kpi) {
    const tauxPct = (statistiques.kpi.taux_conformite * 100).toFixed(1)
    const retards = statistiques.kpi.documents_en_retard
    const peremptions = statistiques.kpi.alertes_peremption
    
    // Formulation plus naturelle
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

  // Top clients
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

function construireInsightsStatistiques(statistiques: Statistiques): string[] {
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

function construireActionsStatistiques(statistiques: Statistiques): string[] {
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

export async function POST(request: Request) {
  let payload: QueryPayload
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ erreur: 'Corps de requête invalide' }, { status: 400 })
  }

  const questionBrute = payload.question?.trim()
  if (!questionBrute) {
    return NextResponse.json({ erreur: 'La question est requise' }, { status: 400 })
  }

  const token = extraireTokenDepuisCookies(request)

  try {
    if (!ASSISTANT_ENABLED) {
      return NextResponse.json({ erreur: 'Assistant désactivé' }, { status: 503 })
    }

    const rateLimit = verifierRateLimit(request)
    if (!rateLimit.ok) {
      return NextResponse.json({ erreur: 'Trop de requêtes, réessayez dans quelques instants.' }, { status: 429 })
    }

    // =========================================================================
    // LOGIQUE SIMPLIFIÉE - VERSION ROBUSTE
    // 1. Extraire les critères de la question
    // 2. Classifier en mode simple (recherche / conversation / salutation)
    // 3. Exécuter l'action correspondante
    // =========================================================================
    
    const startedAt = Date.now()
    const sessionId = generateSessionId(token)
    const choixClarif = extraireChoixClarification(questionBrute)
    const clarif = choixClarif ? recupererDerniereClarification(sessionId) : null

    // Hydrater l'historique depuis la persistance si nécessaire (utile en dev / hot-reload)
    await getConversationHistoryWithPersistence(sessionId, token)

    let questionOriginale = questionBrute
    let modeAssistantForce: ModeAssistant | null = null
    if (choixClarif && clarif) {
      questionOriginale = choixClarif.reste
        ? `${clarif.questionBase}\n\nPrécision utilisateur: ${choixClarif.reste}`
        : clarif.questionBase
      modeAssistantForce = choixClarif.choix === 'A' ? 'assurance_courtage' : 'recherche_document'
    }
    
    // Récupérer le contexte de conversation (pour les requêtes de suivi)
    const contexteConv = extraireContexteHistorique(sessionId)
    
    // Extraire les critères de la question originale
    const criteresQuestion = extraireCriteresRecherche(questionOriginale)
    
    // Fusionner avec le contexte de conversation (critères explicites prioritaires)
    const criteresFinal: CriteresRecherche = {
      typeDocument: criteresQuestion.typeDocument || contexteConv.typeDocument,
      client: criteresQuestion.client || contexteConv.client,
      annee: criteresQuestion.annee || contexteConv.annee,
      risque: criteresQuestion.risque || contexteConv.risque,
      typeCourrier: criteresQuestion.typeCourrier,
      reference: criteresQuestion.reference,
    }
    
    // Classification simplifiée
    const modeAssistant = modeAssistantForce ?? classifierSimple(questionOriginale, criteresFinal)
    console.log(`=== Mode: ${modeAssistant} | Critères: client=${criteresFinal.client}, année=${criteresFinal.annee}, type=${criteresFinal.typeDocument}, risque=${criteresFinal.risque} ===`)
    
    // Variables de compatibilité avec le code existant
    const question = questionOriginale
    const clientContexte = criteresFinal.client
    const anneeContexte = criteresFinal.annee
    const risqueContexte = criteresFinal.risque
    const typeDocumentContexte = criteresFinal.typeDocument
    // typeMessage pour compatibilité - transformé en type attendu par l'ancien code
    const typeMessage: string = modeAssistant === 'recherche_document' ? 'document' : modeAssistant
    const analyseComplete = { 
      type: typeMessage, 
      confidence: 0.9, 
      langue: 'fr' as const, 
      sentiment: 'neutre' as const, 
      urgence: false,
      clientDetecte: criteresFinal.client,
      typeDocDetecte: criteresFinal.typeDocument,
    }
    
    // =========================================================================
    // MODE SALUTATION
    // =========================================================================
    if (modeAssistant === 'salutation') {
      const reponse: AssistantResponse = {
        question: questionOriginale,
        type: 'documents',
        resume: 'Bienvenue',
        pieces: [],
        insights: [],
        actions: [],
        narration: {
          texte:
            "Je peux faire deux choses: (1) rechercher des documents liés à ACS et (2) répondre à des questions liées à l’assurance et au courtage. Dis-moi ce que tu veux faire.",
          source: 'heuristique',
        },
      }
      await addToConversationWithPersistence(sessionId, 'user', questionOriginale, token)
      await addToConversationWithPersistence(sessionId, 'assistant', reponse.narration!.texte, token)
      return NextResponse.json(reponse)
    }
    
    // =========================================================================
    // MODE CONFIRMATION ("oui", "ok"...) : demande de précision dans le flux
    // =========================================================================
    if (modeAssistant === 'confirmation') {
      const narrationTexte =
        "D'accord. Dis-moi ce que tu souhaites que je fasse (recherche de documents ACS, ou question assurance/courtage)."

      const reponseConv: AssistantResponse = {
        question: questionOriginale,
        type: 'documents',
        resume: narrationTexte,
        pieces: [],
        insights: [],
        actions: [],
        narration: { texte: narrationTexte, source: 'heuristique' },
      }
      
      await addToConversationWithPersistence(sessionId, 'user', questionOriginale, token)
      await addToConversationWithPersistence(sessionId, 'assistant', narrationTexte, token)
      return NextResponse.json(reponseConv)
    }

    if (modeAssistant === 'assurance_courtage') {
      const startedAtAssurance = Date.now()
      incrementRequest('documents')

      const criteresPourAmbiguite = extraireCriteresRecherche(questionOriginale)
      const estAmbigue = estQuestionAssuranceCourtageAmbigue(questionOriginale, criteresPourAmbiguite)

      let narration: AssistantResponse['narration'] = {
        texte:
          "Je peux répondre aux questions d’assurance/courtage, mais le service LLM est momentanément indisponible. Réessaie dans quelques instants.",
        source: 'heuristique',
      }

      if (isLlmConfigured()) {
        try {
          const { content, telemetry } = await generateLlmAnswer({
            question: questionOriginale,
            intent: 'documents',
            sessionId,
            token,
            customSystemPrompt: estAmbigue ? buildClarificationSystemPrompt() : buildConversationSystemPrompt(),
          })

          if (estReponseLlmFiller(content)) {
            throw new Error('Réponse LLM vide ou insuffisante')
          }

          narration = {
            texte: content,
            source: 'llm',
            telemetry,
          }
          incrementLlmSuccess()
          if (telemetry) {
            await logLlmUsage(telemetry, 'answer', token)
          }
        } catch (llmError) {
          console.warn('LLM indisponible (assurance/courtage).', llmError)
          incrementLlmFallback()
        }
      } else {
        console.warn('LLM non configuré côté front (assurance/courtage). Vérifie MISTRAL_API_KEY dans front/.env.local')
      }

      const reponseAssurance: AssistantResponse = {
        question: questionOriginale,
        type: 'documents',
        resume: narration.texte,
        pieces: [],
        insights: [],
        actions: [],
        narration,
      }

      journaliserAssistant({
        type: 'response',
        intent: 'documents',
        durationMs: Date.now() - startedAtAssurance,
        pieces: 0,
        llmUsed: narration.source === 'llm',
      })

      await addToConversationWithPersistence(sessionId, 'user', questionOriginale, token)
      await addToConversationWithPersistence(sessionId, 'assistant', narration.texte, token)
      return NextResponse.json(reponseAssurance)
    }

    if (modeAssistant === 'hors_perimetre') {
      const message =
        "Je peux uniquement (1) rechercher des documents liés à ACS et (2) répondre aux questions liées à l’assurance et au courtage. Reformule ta demande dans ce cadre."
      const reponseHorsPerimetre: AssistantResponse = {
        question: questionOriginale,
        type: 'documents',
        resume: message,
        pieces: [],
        insights: [],
        actions: [],
        narration: { texte: message, source: 'heuristique' },
      }

      await addToConversationWithPersistence(sessionId, 'user', questionOriginale, token)
      await addToConversationWithPersistence(sessionId, 'assistant', message, token)
      return NextResponse.json(reponseHorsPerimetre)
    }

    const intent = detectIntent(question)
    const role = extraireRole(request)
    if (!role) {
      return NextResponse.json({ erreur: 'Rôle utilisateur manquant ou invalide.' }, { status: 401 })
    }

    // Les salutations et certaines questions conversationnelles passaient historiquement par le LLM.
    // Avec le mode strict (docs vs assurance/courtage), on évite que ces heuristiques ne court-circuitent
    // une recherche de documents déjà identifiée.
    if (modeAssistant !== 'recherche_document' && (estSalutation(question) || typeMessage === 'conversation' || typeMessage === 'expression_emotion')) {
      const salutationStartedAt = Date.now()
      incrementRequest('documents')
      journaliserAssistant({
        type: 'request',
        intent: 'documents',
        questionLength: question.length,
      })

      let narration: AssistantResponse['narration'] = {
        texte: "Bonjour ! Je suis l'assistant ACS. Comment puis-je vous aider ?",
        source: 'heuristique',
      }

      // Passer par le LLM pour une réponse naturelle et contextuelle
      if (isLlmConfigured()) {
        try {
          const { content, telemetry } = await generateLlmAnswer({
            question: questionOriginale, // Utiliser la question originale pour le LLM
            intent: 'documents',
            sessionId,
            token,
          })
          narration = {
            texte: content,
            source: 'llm',
            telemetry,
          }
          incrementLlmSuccess()
          if (telemetry) {
            await logLlmUsage(telemetry, 'answer', token)
          }
        } catch (llmError) {
          console.warn('LLM indisponible pour salutation, fallback heuristique.', llmError)
          incrementLlmFallback()
        }
      }
      // Enregistrer l'interaction pour l'apprentissage
      const interactionIdSalutation = recordInteraction({
        question: questionOriginale,
        response: narration.texte,
        intent: 'documents',
        typeMessage: 'salutation',
        clientMentionne: null,
        typeDocMentionne: null,
        responseTimeMs: Date.now() - salutationStartedAt,
        llmUsed: narration.source === 'llm',
        userId: token ? 'authenticated' : null,
      })

      const reponseSalutation: AssistantResponse = {
        question,
        type: 'documents',
        resume: narration.texte,
        pieces: undefined,
        statistiques: undefined,
        insights: [],
        actions: [],
                narration,
        interactionId: interactionIdSalutation, // Pour le feedback ­ƒæì/­ƒæÄ
      }

      journaliserAssistant({
        type: 'response',
        intent: 'documents',
        durationMs: Date.now() - salutationStartedAt,
        pieces: 0,
        llmUsed: narration.source === 'llm',
      })
      return NextResponse.json(reponseSalutation)
    }

    // =========================================================================
    // QUESTIONS DE COMPTAGE CONTEXTUEL ("Combien en a-t-il ?")
    // Utilise le contexte de conversation pour répondre avec des statistiques
    // Prend en compte: client, type de document, et résultat précédent
    // =========================================================================
    if (estQuestionComptageContextuel(questionOriginale)) {
      // Récupérer le contexte complet de la conversation
      const contexteComplet = extraireContexteHistorique(sessionId)
      const clientCible = clientContexte ?? contexteComplet.client
      const typeCible = contexteComplet.typeDocument
      const dernierVide = contexteComplet.dernierResultatVide
      
      console.log(`=== Comptage contextuel: client=${clientCible}, type=${typeCible}, dernierVide=${dernierVide} ===`)
      
      // CAS SPÉCIAL: Si la dernière réponse disait "pas trouvé" pour un type de document
      // Alors "Combien en a-t-il ?" = "Combien de [type] ?" → 0
      if (dernierVide && typeCible && clientCible) {
        console.log(`=== Contexte: dernière recherche de ${typeCible} était vide → répondre 0 ===`)
        const comptageStartedAt = Date.now()
        incrementRequest('statistiques')
        
        const narrationComptage: AssistantResponse['narration'] = {
          texte: `Le client ${clientCible} n'a aucun${typeCible === 'facture' ? 'e' : ''} ${typeCible} dans les archives.`,
          source: 'heuristique',
        }
        
        const reponseComptage: AssistantResponse = {
          question: questionOriginale,
          type: 'statistiques',
          resume: narrationComptage.texte,
          pieces: undefined,
          statistiques: { total_documents: 0, client_filtre: clientCible, type_filtre: typeCible } as any,
          insights: [`${clientCible} : 0 ${typeCible}`],
          actions: [],
          narration: narrationComptage,
        }
        
        journaliserAssistant({
          type: 'response',
          intent: 'statistiques',
          durationMs: Date.now() - comptageStartedAt,
          pieces: 0,
          llmUsed: false,
        })
        
        return NextResponse.json(reponseComptage)
      }
      
      // CAS NORMAL: Comptage des documents du client
      if (clientCible) {
        const comptageStartedAt = Date.now()
        incrementRequest('statistiques')
        
        try {
          // Récupérer les statistiques et filtrer par client
          const statistiques = await collecterStatistiques(token)
          const clientStats = statistiques.top_clients?.find(
            c => c.client.toUpperCase() === clientCible.toUpperCase()
          )
          
          const nombreDocs = clientStats?.compte ?? 0
          let narrationComptage: AssistantResponse['narration']
          
          if (isLlmConfigured()) {
            try {
              const { content, telemetry } = await generateLlmAnswer({
                question: `Combien de documents a le client ${clientCible} ? Il en a ${nombreDocs}.`,
                intent: 'statistiques',
                statistiques: { client: clientCible, nombreDocuments: nombreDocs },
                sessionId,
                token,
              })
              narrationComptage = { texte: content, source: 'llm', telemetry }
              incrementLlmSuccess()
              if (telemetry) {
                await logLlmUsage(telemetry, 'answer', token)
              }
            } catch {
              narrationComptage = {
                texte: `Le client ${clientCible} possède ${nombreDocs} document${nombreDocs > 1 ? 's' : ''} dans les archives.`,
                source: 'heuristique',
              }
              incrementLlmFallback()
            }
          } else {
            narrationComptage = {
              texte: `Le client ${clientCible} possède ${nombreDocs} document${nombreDocs > 1 ? 's' : ''} dans les archives.`,
              source: 'heuristique',
            }
          }
          
          const reponseComptage: AssistantResponse = {
            question: questionOriginale,
            type: 'statistiques',
            resume: narrationComptage.texte,
            pieces: undefined, // Pas de pièces pour une question de comptage
            statistiques: { total_documents: nombreDocs, client_filtre: clientCible } as any,
            insights: [`${clientCible} : ${nombreDocs} documents`],
            actions: [`Voir les documents de ${clientCible}`],
            narration: narrationComptage,
          }
          
          journaliserAssistant({
            type: 'response',
            intent: 'statistiques',
            durationMs: Date.now() - comptageStartedAt,
            pieces: 0,
            llmUsed: narrationComptage.source === 'llm',
          })
          
          return NextResponse.json(reponseComptage)
        } catch (error) {
          console.warn('Erreur lors du comptage contextuel:', error)
          // Continuer avec le flux normal en cas d'erreur
        }
      }
    }

    const security = analyserRisqueQuestion(question)
    journaliserAssistant({
      type: 'security',
      intent,
      riskLevel: security.level,
      flags: security.flags,
    })
    if (security.level === 'high') {
      const message =
        "Pour des raisons de sécurité, je ne peux pas répondre à cette demande car elle ressemble à une tentative de contournement des protections de l'assistant."
      const reponseInjection: AssistantResponse = {
        question,
        type: intent,
        resume: message,
        pieces: intent === 'documents' ? [] : undefined,
        statistiques: intent === 'statistiques' ? undefined : undefined,
        insights: [],
        actions: [],
        narration: {
          texte: message,
          source: 'heuristique',
        },
        restriction: {
          reason: 'PROMPT_INJECTION',
          role,
        },
      }
      return NextResponse.json(reponseInjection, { status: 400 })
    }

    incrementRequest(intent)

    // startedAt déjà défini plus haut
    journaliserAssistant({
      type: 'request',
      intent,
      questionLength: question.length,
    })

    if (intent === 'statistiques') {
      if (!ROLES_AUTORISES_STATISTIQUES.has(role)) {
        return construireReponseRestreinte(question, intent, role)
      }
      const statistiques = await collecterStatistiques(token)
      const resumeParDefaut = construireResumeStatistiques(statistiques)
      const insights = construireInsightsStatistiques(statistiques)
      const actions = construireActionsStatistiques(statistiques)

      const typeQuestionClients = analyserQuestionClients(question)
      
      // Si c'est une question sur un client spécifique, on bascule vers la recherche de documents
      if (typeQuestionClients && typeof typeQuestionClients === 'object' && typeQuestionClients.type === 'client_specifique') {
        console.log(`=== Question sur client spécifique détectée: ${typeQuestionClients.nomClient} (${typeQuestionClients.typeDocument || 'tous documents'}) ===`)
        
        // Rediriger vers la recherche de documents pour ce client spécifique
        const clientQuery = `${typeQuestionClients.typeDocument || 'documents'} ${typeQuestionClients.nomClient}`;
        const pieces = await rechercherDocuments(clientQuery, token, payload.topK ?? DEFAULT_TOP_K)
        
        // Construire une réponse spécifique pour ce client
        const tone = payload.tone ?? 'amical'
        const resume = `Voici les ${typeQuestionClients.typeDocument || 'documents'} trouvés pour le client ${typeQuestionClients.nomClient}.`
        const insights = construireInsightsDocuments(pieces)
        const actions = construireActionsDocuments(pieces)
        
        let narration: AssistantResponse['narration'] = {
          texte: `J'ai trouvé ${pieces.length} ${typeQuestionClients.typeDocument || 'document'}${pieces.length > 1 ? 's' : ''} pour le client ${typeQuestionClients.nomClient}. Vous pouvez les consulter ci-dessous.`,
          source: 'heuristique',
        }
        
        // Si LLM est configuré, utiliser le LLM pour une réponse plus naturelle
        if (isLlmConfigured()) {
          try {
            const { content, telemetry } = await generateLlmAnswer({
              question: `Liste des ${typeQuestionClients.typeDocument || 'documents'} pour le client ${typeQuestionClients.nomClient}`,
              intent: 'documents',
              pieces,
              sessionId,
              token,
            })
            narration = {
              texte: content,
              source: 'llm',
              telemetry,
            }
            incrementLlmSuccess()
            if (telemetry) {
              await logLlmUsage(telemetry, 'answer', token)
            }
          } catch (llmError) {
            console.warn('Assistant LLM (client spécifique) indisponible, fallback heuristique.', llmError)
            incrementLlmFallback()
          }
        }
        
        const reponseClientSpecifique: AssistantResponse = {
          question,
          type: 'documents',
          resume,
          pieces,
          insights,
          actions,
                    narration,
        }
        
        journaliserAssistant({
          type: 'response',
          intent: 'documents',
          durationMs: Date.now() - startedAt,
          pieces: pieces.length,
          llmUsed: narration.source === 'llm',
        })
        
        return NextResponse.json(reponseClientSpecifique)
      }
      
      // Traitement standard pour les questions sur les statistiques générales de clients
      if (typeQuestionClients && statistiques.totaux_clients) {
        const { total, particuliers, entreprises } = statistiques.totaux_clients
        let message: string
        switch (typeQuestionClients) {
          case 'particuliers':
            message = `Actuellement, l'application ACS compte ${particuliers} client${particuliers > 1 ? 's' : ''} particulier${particuliers > 1 ? 's' : ''} sur un total de ${total} client${total > 1 ? 's' : ''}.`
            break
          case 'entreprises':
            message = `Actuellement, l'application ACS compte ${entreprises} client${entreprises > 1 ? 's' : ''} entreprise${entreprises > 1 ? 's' : ''} sur un total de ${total} client${total > 1 ? 's' : ''}.`
            break
          default:
            message = `Actuellement, l'application ACS compte ${total} client${total > 1 ? 's' : ''} au total, dont ${particuliers} particulier${particuliers > 1 ? 's' : ''} et ${entreprises} entreprise${entreprises > 1 ? 's' : ''}.`
        }

        const reponseClients: AssistantResponse = {
          question,
          type: 'statistiques',
          resume: message,
          // Pas de pièces justificatives pour les statistiques de clients
          pieces: undefined,
          statistiques,
          insights,
          actions,
          narration: {
            texte: message,
            source: 'heuristique',
          },
        }
        journaliserAssistant({
          type: 'response',
          intent,
          durationMs: Date.now() - startedAt,
          llmUsed: false,
        })
        return NextResponse.json(reponseClients)
      }

      const narration: AssistantResponse['narration'] = {
        texte: construireNarrationHeuristique(intent, resumeParDefaut, insights, actions),
        source: 'heuristique',
      }

      const reponse: AssistantResponse = {
        question,
        type: 'statistiques',
        resume: resumeParDefaut,
        // Pas de pièces justificatives pour les statistiques
        pieces: undefined,
        statistiques,
        insights,
        actions,
                narration,
      }
      journaliserAssistant({
        type: 'response',
        intent,
        durationMs: Date.now() - startedAt,
        llmUsed: false,
      })
      return NextResponse.json(reponse)
    }

    if (!ROLES_AUTORISES_DOCUMENTS.has(role)) {
      return construireReponseRestreinte(question, intent, role)
    }

    // Questions sur les capacités / limites de l'assistant :
    // on répond honnêtement sur ce qu'on peut ou ne peut pas faire, sans recherche de documents.
    if (estQuestionCapacitesAssistant(question)) {
      const messageCapacites =
        "Je peux uniquement (1) rechercher des documents liés à ACS et (2) répondre aux questions liées à l’assurance et au courtage."

      const reponseCapacites: AssistantResponse = {
        question,
        type: 'documents',
        resume: messageCapacites,
        pieces: undefined,
        statistiques: undefined,
        insights: [],
        actions: [],
        narration: {
          texte: messageCapacites,
          source: 'heuristique',
        },
      }

      console.info('assistant-demo', {
        intent: 'documents',
        questionLongueur: question.length,
        pieces: 0,
        statistiques: false,
        llm: false,
      })

      journaliserAssistant({
        type: 'response',
        intent: 'documents',
        durationMs: Date.now() - startedAt,
        pieces: 0,
        llmUsed: false,
      })

      return NextResponse.json(reponseCapacites)
    }

    // Questions de définition générale, de conseil général ou de demande d'explication de concept :
    // on ne lance PAS de recherche documentaire et on ne renvoie AUCUNE pièce justificative.
    // On laisse uniquement le LLM (Mistral) expliquer le concept ou donner des conseils.
    if (
      modeAssistant !== 'recherche_document' &&
      estQuestionAssuranceCourtage(questionOriginale) &&
      (estQuestionDefinitionGenerale(question) || estQuestionConseilGeneral(question) || estQuestionExplicationConcept(question))
    ) {
      const startedAtDefinition = Date.now()
      incrementRequest('documents')

      let narration: AssistantResponse['narration'] = {
        texte:
          "Je peux répondre aux questions d’assurance/courtage, mais le service LLM est momentanément indisponible. Réessaie dans quelques instants.",
        source: 'heuristique',
      }

      if (isLlmConfigured()) {
        try {
          const { content, telemetry } = await generateLlmAnswer({
            question: questionOriginale,
            intent: 'documents',
            sessionId,
            token,
            customSystemPrompt: buildConversationSystemPrompt(),
          })

          if (estReponseLlmFiller(content)) {
            throw new Error('Réponse LLM vide ou insuffisante')
          }

          narration = {
            texte: content,
            source: 'llm',
            telemetry,
          }
          incrementLlmSuccess()
          if (telemetry) {
            await logLlmUsage(telemetry, 'answer', token)
          }
        } catch (llmError) {
          console.warn('Assistant LLM (définition générale) indisponible.', llmError)
          incrementLlmFallback()
        }
      }
      const reponseDefinition: AssistantResponse = {
        question,
        type: 'documents',
        resume: narration.texte,
        pieces: undefined,
        statistiques: undefined,
        insights: [],
        actions: [],
                narration,
      }

      console.info('assistant-demo', {
        intent: 'documents',
        questionLongueur: question.length,
        pieces: 0,
        statistiques: false,
        llm: narration.source === 'llm',
      })

      journaliserAssistant({
        type: 'response',
        intent: 'documents',
        durationMs: Date.now() - startedAtDefinition,
        pieces: 0,
        llmUsed: narration.source === 'llm',
      })

      return NextResponse.json(reponseDefinition)
    }

    // Extraire les critères pour filtrer la recherche
    const criteresPreRecherche = extraireCriteresRecherche(questionOriginale)
    
    // Fusionner avec le contexte enrichi (les critères explicites ont priorité)
    const clientFinal = criteresPreRecherche.client || clientContexte
    const anneeFinal = criteresPreRecherche.annee || anneeContexte
    const risqueFinal = criteresPreRecherche.risque || risqueContexte
    
    console.log(`=== Critères finaux (question + contexte): client=${clientFinal}, année=${anneeFinal}, risque=${risqueFinal}, type=${criteresPreRecherche.typeDocument || typeDocumentContexte} ===`)
    
    // Construire les filtres pour la recherche backend (filtrage direct dans la base)
    const filtresRecherche: FiltresRecherche = {
      client: clientFinal,
      exercice: anneeFinal,
      risque: risqueFinal,
    }
    
    const piecesRecherche = await rechercherDocuments(question, token, payload.topK ?? DEFAULT_TOP_K, filtresRecherche)
    
    // =========================================================================
    // FILTRAGE MULTI-CRITÈRES
    // Vérifie que les documents correspondent à TOUS les critères demandés :
    // - Type de document (facture, avenant, sinistre...)
    // - Client (3CB, SANLAM...)
    // - Année (2018, 2024...)
    // - Risque (santé, auto, habitation...)
    // - Type de courrier (ACS vers Client, ACS vers Compagnie...)
    // - Référence / Numéro
    // =========================================================================
    const filtrage = filtrerParPertinence(piecesRecherche, questionOriginale)
    const typeDocumentDemande = filtrage.criteresUtilises.typeDocument
    
    // Décider quelles pièces afficher
    let pieces: DocumentPiece[]
    let messageNonTrouve = false
    let criteresManquants: string[] = []
    
    if (filtrage.pertinents.length > 0) {
      // On a trouvé des documents qui correspondent à tous les critères
      pieces = filtrage.pertinents
      console.log(`=== Filtrage: ${filtrage.pertinents.length} docs pertinents, ${filtrage.nonPertinents.length} ignorés ===`)
    } else {
      // Aucun document ne respecte tous les critères, mais on ne masque pas les résultats.
      // On renvoie quand même les documents trouvés par la recherche de base pour permettre
      // à l'utilisateur de se repérer manuellement (référence, montant, type d'avenant, etc.).
      pieces = piecesRecherche
      if (piecesRecherche.length > 0) {
        messageNonTrouve = true
        criteresManquants = filtrage.criteresNonTrouves
        console.log(`=== Filtrage souple: aucun document ne respecte tous les critères, mais ${piecesRecherche.length} docs candidats sont renvoyés ===`)
      }
    }
    
    const tone = payload.tone ?? 'amical' // Ton par défaut : amical
    const resume = construireResumeDocuments(question, pieces, tone)
    const insights = construireInsightsDocuments(pieces)
    const actions = construireActionsDocuments(pieces)
    let narration: AssistantResponse['narration'] | undefined

    if (isLlmConfigured()) {
      try {
        // Informer le LLM si on n'a pas trouvé le type demandé
        const contextePourLlm = messageNonTrouve 
          ? `L'utilisateur cherchait des "${typeDocumentDemande}s" mais aucun n'a été trouvé dans les archives.`
          : undefined
        
        const { content, telemetry } = await generateLlmAnswer({
          question: questionOriginale,
          intent,
          pieces: messageNonTrouve ? [] : pieces, // Ne pas envoyer des pièces non pertinentes au LLM
          sessionId,
          token,
        })
        
        // Validation de la réponse contre les données connues
        const validation = validateResponse(content)
        if (!validation.isValid) {
          console.warn('LLM response validation warnings:', validation.warnings)
        }
        
        narration = {
          texte: content,
          source: 'llm',
          telemetry,
        }
        incrementLlmSuccess()
        if (telemetry) {
          await logLlmUsage(telemetry, 'answer', token)
        }
      } catch (llmError) {
        console.warn('Assistant LLM (documents) indisponible, fallback heuristique.', llmError)
        incrementLlmFallback()
      }
    }

    if (!narration) {
      // Narration heuristique adaptée selon les résultats et les critères utilisés
      const criteres = filtrage.criteresUtilises
      
      if (messageNonTrouve) {
        // Construire un message précis basé sur les critères demandés
        const partiesCriteres: string[] = []
        if (criteres.typeDocument) partiesCriteres.push(`de type "${criteres.typeDocument}"`)
        if (criteres.client) partiesCriteres.push(`du client ${criteres.client}`)
        if (criteres.annee) partiesCriteres.push(`de l'année ${criteres.annee}`)
        if (criteres.risque) partiesCriteres.push(`pour le risque ${criteres.risque}`)
        if (criteres.typeCourrier) partiesCriteres.push(`(${criteres.typeCourrier})`)
        if (criteres.reference) partiesCriteres.push(`avec la référence ${criteres.reference}`)
        
        const descriptionRecherche = partiesCriteres.length > 0 
          ? partiesCriteres.join(' ') 
          : 'correspondant à votre recherche'
        
        // Indiquer quels types de critères semblent particulièrement bloquants
        let detailCriteres = ''
        if (criteresManquants.length > 0) {
          const labels = Array.from(new Set(
            criteresManquants
              .map((c) => libelleCritere(c as keyof CriteresRecherche))
              .filter(Boolean)
          ))
          if (labels.length > 0) {
            detailCriteres = `\n\nAucun document ne respecte simultanément tous ces critères. Les critères les plus restrictifs semblent être : ${labels.join(', ')}.`
          }
        }
        const nbPiecesCandidats = pieces.length
        const infoCandidats = nbPiecesCandidats > 0
          ? `\n\nEn revanche, j'ai trouvé ${nbPiecesCandidats} document${nbPiecesCandidats > 1 ? 's' : ''} qui correspondent partiellement à votre recherche. Je les affiche ci-dessous pour que vous puissiez vérifier manuellement (référence, montant, type d'avenant, etc.).`
          : ''

        narration = {
          texte: `Je n'ai pas trouvé de document ${descriptionRecherche} dans les archives.${detailCriteres}${infoCandidats}`,
          source: 'heuristique',
        }
      } else if (pieces.length > 0) {
        // On a trouvé des résultats - générer un message cohérent
        const nbPieces = pieces.length
        const clientTrouve = pieces[0]?.metadata?.client as string || clientContexte
        
        // Vérifier si l'année demandée correspond aux documents trouvés
        const anneeMatch = questionOriginale.match(/\b(19|20)\d{2}\b/)
        const anneeDemandee = anneeMatch ? anneeMatch[0] : null
        
        let messageResultat = ''
        if (anneeDemandee) {
          // Vérifier si les documents trouvés correspondent à l'année
          // On s'appuie en priorité sur l'année d'exercice, la date d'ajout ne doit pas influer.
          const docsAnneeCorrecte = pieces.filter(p => {
            const exerciceMeta = String(p.metadata?.exercice ?? '')
            const dateDoc = (p.metadata?.date_document as string) || ''
            return exerciceMeta.includes(anneeDemandee) || dateDoc.includes(anneeDemandee)
          })
          
          if (docsAnneeCorrecte.length === 0 && pieces.length > 0) {
            // On a des docs mais pas de l'année demandée
            messageResultat = `Je n'ai pas trouvé de documents de ${anneeDemandee}, mais voici ${nbPieces > 1 ? 'les documents les plus récents' : 'le document le plus récent'} correspondant à votre recherche.`
          } else if (docsAnneeCorrecte.length > 0) {
            messageResultat = `J'ai trouvé ${docsAnneeCorrecte.length} document${docsAnneeCorrecte.length > 1 ? 's' : ''} de ${anneeDemandee}.`
          } else {
            messageResultat = construireNarrationHeuristique(intent, resume, insights, actions)
          }
        } else {
          messageResultat = construireNarrationHeuristique(intent, resume, insights, actions)
        }
        
        narration = {
          texte: messageResultat,
          source: 'heuristique',
        }
      } else {
        narration = {
          texte: construireNarrationHeuristique(intent, resume, insights, actions),
          source: 'heuristique',
        }
      }
    }

    // Garde-fou : si des documents existent, ne jamais annoncer qu'on n'a rien trouvé.
    // Sauf dans le cas contrôlé messageNonTrouve, où on explique explicitement
    // qu'aucun document ne respecte TOUS les critères mais que des candidats sont affichés.
    if (narration && pieces.length > 0 && !messageNonTrouve) {
      const texteLower = narration.texte.toLowerCase()
      const patternsNegatifs = [
        "je n'ai pas trouv",
        'je n ai pas trouv',
        'aucun document',
      ]
      const contientNegatif = patternsNegatifs.some((p) => texteLower.includes(p))

      if (contientNegatif) {
        const criteresPourNarration = filtrage.criteresUtilises
        const contextePourNarration = {
          client: clientFinal ?? clientContexte,
          annee: anneeFinal ?? anneeContexte,
          risque: risqueFinal ?? risqueContexte,
        }
        const texteCorrige = genererNarrationSimple(pieces, criteresPourNarration, contextePourNarration)
        narration = {
          texte: texteCorrige,
          source: 'heuristique',
        }
      }
    }
    const clientPourSuggestions = clientFinal ?? extraireClientMentionne(question)

    // Enregistrer l'interaction pour l'apprentissage
    const interactionId = recordInteraction({
      question: questionOriginale,
      response: narration.texte,
      intent: 'documents',
      typeMessage,
      clientMentionne: clientPourSuggestions,
      typeDocMentionne: analyseComplete.typeDocDetecte,
      responseTimeMs: Date.now() - startedAt,
      llmUsed: narration.source === 'llm',
      userId: token ? 'authenticated' : null,
    })

    const trace: AssistantTrace = {
      mode: modeAssistant,
      intent,
      typeMessage,
      criteres: {
        client: clientFinal ?? clientContexte ?? null,
        annee: anneeFinal ?? anneeContexte ?? null,
        risque: risqueFinal ?? risqueContexte ?? null,
        typeDocument: typeDocumentDemande ?? typeDocumentContexte ?? null,
      },
      documentSearch: {
        totalFound: piecesRecherche.length,
        filteredFound: filtrage.pertinents.length,
        messageNonTrouve,
        criteresUtilises: filtrage.criteresUtilises,
        criteresNonTrouves: filtrage.criteresNonTrouves,
      },
      llm: {
        used: narration?.source === 'llm',
        provider: narration?.telemetry?.provider,
        model: narration?.telemetry?.model,
        durationMs: narration?.telemetry?.durationMs,
      },
    }

    const reponse: AssistantResponse = {
      question,
      type: 'documents',
      resume,
      pieces,
      insights,
      actions,
      narration,
      interactionId, // Pour permettre le feedback ­ƒæì/­ƒæÄ
      trace,
    }

    // =========================================================================
    // STOCKAGE DANS L'HISTORIQUE DE CONVERSATION
    // Permet de conserver le contexte pour les requetes de suivi
    // =========================================================================
    await addToConversationWithPersistence(sessionId, 'user', questionOriginale, token)
    await addToConversationWithPersistence(sessionId, 'assistant', narration.texte, token)

    console.info('assistant-demo', {
      intent,
      questionLongueur: question.length,
      pieces: pieces.length,
      statistiques: false,
      llm: narration?.source === 'llm',
      interactionId,
    })

    journaliserAssistant({
      type: 'response',
      intent,
      durationMs: Date.now() - startedAt,
      pieces: pieces.length,
      llmUsed: narration.source === 'llm',
    })

    return NextResponse.json(reponse)
  } catch (error) {
    incrementErrors()
    console.error('Erreur assistant-demo', error)
    if (error instanceof BackendError) {
      journaliserAssistant({
        type: 'error',
        intent: undefined,
        durationMs: 0,
        message: error.message,
        status: error.status,
      })
      return NextResponse.json({ erreur: error.message }, { status: error.status })
    }
    journaliserAssistant({
      type: 'error',
      intent: undefined,
      durationMs: 0,
      message: (error as Error)?.message ?? 'Erreur interne',
    })
    return NextResponse.json({ erreur: "Erreur interne de l'assistant" }, { status: 500 })
  }
}
