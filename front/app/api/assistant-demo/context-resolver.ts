/**
 * Résolution de contexte DÉTERMINISTE pour l'assistant ACS Archive
 * 
 * Couvre TOUS les cas de contexte possibles :
 * - "même client", "ce client", "lui", "ses documents"
 * - "même risque", "ce risque", "toujours en santé"
 * - "même année", "cette année", "cet exercice"
 * - "les mêmes", "pareil", "idem"
 * - "le premier", "le 2ème", "le dernier"
 * - "celui-ci", "ce document"
 * - "mais en 2005", "pareil mais en auto"
 */

import type { StructuredMemory, DocumentSelection } from './conversation'

// ============================================================================
// TYPES
// ============================================================================

export type ContextResolution = {
  client: string | null
  annee: string | null
  risque: string | null
  type_document: string | null
  // Source de chaque résolution
  sources: {
    client: 'explicit' | 'anaphore' | 'memory' | 'document' | 'none'
    annee: 'explicit' | 'anaphore' | 'memory' | 'document' | 'none'
    risque: 'explicit' | 'anaphore' | 'memory' | 'document' | 'none'
    type_document: 'explicit' | 'anaphore' | 'memory' | 'document' | 'none'
  }
  // Document ciblé (si "lui", "le 2ème", etc.)
  targetDocument: DocumentSelection | null
  targetDocumentIndex: number | null
  // Flags
  isContextSwitch: boolean  // "autre client", "nouvelle recherche"
  needsClarification: boolean
  clarificationQuestion: string | null
}

// ============================================================================
// PATTERNS DE DÉTECTION (REGEX DÉTERMINISTES)
// ============================================================================

// Patterns pour références au CLIENT
const PATTERNS_SAME_CLIENT = [
  /\bm[eê]me\s+client\b/i,
  /\bce\s+client\b/i,
  /\bdu\s+m[eê]me\s+client\b/i,
  /\bde\s+ce\s+client\b/i,
  /\blui\b(?!\s+(m[eê]me|aussi))/i,  // "lui" seul (pas "lui même")
  /\bses\s+(documents?|avenants?|factures?|contrats?|attestations?|polices?)\b/i,
  /\bson\s+(document|avenant|facture|contrat|attestation|police)\b/i,
  /\bpour\s+lui\b/i,
  /\bchez\s+lui\b/i,
]

// Patterns pour références au RISQUE
const PATTERNS_SAME_RISQUE = [
  /\bm[eê]me\s+risque\b/i,
  /\bce\s+risque\b/i,
  /\bdu\s+m[eê]me\s+risque\b/i,
  /\btoujours\s+en\s+(sant[eé]|auto|automobile|rc|mrh|mrp|mri|incendie|transport|d[eé]c[eè]s|retraite|pr[eé]voyance)\b/i,
  /\bm[eê]me\s+type\s+de\s+risque\b/i,
]

// Patterns pour références à l'ANNÉE
const PATTERNS_SAME_ANNEE = [
  /\bm[eê]me\s+ann[eé]e\b/i,
  /\bcette\s+ann[eé]e\b/i,
  /\bm[eê]me\s+exercice\b/i,
  /\bcet\s+exercice\b/i,
  /\bdu\s+m[eê]me\s+exercice\b/i,
]

// Patterns pour références au TYPE DE DOCUMENT
const PATTERNS_SAME_TYPE_DOC = [
  /\bm[eê]me\s+type\s+de\s+document\b/i,
  /\bm[eê]mes?\s+(documents?|avenants?|factures?|contrats?|attestations?|quittances?|polices?)\b/i,
  /\bd'?autres?\s+(avenants?|factures?|contrats?|attestations?|quittances?)\b/i,
]

// Patterns pour "LES MÊMES" (tout le contexte)
const PATTERNS_ALL_SAME = [
  /\bles\s+m[eê]mes\b/i,
  /\bpareil\b(?!\s+mais)/i,  // "pareil" seul (pas "pareil mais")
  /\bidem\b/i,
  /\bidentiques?\b/i,
  /\bm[eê]me\s+chose\b/i,
]

// Patterns pour "PAREIL MAIS..." (override partiel)
const PATTERNS_SAME_BUT = [
  /\bpareil\s+mais\b/i,
  /\bles\s+m[eê]mes\s+mais\b/i,
  /\bidem\s+mais\b/i,
]

