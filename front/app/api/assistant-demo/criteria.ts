/**
 * Module d'extraction des critères de recherche - version simplifiée
 */

// ============================================================================
// TYPES
// ============================================================================

export type CriteresRecherche = {
  typeDocument: string | null
  client: string | null
  annee: string | null
  risque: string | null
  typeCourrier: string | null
  reference: string | null
}

export type ModeAssistant = 'recherche_document'

// ============================================================================
// CONSTANTES - MOTS-CLÉS
// ============================================================================

// Types de documents reconnus dans ACS
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

// Types de risques reconnus (version simplifiée)
export const TYPES_RISQUES: Record<string, string[]> = {
  'sante': ['sante', 'santé', 'maladie', 'hospitalisation', 'medical', 'médical'],
  'automobile': ['auto', 'automobile', 'vehicule', 'véhicule', 'voiture', 'moto', 'flotte', 'parc automobile'],
  'multirisque habitation': ['mrh', 'habitation', 'maison', 'appartement', 'logement', 'multirisque habitation'],
  'deces': ['vie', 'deces', 'décès', 'deces toutes causes', 'temporaire deces', 'deces emprunteur'],
  'prevoyance': ['prevoyance', 'prévoyance', 'prev', 'prevoyance collective', 'prevoyance entreprise'],
  'responsabilite civile': ['rc', 'responsabilite civile', 'responsabilité civile'],
  'individuel accident': ['ia', 'individuel accident', 'individuelle accident', 'individuelle accidents'],
  'incendie': ['incendie', 'feu', 'inc'],
  'multirisque professionnel': ['mrp', 'multirisque professionnel', 'multirisque professionnelle', 'pro'],
  'transport': ['transport', 'transport facultes', 'marchandise', 'maritime', 'aerien', 'aérien'],
  'tous risques chantier': ['trc', 'tous risques chantier', 'chantier', 'construction', 'decennale', 'décennale'],
  'caution': ['caution', 'cautions'],
  'global dommage': ['gd', 'global dommage', 'global dommages', 'globale dommage', 'globale dommages'],
  'vol': ['vol', 'vols', 'vol et detournement', 'vol et detournements', 'vols et detournements'],
  'tous risques informatiques': ['tri', 'tous risques informatiques', 'informatique', 'info'],
}

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

/**
 * Extrait les critères de recherche d'une question
 */
export function extraireCriteresRecherche(question: string): CriteresRecherche {
  const criteres: CriteresRecherche = {
    typeDocument: null,
    client: null,
    annee: null,
    risque: null,
    typeCourrier: null,
    reference: null,
  }

  const normalized = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Extraire le type de document
  for (const [type, keywords] of Object.entries(TYPE_DOCUMENT_KEYWORDS)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      criteres.typeDocument = type
      break
    }
  }

  // Extraire le risque
  for (const [risque, keywords] of Object.entries(TYPES_RISQUES)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      criteres.risque = risque
      break
    }
  }

  // Extraire l'année (format 4 chiffres, jusqu'à 2039)
  const anneeMatch = question.match(/\b(19\d{2}|20[0-3]\d)\b/)
  if (anneeMatch) {
    criteres.annee = anneeMatch[1]
  }

  // Extraire le nom client complet (multi-mots, jusqu'au prochain mot-clé structurel)
  const clientPatterns: RegExp[] = [
    // Capture tout après "client" jusqu'à risque/exercice/annee/document
    /(?:client|pour)\s+(.+?)(?=\s+(?:risque|exercice|ann[eé]e|document|type)\b|\s*$)/i,
    /(?:documents?|archives?|factures?|dossiers?)\s+(?:de|du|pour)\s+(?:le client\s+)?(.+?)(?=\s+(?:risque|exercice|ann[eé]e|document|type)\b|\s*$)/i,
    /([A-Z]{3,4}\d{0,2})\s*[:\-]/, // Format "3CB:" ou "SANLAM-"
  ]

  for (const pattern of clientPatterns) {
    const match = question.match(pattern)
    if (match && match[1]) {
      criteres.client = match[1].trim().toUpperCase()
      break
    }
  }

  // Extraire la référence
  const refMatch = question.match(/(?:référence|ref|reference)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i)
  if (refMatch) {
    criteres.reference = refMatch[1]
  }

  return criteres
}

/**
 * Classification simple - toujours recherche_document après simplification
 */
export function classifierSimple(question: string, criteresExtraits: CriteresRecherche): ModeAssistant {
  // Après simplification, tout est traité comme une recherche de documents
  return 'recherche_document'
}

/**
 * Charge la liste des clients valides (stub pour compatibilité)
 */
export async function loadValidClients(token?: string): Promise<void> {
  // Stub - plus nécessaire côté frontend
}

/**
 * Détecte si c'est une question de comptage (stub pour compatibilité)
 */
export function estQuestionComptageContextuel(question: string): boolean {
  const keywords = ['combien', 'nombre', 'total', 'compte', 'existe-t-il']
  return keywords.some(keyword => question.toLowerCase().includes(keyword))
}

/**
 * Détecte l'intent (stub pour compatibilité)
 */
export function detectIntent(question: string): 'documents' | 'statistiques' {
  if (estQuestionComptageContextuel(question)) {
    return 'statistiques'
  }
  return 'documents'
}
