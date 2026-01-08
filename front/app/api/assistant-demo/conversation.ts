/**
 * Gestion de la persistance des conversations de l'assistant.
 * Utilise le backend Django pour sauvegarder les messages.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

type ConversationMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

type Conversation = {
  id: string
  titre: string
  memoire_resume?: string
  memoire_etat?: Record<string, unknown>
  messages: ConversationMessage[]
  creeLe: string
  modifieLe: string
}

// Cache local pour éviter trop d'appels API
const localCache = new Map<string, ConversationMessage[]>()
const conversationIdCache = new Map<string, string>() // sessionId -> conversationId

type ConversationMemory = {
  conversationId: string
  memoire_resume: string
  memoire_etat: Record<string, unknown>
}

const memoryCache = new Map<string, { value: ConversationMemory; updatedAt: number }>()
const MEMORY_TTL_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Snapshot d'un contexte pour la pile (return_subject)
 */
export type ContextSnapshot = {
  client: string | null
  annee: string | null
  risque: string | null
  type_document: string | null
  timestamp: number
  label: string // Ex: "SONATEL 2024"
}

/**
 * Télémétrie pour le routeur de sujet
 */
export type SubjectTelemetry = {
  timestamp: number
  question: string
  transition: SubjectTransition
  confidence: number
  contextBefore: ContextSnapshot
  contextAfter: ContextSnapshot
  wasOverridden: boolean // Si l'utilisateur a corrigé immédiatement après
}

/**
 * Structure de mémoire enrichie pour ACS Archive
 * Basée sur les recommandations ChatGPT pour un système de contexte robuste
 */
export type StructuredMemory = {
  objectif_principal: string
  entites: {
    client: { valeur: string | null; lock: boolean }
    annee: { valeur: string | null; lock: boolean }
    risque: { valeur: string | null; lock: boolean }
    type_document: { valeur: string | null; lock: boolean }
  }
  focus_actuel: {
    type: 'documents' | 'client' | 'statistiques' | null
    valeur: string | null
  }
  documents: {
    mentionnes: string[]
    selectionne: string | null
  }
  // Document actif pour les questions de suivi (résume, analyse, etc.)
  document_actif: {
    id: string | null
    titre: string | null
    contenu: string | null // Texte extrait du document
    metadata: Record<string, unknown> | null
  } | null
  resultats: {
    documents_trouves: number // Nombre brut, pas de texte libre
    derniere_recherche: string | null
  }
  sujets_abordes: string[]
  dernieres_conclusions: string[]
  etat_conversation: 'salutation' | 'recherche_en_cours' | 'resultats_affiches' | 'question_generale' | 'hors_sujet'
  // Sprint 3: Pile de contextes pour return_subject
  contextStack: ContextSnapshot[]
}

/**
 * Crée une mémoire structurée vide
 */
export function createEmptyStructuredMemory(): StructuredMemory {
  return {
    objectif_principal: '',
    entites: {
      client: { valeur: null, lock: false },
      annee: { valeur: null, lock: false },
      risque: { valeur: null, lock: false },
      type_document: { valeur: null, lock: false },
    },
    focus_actuel: {
      type: null,
      valeur: null,
    },
    documents: {
      mentionnes: [],
      selectionne: null,
    },
    document_actif: null, // Pas de document actif au départ
    resultats: {
      documents_trouves: 0,
      derniere_recherche: null,
    },
    sujets_abordes: [],
    dernieres_conclusions: [],
    etat_conversation: 'salutation',
    contextStack: [], // Pile de contextes pour return_subject
  }
}

/**
 * Met à jour la mémoire structurée avec les nouvelles informations
 */