// Patterns pour références à un DOCUMENT SPÉCIFIQUE
const PATTERNS_THIS_DOCUMENT = [
  /\bcelui[- ]?ci\b/i,
  /\bcelui[- ]?l[aà]\b/i,
  /\bce\s+document\b/i,
  /\bcet\s+avenant\b/i,
  /\bcette\s+facture\b/i,
  /\bce\s+contrat\b/i,
  /\bcette\s+attestation\b/i,
]

// Patterns pour index de document
const PATTERNS_DOC_INDEX = [
  { pattern: /\ble\s+premier\b/i, index: 0 },
  { pattern: /\ble\s+1er\b/i, index: 0 },
  { pattern: /\ble\s+deuxi[eè]me\b/i, index: 1 },
  { pattern: /\ble\s+2[eè]me\b/i, index: 1 },
  { pattern: /\ble\s+second\b/i, index: 1 },
  { pattern: /\ble\s+troisi[eè]me\b/i, index: 2 },
  { pattern: /\ble\s+3[eè]me\b/i, index: 2 },
  { pattern: /\ble\s+quatri[eè]me\b/i, index: 3 },
  { pattern: /\ble\s+4[eè]me\b/i, index: 3 },
  { pattern: /\ble\s+dernier\b/i, index: -1 },  // -1 = dernier
]

// Patterns pour CHANGEMENT DE SUJET
const PATTERNS_CONTEXT_SWITCH = [
  /\bautre\s+client\b/i,
  /\bun\s+autre\s+client\b/i,
  /\bnouveau\s+client\b/i,
  /\bnouvelle\s+recherche\b/i,
  /\bchangeons?\s+de\b/i,
  /\bpassons?\s+[àa]\b/i,
  /\bparlons?\s+de\b/i,
  /\bmaintenant\s+pour\b/i,
]

// ============================================================================
// EXTRACTION DE VALEURS EXPLICITES
// ============================================================================

// Extraire une année explicite (1990-2099)
function extractExplicitYear(question: string): string | null {
  const match = question.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : null
}

// Extraire un type de document explicite
function extractExplicitTypeDoc(question: string): string | null {
  const types = [
    { pattern: /\bavenants?\b/i, value: 'avenant' },
    { pattern: /\bfactures?\b/i, value: 'facture' },
    { pattern: /\bcontrats?\b/i, value: 'contrat' },
    { pattern: /\battestations?\b/i, value: 'attestation' },
    { pattern: /\bquittances?\b/i, value: 'quittance' },
    { pattern: /\bpolices?\b/i, value: 'police' },
    { pattern: /\bdevis\b/i, value: 'devis' },
    { pattern: /\bsinistres?\b/i, value: 'sinistre' },
  ]
  for (const t of types) {
    if (t.pattern.test(question)) return t.value
  }
  return null
}

// Extraire un risque explicite
function extractExplicitRisque(question: string): string | null {
  const risques = [
    { pattern: /\bsant[eé]\b/i, value: 'sante' },
    { pattern: /\bauto(?:mobile)?\b/i, value: 'auto' },
    { pattern: /\brc\s*(?:pro)?\b/i, value: 'responsabilite civile' },
    { pattern: /\bresponsabilit[eé]\s+civile\b/i, value: 'responsabilite civile' },
    { pattern: /\bmrh\b/i, value: 'multirisque habitation' },
    { pattern: /\bmrp\b/i, value: 'multirisque professionnel' },
    { pattern: /\bmri\b/i, value: 'multirisque immeuble' },
    { pattern: /\bincendie\b/i, value: 'incendie' },
    { pattern: /\btransport\b/i, value: 'transport' },
    { pattern: /\bd[eé]c[eè]s\b/i, value: 'deces' },
    { pattern: /\bretraite\b/i, value: 'retraite' },
    { pattern: /\bpr[eé]voyance\b/i, value: 'prevoyance' },
    { pattern: /\bia\b/i, value: 'individuel accident' },
    { pattern: /\bindividuel\s+accident\b/i, value: 'individuel accident' },
    { pattern: /\btrc\b/i, value: 'tous risques chantier' },
    { pattern: /\btri\b/i, value: 'tous risques informatiques' },
  ]
  for (const r of risques) {
    if (r.pattern.test(question)) return r.value
  }
  return null
}

// ============================================================================
// FONCTION PRINCIPALE DE RÉSOLUTION
// ============================================================================

