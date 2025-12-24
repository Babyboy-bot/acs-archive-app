/**
 * Résolution des références contextuelles
 * Permet de comprendre "il", "lui", "ce client", "ses factures" en se basant
 * sur l'historique de conversation
 */

import { getConversationHistory } from './llm'

// Patterns qui indiquent une référence à un client précédent
const REFERENCE_PATTERNS: RegExp[] = [
  /\b(il|lui|elle|le|la|ce client|son|sa|ses|leur|leurs)\b/i,
  /\b(en a-t-il|en a-t-elle|combien en a)\b/i,
  /\b(le même|la même|les mêmes|celui-ci|celle-ci)\b/i,
]

// Types de documents reconnus dans ACS pour le filtrage de pertinence
export const TYPE_DOCUMENT_KEYWORDS: Record<string, string[]> = {
  'acs vers client': ['acs vers client', 'acs client', 'courrier client', 'lettre client'],
  'acs vers compagnie': ['acs vers compagnie', 'acs compagnie', 'courrier compagnie', 'lettre compagnie'],
  'avenant': ['avenant', 'modification', 'amendement', 'modification contrat'],
  'facture': ['facture', 'fact', 'invoice', 'facturation'],
  'règlement': ['règlement', 'reglement', 'paiement', 'payment', 'versement'],
  'divers': ['divers', 'autre', 'autres', 'miscellaneous'],
  'sinistre': ['sinistre', 'déclaration sinistre', 'claim', 'accident'],
  'contrat': ['contrat', 'police', 'contract', 'police d\'assurance'],
  'attestation': ['attestation', 'certificat', 'certificate'],
  'quittance': ['quittance', 'reçu', 'receipt'],
  'devis': ['devis', 'proposition', 'quote', 'offre'],
}

// Types de risques reconnus dans ACS
export const TYPES_RISQUES: Record<string, string[]> = {
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
    'multirisques professionnel', 'multirisque professionnel', 'mrp',
    'multirisque pro', 'multirisques pro', 'professionnel', 'pro',
    'multirisque', 'multirisques', 'rc professionnelle', 'rc pro',
    'responsabilite civile professionnelle', 'responsabilité civile professionnelle',
  ],
}

/**
 * Contexte extrait de l'historique de conversation
 */
export type ContexteHistorique = {
  client: string | null
  typeDocument: string | null
  annee: string | null
  risque: string | null
  dernierResultatVide: boolean
}

/**
 * Structure des critères extraits de la question
 */
export type CriteresRecherche = {
  typeDocument: string | null
  client: string | null
  annee: string | null
  risque: string | null
  typeCourrier: string | null
  reference: string | null
}

/**
 * Résultat de l'enrichissement avec contexte complet
 */
export type ResultatEnrichissement = {
  questionEnrichie: string
  clientContexte: string | null
  anneeContexte: string | null
  risqueContexte: string | null
  typeDocumentContexte: string | null
}

/**
 * Extrait tous les critères de filtrage de la question
 */