export function updateStructuredMemory(
  current: StructuredMemory,
  update: {
    client?: string | null
    annee?: string | null
    risque?: string | null
    type_document?: string | null
    document_mentionne?: string
    document_selectionne?: string | null
    document_actif?: {
      id: string
      titre: string
      contenu: string
      metadata: Record<string, unknown>
    } | null
    documents_trouves?: number
    derniere_recherche?: string | null
    focus_type?: StructuredMemory['focus_actuel']['type']
    focus_valeur?: string | null
    sujet?: string
    conclusion?: string
    etat?: StructuredMemory['etat_conversation']
    objectif?: string
    lock_entites?: boolean // Si true, verrouille les entités actuelles
  }
): StructuredMemory {
  // Deep copy pour éviter les mutations
  const newMemory: StructuredMemory = {
    ...current,
    entites: {
      client: { ...current.entites.client },
      annee: { ...current.entites.annee },
      risque: { ...current.entites.risque },
      type_document: { ...current.entites.type_document },
    },
    focus_actuel: { ...current.focus_actuel },
    documents: { ...current.documents, mentionnes: [...current.documents.mentionnes] },
    document_actif: current.document_actif ? { ...current.document_actif } : null,
    resultats: { ...current.resultats },
    sujets_abordes: [...current.sujets_abordes],
    dernieres_conclusions: [...current.dernieres_conclusions],
  }
  
  // Mise à jour des entités (respecte le lock si activé)
  if (update.client !== undefined && !current.entites.client.lock) {
    newMemory.entites.client = { valeur: update.client, lock: update.lock_entites ?? false }
  }
  if (update.annee !== undefined && !current.entites.annee.lock) {
    newMemory.entites.annee = { valeur: update.annee, lock: update.lock_entites ?? false }
  }
  if (update.risque !== undefined && !current.entites.risque.lock) {
    newMemory.entites.risque = { valeur: update.risque, lock: update.lock_entites ?? false }
  }
  if (update.type_document !== undefined && !current.entites.type_document.lock) {
    newMemory.entites.type_document = { valeur: update.type_document, lock: update.lock_entites ?? false }
  }
  
  // Verrouiller les entités si demandé
  if (update.lock_entites) {
    if (newMemory.entites.client.valeur) newMemory.entites.client.lock = true
    if (newMemory.entites.annee.valeur) newMemory.entites.annee.lock = true
    if (newMemory.entites.risque.valeur) newMemory.entites.risque.lock = true
    if (newMemory.entites.type_document.valeur) newMemory.entites.type_document.lock = true
  }
  
  // Mise à jour du focus actuel
  if (update.focus_type !== undefined) {
    newMemory.focus_actuel.type = update.focus_type
  }
  if (update.focus_valeur !== undefined) {
    newMemory.focus_actuel.valeur = update.focus_valeur
  }
  
  // Mise à jour des documents (limité à 5 derniers)
  if (update.document_mentionne) {
    newMemory.documents.mentionnes = [
      ...newMemory.documents.mentionnes.filter(d => d !== update.document_mentionne),
      update.document_mentionne
    ].slice(-5)
  }
  if (update.document_selectionne !== undefined) {
    newMemory.documents.selectionne = update.document_selectionne
  }
  
  // Mise à jour des résultats (nombre brut, pas de texte)
  if (update.documents_trouves !== undefined) {
    newMemory.resultats.documents_trouves = update.documents_trouves
  }
  if (update.derniere_recherche !== undefined) {
    newMemory.resultats.derniere_recherche = update.derniere_recherche
  }
  
  // Mise à jour du document actif (pour les questions de suivi)
  if (update.document_actif !== undefined) {
    newMemory.document_actif = update.document_actif
  }
  
  // Mise à jour des sujets (limité à 5 derniers)
  if (update.sujet) {
    newMemory.sujets_abordes = [
      ...newMemory.sujets_abordes.filter(s => s !== update.sujet),
      update.sujet
    ].slice(-5)
  }
  
  // Mise à jour des conclusions (limité à 3 dernières)
  if (update.conclusion) {
    newMemory.dernieres_conclusions = [
      ...newMemory.dernieres_conclusions,
      update.conclusion
    ].slice(-3)
  }
  
  // Mise à jour de l'état et objectif
  if (update.etat) newMemory.etat_conversation = update.etat
  if (update.objectif) newMemory.objectif_principal = update.objectif
  
  return newMemory
}

/**
 * Détecte si la question est une demande de suivi sur le document actif
 * (résume, analyse, explique, etc.)
 */