export function resolveContext(
  question: string,
  memory: StructuredMemory,
  explicitCriteres?: {
    client?: string | null
    annee?: string | null
    risque?: string | null
    type_document?: string | null
  }
): ContextResolution {
  const questionLower = question.toLowerCase()
  
  // Initialiser le résultat
  const result: ContextResolution = {
    client: null,
    annee: null,
    risque: null,
    type_document: null,
    sources: {
      client: 'none',
      annee: 'none',
      risque: 'none',
      type_document: 'none',
    },
    targetDocument: null,
    targetDocumentIndex: null,
    isContextSwitch: false,
    needsClarification: false,
    clarificationQuestion: null,
  }
  
  // 1. Détecter changement de sujet
  result.isContextSwitch = PATTERNS_CONTEXT_SWITCH.some(p => p.test(questionLower))
  if (result.isContextSwitch) {
    console.log('[ContextResolver] Changement de sujet détecté')
    // Ne pas réutiliser le contexte précédent
    return result
  }
  
  // 2. Détecter référence à un document spécifique
  const docIndexMatch = PATTERNS_DOC_INDEX.find(p => p.pattern.test(questionLower))
  if (docIndexMatch) {
    const selection = memory.focus_actuel.selection || []
    let targetIndex = docIndexMatch.index
    if (targetIndex === -1) targetIndex = selection.length - 1  // dernier
    
    if (selection[targetIndex]) {
      result.targetDocument = selection[targetIndex]
      result.targetDocumentIndex = targetIndex
      // Extraire le contexte du document ciblé
      const meta = selection[targetIndex].metadata
      result.client = meta?.client as string || null
      result.annee = meta?.exercice ? String(meta.exercice) : null
      result.risque = meta?.risque as string || null
      result.sources.client = 'document'
      result.sources.annee = 'document'
      result.sources.risque = 'document'
      console.log(`[ContextResolver] Document ciblé: index=${targetIndex}, client=${result.client}`)
    }
  }
  
  // 3. Détecter "celui-ci", "ce document" → document actif
  if (PATTERNS_THIS_DOCUMENT.some(p => p.test(questionLower))) {
    if (memory.document_actif) {
      result.targetDocument = {
        id: memory.document_actif.id || '',
        numero: 1,
        label: memory.document_actif.titre || '',
        contenu: memory.document_actif.contenu,
        metadata: memory.document_actif.metadata || {},
      }
      const meta = memory.document_actif.metadata
      result.client = result.client || (meta?.client as string) || null
      result.annee = result.annee || (meta?.exercice ? String(meta.exercice) : null)
      result.risque = result.risque || (meta?.risque as string) || null
      if (!result.sources.client || result.sources.client === 'none') result.sources.client = 'document'
      if (!result.sources.annee || result.sources.annee === 'none') result.sources.annee = 'document'
      if (!result.sources.risque || result.sources.risque === 'none') result.sources.risque = 'document'
      console.log(`[ContextResolver] Document actif ciblé: ${memory.document_actif.titre}`)
    } else if (memory.focus_actuel.selection?.length === 1) {
      // Un seul document affiché → c'est lui
      const doc = memory.focus_actuel.selection[0]
      result.targetDocument = doc
      result.targetDocumentIndex = 0
      result.client = result.client || (doc.metadata?.client as string) || null
      result.annee = result.annee || (doc.metadata?.exercice ? String(doc.metadata.exercice) : null)
      result.risque = result.risque || (doc.metadata?.risque as string) || null
      if (!result.sources.client || result.sources.client === 'none') result.sources.client = 'document'
      if (!result.sources.annee || result.sources.annee === 'none') result.sources.annee = 'document'
      if (!result.sources.risque || result.sources.risque === 'none') result.sources.risque = 'document'
    }
  }
  
  // 4. Détecter "les mêmes" / "pareil" / "idem" → tout le contexte
  const allSame = PATTERNS_ALL_SAME.some(p => p.test(questionLower))
  const sameBut = PATTERNS_SAME_BUT.some(p => p.test(questionLower))
  
  if (allSame || sameBut) {
    // Réutiliser tout le contexte précédent
    if (memory.entites.client.valeur) {
      result.client = memory.entites.client.valeur
      result.sources.client = 'anaphore'
    }
    if (memory.entites.risque.valeur) {
      result.risque = memory.entites.risque.valeur
      result.sources.risque = 'anaphore'
    }
    if (memory.entites.annee.valeur && !sameBut) {
      // Pour "pareil mais", on garde l'année seulement si pas d'override
      result.annee = memory.entites.annee.valeur
      result.sources.annee = 'anaphore'
    }
    if (memory.entites.type_document.valeur) {
      result.type_document = memory.entites.type_document.valeur
      result.sources.type_document = 'anaphore'
    }
    console.log(`[ContextResolver] "Les mêmes" détecté: client=${result.client}, risque=${result.risque}`)
  }
  
  // 5. Détecter références spécifiques (même client, même risque, etc.)
  if (PATTERNS_SAME_CLIENT.some(p => p.test(questionLower))) {
    if (memory.entites.client.valeur) {
      result.client = memory.entites.client.valeur
      result.sources.client = 'anaphore'
      console.log(`[ContextResolver] "Même client" → ${result.client}`)
    } else {
      result.needsClarification = true
      result.clarificationQuestion = "De quel client parles-tu ?"
    }
  }
  
  if (PATTERNS_SAME_RISQUE.some(p => p.test(questionLower))) {
    if (memory.entites.risque.valeur) {
      result.risque = memory.entites.risque.valeur
      result.sources.risque = 'anaphore'
      console.log(`[ContextResolver] "Même risque" → ${result.risque}`)
    } else {
      result.needsClarification = true
      result.clarificationQuestion = "De quel type de risque parles-tu ?"
    }
  }
  
  if (PATTERNS_SAME_ANNEE.some(p => p.test(questionLower))) {
    if (memory.entites.annee.valeur) {
      result.annee = memory.entites.annee.valeur
      result.sources.annee = 'anaphore'
      console.log(`[ContextResolver] "Même année" → ${result.annee}`)
    }
  }
  
  if (PATTERNS_SAME_TYPE_DOC.some(p => p.test(questionLower))) {
    if (memory.entites.type_document.valeur) {
      result.type_document = memory.entites.type_document.valeur
      result.sources.type_document = 'anaphore'
    }
  }
  
  // 6. Appliquer les valeurs EXPLICITES (priorité maximale)
  if (explicitCriteres?.client) {
    result.client = explicitCriteres.client
    result.sources.client = 'explicit'
  }
  
  const explicitYear = extractExplicitYear(question)
  if (explicitYear) {
    result.annee = explicitYear
    result.sources.annee = 'explicit'
  } else if (explicitCriteres?.annee) {
    result.annee = explicitCriteres.annee
    result.sources.annee = 'explicit'
  }
  
  const explicitRisque = extractExplicitRisque(question)
  if (explicitRisque) {
    result.risque = explicitRisque
    result.sources.risque = 'explicit'
  } else if (explicitCriteres?.risque) {
    result.risque = explicitCriteres.risque
    result.sources.risque = 'explicit'
  }
  
  const explicitTypeDoc = extractExplicitTypeDoc(question)
  if (explicitTypeDoc) {
    result.type_document = explicitTypeDoc
    result.sources.type_document = 'explicit'
  } else if (explicitCriteres?.type_document) {
    result.type_document = explicitCriteres.type_document
    result.sources.type_document = 'explicit'
  }
  
  // 7. Log final
  console.log(`[ContextResolver] Résolution finale:`)
  console.log(`  client: ${result.client} (${result.sources.client})`)
  console.log(`  annee: ${result.annee} (${result.sources.annee})`)
  console.log(`  risque: ${result.risque} (${result.sources.risque})`)
  console.log(`  type_document: ${result.type_document} (${result.sources.type_document})`)
  
  return result
}

// ============================================================================
// FONCTION POUR VERROUILLER LE CONTEXTE
// ============================================================================

export function lockContextAfterSuccess(
  memory: StructuredMemory,
  resolution: ContextResolution
): StructuredMemory {
  const now = Date.now()
  
  return {
    ...memory,
    entites: {
      client: resolution.client ? {
        valeur: resolution.client,
        lock: true,
        timestamp: now,
        confirmed: true,
      } : memory.entites.client,
      annee: resolution.annee ? {
        valeur: resolution.annee,
        lock: true,
        timestamp: now,
        confirmed: true,
      } : memory.entites.annee,
      risque: resolution.risque ? {
        valeur: resolution.risque,
        lock: true,
        timestamp: now,
        confirmed: true,
      } : memory.entites.risque,
      type_document: resolution.type_document ? {
        valeur: resolution.type_document,
        lock: false,  // Type de doc moins important à verrouiller
        timestamp: now,
        confirmed: true,
      } : memory.entites.type_document,
    },
    lastActivityTimestamp: now,
  }
}