export function extraireCriteresRecherche(question: string): CriteresRecherche {
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
  
  const motsReserves = [
    'ACS', 'PDF', 'DOC', 'REF', 'TYPE', 'DATE', 'CFA', 'EUR', 'USD',
    'MONTRE', 'AFFICHE', 'OUVRE', 'DONNE', 'ENVOIE', 'VOIR', 'CHERCHE', 'TROUVE',
    'TELECHARGE', 'IMPRIME', 'COPIE', 'PARTAGE', 'OUVRIR', 'FERME',
    'MOI', 'TOI', 'LUI', 'ELLE', 'NOUS', 'VOUS', 'EUX', 'ICI', 'CELA', 'CECI',
    'DOCUMENT', 'FICHIER', 'PIECE', 'ARCHIVE', 'DOSSIER',
    'AVENANT', 'FACTURE', 'CONTRAT', 'SINISTRE', 'DEVIS', 'QUITTANCE',
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
  
  // Pattern 2: "de XXX" ou "du XXX"
  if (!client) {
    const deClientMatch = question.match(/\b(?:de|du)\s+([0-9][A-Z]{1,5}|[A-Z][A-Z0-9]{1,5})\b/i)
    if (deClientMatch) {
      const candidat = deClientMatch[1].toUpperCase()
      if (!motsReserves.includes(candidat) && !/^(19|20)\d{2}$/.test(candidat)) {
        client = candidat
      }
    }
  }
  
  // Pattern 3: Code client seul
  if (!client) {
    const codeMatch = question.match(/\b([A-Z][A-Z0-9]{1,5}|[0-9][A-Z]{1,3}[0-9]*)\b/i)
    if (codeMatch) {
      const brut = codeMatch[1]
      const candidat = brut.toUpperCase()
      const commenceParChiffre = /^\d/.test(brut)
      const lettresUniquement = /^[A-Za-z]+$/.test(brut)
      const estToutEnMajuscules = brut === brut.toUpperCase()

      if (
        !motsReserves.includes(candidat) &&
        !/^(19|20)\d{2}$/.test(candidat) &&
        (commenceParChiffre || !lettresUniquement || estToutEnMajuscules)
      ) {
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
  
  // 5. Type de courrier
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

/**
 * Extrait le contexte complet de l'historique de conversation
 */
export function extraireContexteHistorique(sessionId: string): ContexteHistorique {
  const history = getConversationHistory(sessionId)

  let client: string | null = null
  let typeDocument: string | null = null
  let annee: string | null = null
  let risque: string | null = null
  let dernierResultatVide = false

  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i]
    const content = message.content.toLowerCase()
    const contentOriginal = message.content

    if (message.role === 'assistant' && i === history.length - 1) {
      if (content.includes('pas trouvé') || content.includes('aucun') || content.includes("n'ai pas")) {
        dernierResultatVide = true
      }
    }

    if (message.role === 'user' && !typeDocument) {
      for (const [type, keywords] of Object.entries(TYPE_DOCUMENT_KEYWORDS)) {
        if (keywords.some((kw) => content.includes(kw))) {
          typeDocument = type
          break
        }
      }
    }

    if (!client) {
      const clientMatch = contentOriginal.match(/(?:client|pour)\s+([A-Z0-9][A-Z0-9\s\-]{1,50})/i)
      if (clientMatch) {
        client = clientMatch[1].trim().toUpperCase()
      }

      const docMatch = contentOriginal.match(
        /(?:documents?|archives?|factures?|dossiers?)\s+(?:de|du|pour)\s+(?:le client\s+)?([A-Z0-9][A-Z0-9\s\-]{1,50})/i,
      )
      if (docMatch) {
        client = docMatch[1].trim().toUpperCase()
      }
    }

    if (!annee && message.role === 'user') {
      const anneeMatch = contentOriginal.match(/\b(19\d{2}|20[0-2]\d)\b/)
      if (anneeMatch) {
        annee = anneeMatch[1]
      }
    }

    if (!risque && message.role === 'user') {
      const risquesConnus = ['sante', 'santé', 'auto', 'habitation', 'vie', 'prevoyance', 'prévoyance', 'rc', 'transport', 'construction', 'flotte']
      for (const r of risquesConnus) {
        if (content.includes(r)) {
          risque = r.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          break
        }
      }
    }

    if (message.role === 'user') {
      const criteres = extraireCriteresRecherche(contentOriginal)
      if (!client && criteres.client) client = criteres.client
      if (!typeDocument && criteres.typeDocument) typeDocument = criteres.typeDocument
      if (!annee && criteres.annee) annee = criteres.annee
      if (!risque && criteres.risque) risque = criteres.risque
    }

    if (client && typeDocument && annee && risque) break
  }

  return { client, typeDocument, annee, risque, dernierResultatVide }
}

/**
 * Vérifie si la question contient une référence contextuelle
 */
export function contientReferenceContextuelle(question: string): boolean {
  return REFERENCE_PATTERNS.some((pattern) => pattern.test(question))
}

/**
 * Extrait le nom du client mentionné dans la question
 */
export function extraireClientMentionne(question: string): string | null {
  return extraireCriteresRecherche(question).client
}

/**
 * Enrichit la question avec le contexte complet de la conversation
 */
export function enrichirQuestionAvecContexte(question: string, sessionId: string | null): ResultatEnrichissement {
  if (!sessionId) {
    return {
      questionEnrichie: question,
      clientContexte: null,
      anneeContexte: null,
      risqueContexte: null,
      typeDocumentContexte: null,
    }
  }

  const contexte = extraireContexteHistorique(sessionId)
  const clientExplicite = extraireClientMentionne(question)
  const criteresQuestion = extraireCriteresRecherche(question)

  const clientFinal = clientExplicite || criteresQuestion.client || contexte.client
  const anneeFinal = criteresQuestion.annee || contexte.annee
  const risqueFinal = criteresQuestion.risque || contexte.risque
  const typeDocFinal = criteresQuestion.typeDocument || contexte.typeDocument

  const estReferenceContextuelle = contientReferenceContextuelle(question)

  const patternsRequeteSuivi = [
    /^(montre|affiche|voir|ouvre|donne|envoie|telecharge|imprime)/i,
    /\b(montre|affiche|voir)\s+(le|la|les|ce|cette|ces|moi)\b/i,
    /\b(le|la|les)\s+(document|fichier|avenant|facture)s?\b/i,
    /^(oui|ok|d'accord|vas-?y|go)\b/i,
    /^c'?est\s+(ca|ça|celui|celle)/i,
    /\b(cherche|recherche)\s+encore\b/i,
  ]
  const estRequeteSuivi = patternsRequeteSuivi.some((p) => p.test(question.trim()))

  if (estReferenceContextuelle || estRequeteSuivi) {
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

/**
 * Génère un ID de session stable à partir du token
 */
export function generateSessionId(token: string | null): string {
  if (!token) return 'anonymous'
  const cleaned = token.replace(/^Bearer\s+/i, '')
  return cleaned.substring(0, 16)
}

/**
 * Libellé français pour un critère
 */
export function libelleCritere(critere: keyof CriteresRecherche): string {
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