export function isDocumentFollowUpQuestion(question: string, memory: StructuredMemory): boolean {
  // Pas de document actif → pas de suivi possible
  if (!memory.document_actif && !memory.documents.selectionne) {
    return false
  }
  
  const lower = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  
  // Patterns de questions de suivi sur un document
  const followUpPatterns = [
    /\b(resume|resumer|resumes?)\s+(son|le|ce|du)\s*(contenu|document)?/i,
    /\b(analyse|analyser|analyses?)\s+(son|le|ce|du)\s*(contenu|document)?/i,
    /\b(explique|expliquer|expliques?)\s+(son|le|ce|du)\s*(contenu|document)?/i,
    /\b(son contenu|le contenu|ce contenu)\b/i,
    /\b(qu'?est[- ]ce qu'?il (contient|dit|montre|indique))\b/i,
    /\b(de quoi (parle|traite|s'?agit))\b/i,
    /\b(lis|lire|lecture)\s+(le|ce|moi)\b/i,
    /\b(c'?est quoi ce document)\b/i,
    /\b(donne[- ]moi (un resume|les details|plus d'?infos?))\b/i,
    /\b(que dit (ce|le) document)\b/i,
    /\b(quelles? (sont|informations?))\b.*\b(document|contenu)\b/i,
    /^resume[- ]le$/i,
    /^analyse[- ]le$/i,
    /^explique[- ]le$/i,
    /^c'?est quoi\??$/i,
    /^de quoi (ca|ça) parle\??$/i,
  ]
  
  return followUpPatterns.some(pattern => pattern.test(lower))
}

/**
 * Génère le prompt pour le document actif (à injecter dans le system prompt)
 */
export function buildDocumentActivePrompt(memory: StructuredMemory): string | null {
  if (!memory.document_actif) {
    return null
  }
  
  const doc = memory.document_actif
  let prompt = `[DOCUMENT ACTIF]\n`
  prompt += `Titre: ${doc.titre || 'Non spécifié'}\n`
  
  if (doc.metadata) {
    const meta = doc.metadata
    if (meta.client) prompt += `Client: ${meta.client}\n`
    if (meta.exercice) prompt += `Exercice: ${meta.exercice}\n`
    if (meta.type_courrier) prompt += `Type: ${meta.type_courrier}\n`
    if (meta.risque) prompt += `Risque: ${meta.risque}\n`
    if (meta.reference) prompt += `Référence: ${meta.reference}\n`
    if (meta.date_ajout) prompt += `Date: ${meta.date_ajout}\n`
  }
  
  if (doc.contenu) {
    // Limiter le contenu à 2000 caractères pour ne pas surcharger le prompt
    const contenuTronque = doc.contenu.length > 2000 
      ? doc.contenu.substring(0, 2000) + '...[tronqué]'
      : doc.contenu
    prompt += `\nContenu du document:\n${contenuTronque}\n`
  }
  
  prompt += `\nIMPORTANT: Réponds UNIQUEMENT en te basant sur le contenu ci-dessus. Ne déduis pas d'informations supplémentaires.`
  
  return prompt
}

/**
 * Convertit la mémoire structurée en texte pour injection dans le prompt
 */
export function structuredMemoryToPrompt(memory: StructuredMemory): string {
  const parts: string[] = []
  
  if (memory.objectif_principal) {
    parts.push(`Objectif: ${memory.objectif_principal}`)
  }
  
  // Entités actives (avec indication de lock)
  const entites: string[] = []
  if (memory.entites.client.valeur) {
    entites.push(`Client: ${memory.entites.client.valeur}${memory.entites.client.lock ? ' [fixé]' : ''}`)
  }
  if (memory.entites.annee.valeur) {
    entites.push(`Année: ${memory.entites.annee.valeur}${memory.entites.annee.lock ? ' [fixé]' : ''}`)
  }
  if (memory.entites.risque.valeur) {
    entites.push(`Risque: ${memory.entites.risque.valeur}${memory.entites.risque.lock ? ' [fixé]' : ''}`)
  }
  if (memory.entites.type_document.valeur) {
    entites.push(`Type doc: ${memory.entites.type_document.valeur}${memory.entites.type_document.lock ? ' [fixé]' : ''}`)
  }
  if (entites.length > 0) {
    parts.push(`Contexte actuel: ${entites.join(', ')}`)
  }
  
  // Focus actuel
  if (memory.focus_actuel.type && memory.focus_actuel.valeur) {
    parts.push(`Focus: ${memory.focus_actuel.type} - ${memory.focus_actuel.valeur}`)
  }
  
  // Résultats (nombre brut)
  if (memory.resultats.documents_trouves > 0) {
    parts.push(`Dernière recherche: ${memory.resultats.documents_trouves} document(s) trouvé(s)`)
  }
  
  // Document sélectionné
  if (memory.documents.selectionne) {
    parts.push(`Document en cours: ${memory.documents.selectionne}`)
  }
  
  // Sujets abordés
  if (memory.sujets_abordes.length > 0) {
    parts.push(`Sujets abordés: ${memory.sujets_abordes.join(', ')}`)
  }
  
  // Dernières conclusions
  if (memory.dernieres_conclusions.length > 0) {
    parts.push(`Points clés: ${memory.dernieres_conclusions.join(' | ')}`)
  }
  
  // État
  parts.push(`État: ${memory.etat_conversation}`)
  
  return parts.join('\n')
}

/**
 * Type de transition de sujet détecté
 */
export type SubjectTransition = 
  | 'continuity'      // Même sujet, question de suivi
  | 'new_subject'     // Nouveau sujet, reset partiel nécessaire
  | 'return_subject'  // Retour à un sujet précédent
  | 'clarification'   // Demande de clarification sur le contexte actuel
  | 'low_confidence'  // Confiance trop basse, demander clarification

/**
 * Résultat de l'analyse de transition de sujet
 */
export type SubjectAnalysis = {
  transition: SubjectTransition
  confidence: number // 0-1
  newClient: string | null
  returnToIndex: number | null // Index dans contextStack pour return_subject
  shouldResetClient: boolean
  shouldResetYear: boolean
  shouldResetDocType: boolean
  shouldResetRisk: boolean
  reason: string
  needsClarification: boolean // Si true, demander confirmation à l'utilisateur
}

// Seuil de confiance minimum pour appliquer une transition automatiquement
export const CONFIDENCE_THRESHOLD = 0.7

/**
 * Détecte le type de transition de sujet dans la conversation
 * C'est le "routeur de sujet" recommandé par ChatGPT
 */
export function detectSubjectTransition(
  currentMemory: StructuredMemory,
  newQuestion: string,
  newCriteres: {
    client?: string | null
    annee?: string | null
    type_document?: string | null
    risque?: string | null
  }
): SubjectAnalysis {
  const questionLower = newQuestion.toLowerCase()
  
  // Patterns de continuité (questions de suivi)
  const continuityPatterns = [
    /^(et|aussi|également|de plus|en plus)/i,
    /\b(les autres|le reste|encore|d'autres)\b/i,
    /\b(celui-ci|celle-ci|ceux-ci|ce document|ces documents)\b/i,
    /\b(le même|la même|les mêmes)\b/i,
    /\b(pour lui|pour eux|pour ce client)\b/i,
    /^(montre|affiche|donne)(-moi)?\s+(les autres|plus|encore)/i,
    // Questions sur le document affiché
    /\b(résume|résumer|résumé)\s+(son|le|ce)\s+(contenu|document)/i,
    /\b(analyse|analyser|analyser)\s+(son|le|ce)\s+(contenu|document)/i,
    /\b(son contenu|le contenu|ce contenu)\b/i,
    /\b(qu'est-ce qu'il (contient|dit|montre))\b/i,
    /\b(de quoi (parle|traite))\b/i,
    /\b(lis|lire|lecture)\s+(le|ce|moi)\b/i,
    /\b(ouvre|ouvrir|télécharge|télécharger)\s+(le|ce)\b/i,
  ]
  
  // Patterns de nouveau sujet explicite
  const newSubjectPatterns = [
    /\b(maintenant|plutôt|sinon|autrement)\b.*\b(cherche|trouve|montre)/i,
    /\b(change|passe|passons)\s+(à|au|aux)\b/i,
    /\b(nouveau|autre)\s+(client|sujet|recherche)\b/i,
    /\b(oublie|laisse tomber|annule)\b/i,
  ]
  
  // Patterns de clarification
  const clarificationPatterns = [
    /\b(c'est quoi|qu'est-ce que|quel est|quelle est)\b/i,
    /\b(explique|précise|détaille)\b/i,
    /\b(je ne comprends pas|pas compris)\b/i,
  ]
  
  // Patterns de retour à un sujet précédent (return_subject)
  const returnSubjectPatterns = [
    /\b(reviens?|retourne?|retournons?)\s+(au?|sur)\s+(sujet|client|contexte)\s+(précédent|d'avant|avant)/i,
    /\b(le client|celui)\s+(d'avant|précédent)/i,
    /\b(comme (tout à l'heure|avant|tantôt))\b/i,
    /\b(reprends?|reprendre)\s+(le sujet|où on en était)/i,
    /\b(on parlait de|on cherchait)\s+(\w+)\s+(avant|tout à l'heure)/i,
  ]
  
  // Vérifier les patterns
  const isContinuity = continuityPatterns.some(p => p.test(questionLower))
  const isExplicitNewSubject = newSubjectPatterns.some(p => p.test(questionLower))
  const isClarification = clarificationPatterns.some(p => p.test(questionLower))
  const isReturnSubject = returnSubjectPatterns.some(p => p.test(questionLower))
  
  // Analyser les changements d'entités
  const currentClient = currentMemory.entites.client.valeur
  const currentYear = currentMemory.entites.annee.valeur
  const currentDocType = currentMemory.entites.type_document.valeur
  
  const hasNewClient = newCriteres.client && newCriteres.client !== currentClient
  const hasNewYear = newCriteres.annee && newCriteres.annee !== currentYear
  const hasNewDocType = newCriteres.type_document && newCriteres.type_document !== currentDocType
  
  // Vérifier si le client mentionné est dans la pile de contextes (return_subject implicite)
  let returnToIndex: number | null = null
  if (newCriteres.client && currentMemory.contextStack.length > 0) {
    const clientLower = newCriteres.client.toLowerCase()
    returnToIndex = currentMemory.contextStack.findIndex(
      ctx => ctx.client?.toLowerCase() === clientLower
    )
    if (returnToIndex === -1) returnToIndex = null
  }
  
  // Cas 0: Retour explicite à un sujet précédent
  if (isReturnSubject && currentMemory.contextStack.length > 0) {
    const lastIndex = currentMemory.contextStack.length - 1
    return {
      transition: 'return_subject',
      confidence: 0.95,
      newClient: currentMemory.contextStack[lastIndex]?.client || null,
      returnToIndex: lastIndex,
      shouldResetClient: false,
      shouldResetYear: false,
      shouldResetDocType: false,
      shouldResetRisk: false,
      reason: 'Retour explicite au sujet précédent',
      needsClarification: false,
    }
  }
  
  // Cas 0b: Client mentionné est dans la pile (return_subject implicite)
  if (returnToIndex !== null && !isExplicitNewSubject) {
    return {
      transition: 'return_subject',
      confidence: 0.85,
      newClient: newCriteres.client || null,
      returnToIndex,
      shouldResetClient: false,
      shouldResetYear: false,
      shouldResetDocType: false,
      shouldResetRisk: false,
      reason: `Retour au client précédent: ${newCriteres.client}`,
      needsClarification: false,
    }
  }
  
  // Cas 1: Clarification
  if (isClarification && !hasNewClient && !hasNewYear && !hasNewDocType) {
    return {
      transition: 'clarification',
      confidence: 0.9,
      newClient: null,
      returnToIndex: null,
      shouldResetClient: false,
      shouldResetYear: false,
      shouldResetDocType: false,
      shouldResetRisk: false,
      reason: 'Demande de clarification détectée',
      needsClarification: false,
    }
  }
  
  // Cas 2: Continuité explicite
  if (isContinuity && !hasNewClient) {
    return {
      transition: 'continuity',
      confidence: 0.95,
      newClient: null,
      returnToIndex: null,
      shouldResetClient: false,
      shouldResetYear: false,
      shouldResetDocType: false,
      shouldResetRisk: false,
      reason: 'Question de suivi sur le même contexte',
      needsClarification: false,
    }
  }
  
  // Cas 3: Nouveau sujet explicite
  if (isExplicitNewSubject) {
    return {
      transition: 'new_subject',
      confidence: 0.9,
      newClient: newCriteres.client || null,
      returnToIndex: null,
      shouldResetClient: true,
      shouldResetYear: true,
      shouldResetDocType: true,
      shouldResetRisk: true,
      reason: 'Changement de sujet explicite détecté',
      needsClarification: false,
    }
  }
  
  // Cas 4: Nouveau client mentionné (changement implicite) - confiance moyenne
  if (hasNewClient) {
    const confidence = 0.65 // Confiance réduite car implicite
    return {
      transition: confidence >= CONFIDENCE_THRESHOLD ? 'new_subject' : 'low_confidence',
      confidence,
      newClient: newCriteres.client || null,
      returnToIndex: null,
      shouldResetClient: true,
      shouldResetYear: !newCriteres.annee,
      shouldResetDocType: !newCriteres.type_document,
      shouldResetRisk: !newCriteres.risque,
      reason: `Nouveau client détecté: ${newCriteres.client}`,
      needsClarification: confidence < CONFIDENCE_THRESHOLD,
    }
  }
  
  // Cas 5: Pas de client actuel et nouveau client
  if (!currentClient && newCriteres.client) {
    return {
      transition: 'new_subject',
      confidence: 0.8,
      newClient: newCriteres.client,
      returnToIndex: null,
      shouldResetClient: false,
      shouldResetYear: false,
      shouldResetDocType: false,
      shouldResetRisk: false,
      reason: 'Premier client de la conversation',
      needsClarification: false,
    }
  }
  
  // Cas 6: Question vague sans changement → continuité par défaut
  if (!hasNewClient && !hasNewYear && !hasNewDocType && currentClient) {
    return {
      transition: 'continuity',
      confidence: 0.7,
      newClient: null,
      returnToIndex: null,
      shouldResetClient: false,
      shouldResetYear: false,
      shouldResetDocType: false,
      shouldResetRisk: false,
      reason: 'Question vague, maintien du contexte actuel',
      needsClarification: false,
    }
  }
  
  // Cas par défaut: confiance trop basse, demander clarification
  return {
    transition: 'low_confidence',
    confidence: 0.5,
    newClient: null,
    returnToIndex: null,
    shouldResetClient: false,
    shouldResetYear: false,
    shouldResetDocType: false,
    shouldResetRisk: false,
    reason: 'Aucun pattern clair détecté, clarification recommandée',
    needsClarification: true,
  }
}

/**
 * Crée un snapshot du contexte actuel pour la pile
 */
export function createContextSnapshot(memory: StructuredMemory): ContextSnapshot {
  const client = memory.entites.client.valeur
  const annee = memory.entites.annee.valeur
  return {
    client,
    annee,
    risque: memory.entites.risque.valeur,
    type_document: memory.entites.type_document.valeur,
    timestamp: Date.now(),
    label: [client, annee].filter(Boolean).join(' ') || 'Contexte vide',
  }
}

/**
 * Applique un reset partiel de la mémoire selon l'analyse de transition
 */
export function applySubjectTransition(
  memory: StructuredMemory,
  analysis: SubjectAnalysis
): StructuredMemory {
  // Si continuité, clarification ou low_confidence, pas de changement
  if (analysis.transition === 'continuity' || 
      analysis.transition === 'clarification' ||
      analysis.transition === 'low_confidence') {
    return memory
  }
  
  // Deep copy avec contextStack
  const newMemory: StructuredMemory = {
    ...memory,
    entites: {
      client: { ...memory.entites.client },
      annee: { ...memory.entites.annee },
      risque: { ...memory.entites.risque },
      type_document: { ...memory.entites.type_document },
    },
    focus_actuel: { ...memory.focus_actuel },
    documents: { ...memory.documents, mentionnes: [...memory.documents.mentionnes] },
    resultats: { ...memory.resultats },
    sujets_abordes: [...memory.sujets_abordes],
    dernieres_conclusions: [...memory.dernieres_conclusions],
    contextStack: [...memory.contextStack],
  }
  
  // Cas return_subject: restaurer un contexte précédent
  if (analysis.transition === 'return_subject' && analysis.returnToIndex !== null) {
    const restoredContext = memory.contextStack[analysis.returnToIndex]
    if (restoredContext) {
      // Restaurer les entités du contexte précédent
      newMemory.entites.client = { valeur: restoredContext.client, lock: false }
      newMemory.entites.annee = { valeur: restoredContext.annee, lock: false }
      newMemory.entites.risque = { valeur: restoredContext.risque, lock: false }
      newMemory.entites.type_document = { valeur: restoredContext.type_document, lock: false }
      
      // Retirer ce contexte et tous ceux après de la pile
      newMemory.contextStack = memory.contextStack.slice(0, analysis.returnToIndex)
      
      // Reset du focus et des résultats
      newMemory.focus_actuel = { type: null, valeur: null }
      newMemory.resultats = { documents_trouves: 0, derniere_recherche: null }
      newMemory.etat_conversation = 'recherche_en_cours'
      
      // Ajouter à l'historique des sujets
      newMemory.sujets_abordes = [
        ...newMemory.sujets_abordes,
        `Retour: ${restoredContext.label}`
      ].slice(-5)
    }
    return newMemory
  }
  
  // Cas new_subject: sauvegarder le contexte actuel avant de changer
  if (analysis.transition === 'new_subject') {
    // Sauvegarder le contexte actuel dans la pile (si on a un client)
    if (memory.entites.client.valeur) {
      const currentSnapshot = createContextSnapshot(memory)
      newMemory.contextStack = [
        ...memory.contextStack,
        currentSnapshot
      ].slice(-5) // Garder max 5 contextes
    }
    
    // Appliquer les resets
    if (analysis.shouldResetClient) {
      newMemory.entites.client = { valeur: analysis.newClient, lock: false }
    }
    if (analysis.shouldResetYear) {
      newMemory.entites.annee = { valeur: null, lock: false }
    }
    if (analysis.shouldResetDocType) {
      newMemory.entites.type_document = { valeur: null, lock: false }
    }
    if (analysis.shouldResetRisk) {
      newMemory.entites.risque = { valeur: null, lock: false }
    }
    
    // Reset du focus et des résultats
    newMemory.focus_actuel = { type: null, valeur: null }
    newMemory.resultats = { documents_trouves: 0, derniere_recherche: null }
    newMemory.etat_conversation = 'recherche_en_cours'
    
    // Ajouter le nouveau sujet à l'historique
    if (analysis.newClient) {
      newMemory.sujets_abordes = [
        ...newMemory.sujets_abordes,
        `Nouveau: ${analysis.newClient}`
      ].slice(-5)
    }
  }
  
  return newMemory
}

// ============================================================================
// TÉLÉMÉTRIE DU ROUTEUR DE SUJET
// ============================================================================

// Cache pour stocker les événements de télémétrie (en mémoire)
const telemetryCache = new Map<string, SubjectTelemetry[]>()
const MAX_TELEMETRY_EVENTS = 50 // Par session

/**
 * Enregistre un événement de télémétrie pour le routeur de sujet
 */
export function logSubjectTransition(
  sessionId: string,
  question: string,
  analysis: SubjectAnalysis,
  contextBefore: StructuredMemory,
  contextAfter: StructuredMemory
): void {
  const events = telemetryCache.get(sessionId) ?? []
  
  const event: SubjectTelemetry = {
    timestamp: Date.now(),
    question,
    transition: analysis.transition,
    confidence: analysis.confidence,
    contextBefore: createContextSnapshot(contextBefore),
    contextAfter: createContextSnapshot(contextAfter),
    wasOverridden: false,
  }
  
  events.push(event)
  
  // Garder seulement les derniers événements
  if (events.length > MAX_TELEMETRY_EVENTS) {
    events.splice(0, events.length - MAX_TELEMETRY_EVENTS)
  }
  
  telemetryCache.set(sessionId, events)
  
  // Log console pour debug
  console.log(`[TELEMETRY] ${analysis.transition} (${Math.round(analysis.confidence * 100)}%) - ${analysis.reason}`)
}

/**
 * Marque le dernier événement comme corrigé par l'utilisateur
 * Appelé si l'utilisateur change immédiatement de contexte après une transition
 */
export function markLastTransitionAsOverridden(sessionId: string): void {
  const events = telemetryCache.get(sessionId)
  if (events && events.length > 0) {
    const lastEvent = events[events.length - 1]
    // Si l'événement est récent (< 30 secondes), le marquer comme corrigé
    if (Date.now() - lastEvent.timestamp < 30000) {
      lastEvent.wasOverridden = true
      console.log(`[TELEMETRY] Dernière transition marquée comme corrigée`)
    }
  }
}

/**
 * Calcule les statistiques de télémétrie pour une session
 */
export function getTelemetryStats(sessionId: string): {
  totalTransitions: number
  overriddenCount: number
  overrideRate: number
  byTransitionType: Record<SubjectTransition, { count: number; avgConfidence: number; overridden: number }>
  lowConfidenceCount: number
} {
  const events = telemetryCache.get(sessionId) ?? []
  
  const stats = {
    totalTransitions: events.length,
    overriddenCount: events.filter(e => e.wasOverridden).length,
    overrideRate: 0,
    byTransitionType: {} as Record<SubjectTransition, { count: number; avgConfidence: number; overridden: number }>,
    lowConfidenceCount: events.filter(e => e.confidence < CONFIDENCE_THRESHOLD).length,
  }
  
  if (events.length > 0) {
    stats.overrideRate = stats.overriddenCount / events.length
  }
  
  // Grouper par type de transition
  const types: SubjectTransition[] = ['continuity', 'new_subject', 'return_subject', 'clarification', 'low_confidence']
  for (const type of types) {
    const typeEvents = events.filter(e => e.transition === type)
    stats.byTransitionType[type] = {
      count: typeEvents.length,
      avgConfidence: typeEvents.length > 0 
        ? typeEvents.reduce((sum, e) => sum + e.confidence, 0) / typeEvents.length 
        : 0,
      overridden: typeEvents.filter(e => e.wasOverridden).length,
    }
  }
  
  return stats
}

/**
 * Détecte si l'utilisateur vient de corriger une mauvaise détection
 * Retourne true si la question actuelle semble être une correction
 */
export function detectUserCorrection(
  sessionId: string,
  currentAnalysis: SubjectAnalysis
): boolean {
  const events = telemetryCache.get(sessionId)
  if (!events || events.length === 0) return false
  
  const lastEvent = events[events.length - 1]
  const timeSinceLastEvent = Date.now() - lastEvent.timestamp
  
  // Si moins de 30 secondes et changement de direction
  if (timeSinceLastEvent < 30000) {
    // Si on avait fait un new_subject et maintenant return_subject → correction probable
    if (lastEvent.transition === 'new_subject' && currentAnalysis.transition === 'return_subject') {
      markLastTransitionAsOverridden(sessionId)
      return true
    }
    // Si on avait maintenu continuité et maintenant new_subject explicite → correction probable
    if (lastEvent.transition === 'continuity' && currentAnalysis.transition === 'new_subject' && currentAnalysis.confidence > 0.85) {
      markLastTransitionAsOverridden(sessionId)
      return true
    }
  }
  
  return false
}

/**
 * Récupère ou crée une conversation pour un utilisateur
 */
export async function getOrCreateConversation(token: string, sessionId: string): Promise<string | null> {
  // Vérifier le cache local d'abord
  const cachedConversationId = conversationIdCache.get(sessionId)
  if (cachedConversationId) {
    return cachedConversationId
  }

  try {
    // Essayer de récupérer les conversations existantes
    const response = await fetch(`${API_BASE}/assistant/conversations/`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn('Impossible de récupérer les conversations:', response.status)
      return null
    }

    const data = await response.json()
    const conversations: any[] = Array.isArray(data) ? data : data?.results ?? []

    // Si une conversation est déjà associée au sessionId, la réutiliser
    const matching = conversations.find((c) => (c?.memoire_etat?.sessionId ?? c?.memoire_etat?.session_id) === sessionId)
    if (matching?.id) {
      conversationIdCache.set(sessionId, matching.id)
      return matching.id
    }

    // Créer une nouvelle conversation
    const createResponse = await fetch(`${API_BASE}/assistant/conversations/`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        titre: `Conversation ${new Date().toLocaleDateString('fr-FR')}`,
        memoire_etat: { sessionId },
      }),
    })

    if (!createResponse.ok) {
      console.warn('Impossible de créer une conversation:', createResponse.status)
      return null
    }

    const newConversation = await createResponse.json()
    conversationIdCache.set(sessionId, newConversation.id)
    return newConversation.id
  } catch (error) {
    console.error('Erreur lors de la gestion des conversations:', error)
    return null
  }
}

export async function getConversationMemoryPersistent(
  token: string,
  sessionId: string
): Promise<ConversationMemory | null> {
  const cached = memoryCache.get(sessionId)
  if (cached && Date.now() - cached.updatedAt < MEMORY_TTL_MS) {
    return cached.value
  }

  const conversationId = await getOrCreateConversation(token, sessionId)
  if (!conversationId) return null

  try {
    const response = await fetch(`${API_BASE}/assistant/conversations/${conversationId}/`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const convo = (await response.json()) as any
    const value: ConversationMemory = {
      conversationId,
      memoire_resume: typeof convo?.memoire_resume === 'string' ? convo.memoire_resume : '',
      memoire_etat: (convo?.memoire_etat && typeof convo.memoire_etat === 'object') ? convo.memoire_etat : {},
    }

    memoryCache.set(sessionId, { value, updatedAt: Date.now() })
    return value
  } catch (error) {
    console.error('Erreur lors de la récupération de la mémoire de conversation:', error)
    return null
  }
}

export async function updateConversationMemoryPersistent(
  token: string,
  sessionId: string,
  memoryPatch: { memoire_resume?: string; memoire_etat?: Record<string, unknown> }
): Promise<boolean> {
  const conversationId = await getOrCreateConversation(token, sessionId)
  if (!conversationId) return false

  try {
    const response = await fetch(`${API_BASE}/assistant/conversations/${conversationId}/`, {
      method: 'PATCH',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(memoryPatch),
    })

    if (!response.ok) {
      return false
    }

    const cached = memoryCache.get(sessionId)
    if (cached) {
      memoryCache.set(sessionId, {
        value: {
          conversationId,
          memoire_resume: memoryPatch.memoire_resume ?? cached.value.memoire_resume,
          memoire_etat: memoryPatch.memoire_etat ?? cached.value.memoire_etat,
        },
        updatedAt: Date.now(),
      })
    }

    return true
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la mémoire de conversation:', error)
    return false
  }
}

/**
 * Récupère l'historique des messages d'une conversation
 */
export async function getConversationMessages(
  token: string,
  conversationId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  try {
    const response = await fetch(
      `${API_BASE}/assistant/messages/?conversation=${conversationId}&limit=${limit}`,
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const messages = Array.isArray(data) ? data : data?.results ?? []

    return messages.map((m: any) => ({
      id: m.id,
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.contenu,
      timestamp: new Date(m.cree_le).getTime(),
      metadata: m.metadata,
    }))
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error)
    return []
  }
}

/**
 * Sauvegarde un message dans la conversation
 */
export async function saveMessage(
  token: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/assistant/messages/`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation: conversationId,
        role: role === 'user' ? 'USER' : 'ASSISTANT',
        contenu: content,
        metadata: metadata ?? {},
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du message:', error)
    return false
  }
}

/**
 * Récupère l'historique de conversation avec cache local + persistance
 */
export async function getConversationHistoryPersistent(
  token: string,
  sessionId: string
): Promise<ConversationMessage[]> {
  // 1. Vérifier le cache local d'abord (rapide)
  const cached = localCache.get(sessionId)
  if (cached && cached.length > 0) {
    return cached
  }

  // 2. Récupérer depuis la base de données
  const conversationId = await getOrCreateConversation(token, sessionId)
  if (!conversationId) {
    return []
  }

  const messages = await getConversationMessages(token, conversationId, 10)
  
  // 3. Mettre en cache localement
  if (messages.length > 0) {
    localCache.set(sessionId, messages)
  }

  return messages
}

/**
 * Ajoute un message à la conversation avec persistance
 */
export async function addMessagePersistent(
  token: string,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // 1. Ajouter au cache local immédiatement (pour la rapidité)
  const cached = localCache.get(sessionId) ?? []
  cached.push({ role, content, timestamp: Date.now(), metadata })
  
  // Garder seulement les 10 derniers messages
  if (cached.length > 10) {
    cached.splice(0, cached.length - 10)
  }
  localCache.set(sessionId, cached)

  // 2. Sauvegarder en base de données (en arrière-plan)
  const conversationId = await getOrCreateConversation(token, sessionId)
  if (conversationId) {
    // Ne pas attendre la sauvegarde pour ne pas ralentir la réponse
    saveMessage(token, conversationId, role, content, metadata).catch(err => {
      console.warn('Échec de la sauvegarde du message:', err)
    })
  }
}

/**
 * Efface le cache local d'une session
 */
export function clearLocalCache(sessionId: string): void {
  localCache.delete(sessionId)
  conversationIdCache.delete(sessionId)
}

// Cache local pour la mémoire structurée
const structuredMemoryCache = new Map<string, StructuredMemory>()

/**
 * Récupère la mémoire structurée d'une session
 */
export function getStructuredMemory(sessionId: string): StructuredMemory {
  return structuredMemoryCache.get(sessionId) ?? createEmptyStructuredMemory()
}

/**
 * Sauvegarde la mémoire structurée d'une session
 */
export function setStructuredMemory(sessionId: string, memory: StructuredMemory): void {
  structuredMemoryCache.set(sessionId, memory)
}

/**
 * Met à jour la mémoire après un échange complet (question + réponse)
 * C'est la fonction clé pour le résumé incrémental
 */
export async function updateMemoryAfterExchange(
  token: string,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  context: {
    client?: string | null
    annee?: string | null
    risque?: string | null
    type_document?: string | null
    documents_trouves?: number
    document_selectionne?: string | null // Titre/référence du document affiché
    document_actif?: {
      id: string
      titre: string
      contenu: string
      metadata: Record<string, unknown>
    } | null
    etat?: StructuredMemory['etat_conversation']
  }
): Promise<void> {
  // 1. Récupérer la mémoire structurée actuelle
  const currentMemory = getStructuredMemory(sessionId)
  
  // 2. Déterminer le sujet de la question
  let sujet = ''
  if (context.client) sujet = `Recherche ${context.client}`
  else if (context.type_document) sujet = `Documents ${context.type_document}`
  else if (userMessage.length < 50) sujet = userMessage.substring(0, 30)
  
  // 3. Déterminer la conclusion de l'échange
  let conclusion = ''
  if (context.documents_trouves !== undefined) {
    if (context.documents_trouves > 0) {
      conclusion = `${context.documents_trouves} doc(s) trouvé(s)`
      if (context.client) conclusion += ` pour ${context.client}`
    } else {
      conclusion = 'Aucun document trouvé'
      if (context.client) conclusion += ` pour ${context.client}`
    }
  }
  
  // 4. Mettre à jour la mémoire structurée
  const updatedMemory = updateStructuredMemory(currentMemory, {
    client: context.client,
    annee: context.annee,
    risque: context.risque,
    type_document: context.type_document,
    sujet: sujet || undefined,
    conclusion: conclusion || undefined,
    etat: context.etat,
    objectif: context.client ? `Recherche documentaire ${context.client}` : currentMemory.objectif_principal,
    documents_trouves: context.documents_trouves,
    derniere_recherche: context.client || context.type_document 
      ? `${context.type_document || 'documents'} ${context.client || ''}`.trim()
      : undefined,
    focus_type: context.documents_trouves && context.documents_trouves > 0 ? 'documents' : undefined,
    focus_valeur: context.document_selectionne || context.client || undefined,
    document_selectionne: context.document_selectionne, // Sauvegarder le document affiché
    document_actif: context.document_actif, // Sauvegarder le contenu complet du document
    lock_entites: context.documents_trouves !== undefined && context.documents_trouves > 0, // Lock si résultats trouvés
  })
  
  // 5. Sauvegarder en cache local
  setStructuredMemory(sessionId, updatedMemory)
  
  // 6. Persister en base de données (en arrière-plan)
  if (token) {
    const memoryPrompt = structuredMemoryToPrompt(updatedMemory)
    updateConversationMemoryPersistent(token, sessionId, {
      memoire_resume: memoryPrompt,
      memoire_etat: updatedMemory as unknown as Record<string, unknown>,
    }).catch(err => {
      console.warn('Échec de la mise à jour de la mémoire:', err)
    })
  }
}
