/**
 * 📋 Module d'extraction des critères de recherche
 * - Extraction de type de document, client, année, risque, etc.
 * - Classification des questions (recherche vs conversation)
 * - Détection des références contextuelles
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

export type ModeAssistant =
  | 'recherche_document'
  | 'hors_perimetre'
  | 'salutation'
  | 'confirmation'

// ============================================================================
// CONSTANTES - MOTS-CLÉS ET PATTERNS
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

// Mots réservés à ne pas confondre avec des codes clients
export const MOTS_RESERVES = [
  // Abréviations techniques
  'ACS', 'PDF', 'DOC', 'REF', 'TYPE', 'DATE', 'CFA', 'EUR', 'USD', 'XOF', 'XAF',
  'API', 'URL', 'HTML', 'CSS', 'JSON', 'XML', 'CSV', 'ZIP', 'RAR',
  // Verbes d'action courants
  'MONTRE', 'AFFICHE', 'OUVRE', 'DONNE', 'ENVOIE', 'VOIR', 'CHERCHE', 'TROUVE',
  'TELECHARGE', 'IMPRIME', 'COPIE', 'PARTAGE', 'OUVRIR', 'FERME', 'LISTE', 'CREE',
  'AJOUTE', 'SUPPRIME', 'MODIFIE', 'EDIT', 'DELETE', 'UPDATE', 'CREATE',
  // Pronoms et articles
  'MOI', 'TOI', 'LUI', 'ELLE', 'NOUS', 'VOUS', 'EUX', 'ICI', 'CELA', 'CECI',
  'QUI', 'QUE', 'QUOI', 'DONT', 'OU', 'LEQUEL', 'TOUT', 'TOUS', 'RIEN',
  'LE', 'LA', 'LES', 'UN', 'UNE', 'DES', 'DU', 'DE', 'AU', 'AUX',
  'CE', 'CET', 'CETTE', 'CES', 'MON', 'MA', 'MES', 'TON', 'TA', 'TES',
  'SON', 'SA', 'SES', 'LEUR', 'LEURS', 'NOTRE', 'VOTRE', 'NOS', 'VOS',
  // Mots-clés de l'interface
  'CLIENT', 'CLIENTS', 'ASSURE', 'ASSURES', 'EXERCICE', 'ANNEE',
  // Mots du domaine document
  'DOCUMENT', 'FICHIER', 'PIECE', 'ARCHIVE', 'DOSSIER', 'COURRIER', 'LETTRE',
  'MAIL', 'EMAIL', 'FAX', 'NOTE', 'MEMO', 'RAPPORT', 'COMPTE', 'RENDU',
  // Types de documents
  'AVENANT', 'FACTURE', 'CONTRAT', 'SINISTRE', 'DEVIS', 'QUITTANCE', 'POLICE',
  'ATTESTATION', 'RELEVE', 'BORDEREAU', 'BON', 'ORDRE', 'AVIS',
  // Risques
  'SANTE', 'AUTO', 'VIE', 'FLOTTE', 'RC', 'MRH', 'HABITATION', 'INCENDIE',
  'VOL', 'DOMMAGE', 'RESPONSABILITE', 'CIVILE', 'DECENNALE', 'BIENNALE',
  // Mots techniques assurance
  'PRIME', 'COTISATION', 'FRANCHISE', 'GARANTIE', 'COUVERTURE', 'RISQUE',
  'ASSURE', 'BENEFICIAIRE', 'SOUSCRIPTEUR', 'COURTIER', 'COMPAGNIE',
  // Mots courants courts
  'OUI', 'NON', 'OK', 'KO', 'NA', 'NB', 'PS', 'CC', 'BCC', 'RE', 'FW',
  'AN', 'ANS', 'JOUR', 'MOIS', 'TOUS', 'PLUS', 'MOINS', 'AUCUN', 'AUTRE',
]

// Patterns de référence contextuelle
export const REFERENCE_PATTERNS: RegExp[] = [
  /\b(il|lui|elle|ce client|cet assuré|le client)\b/i,
  /\b(son|sa|ses|leur|leurs)\s+(document|facture|contrat|avenant|dossier|sinistre|attestation|quittance|devis|courrier|police)/i,
  /\b(en a-t-il|en a-t-elle|combien en a|qu'?est-ce qu'?il a)\b/i,
  /\b(le même|la même|les mêmes|celui-ci|celle-ci|celui-là|celle-là)\b/i,
  /\b(pour lui|pour elle|pour eux|chez lui|chez elle)\b/i,
  /\b(et pour|et chez|qu'?en est-il|comment ça se passe pour)\b/i,
  /^(et |aussi |pareil |idem |même chose)/i,
]

// ============================================================================
// EXTRACTION DES CRITÈRES
// ============================================================================

/**
 * Extrait tous les critères de filtrage d'une question
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
  
  // Pattern 1: "client XXX" ou "du client XXX"
  const clientExplicite = question.match(/\b(?:du\s+)?client\s+([A-Z0-9][A-Z0-9\-]{1,15})\b/i)
  if (clientExplicite) {
    const candidat = clientExplicite[1].toUpperCase()
    if (!MOTS_RESERVES.includes(candidat) && !/^(19|20)\d{2}$/.test(candidat)) {
      client = candidat
    }
  }
  
  // Pattern 2: "de XXX" ou "du XXX" (très commun: "de 3CB", "du 3CB")
  if (!client) {
    const deClientMatch = question.match(/\b(?:de|du)\s+([0-9][A-Z]{1,5}|[A-Z][A-Z0-9]{1,5})\b/i)
    if (deClientMatch) {
      const candidat = deClientMatch[1].toUpperCase()
      if (!MOTS_RESERVES.includes(candidat) && !/^(19|20)\d{2}$/.test(candidat)) {
        client = candidat
      }
    }
  }
  
  // Pattern 3: Code client seul (lettres + chiffres ou chiffres + lettres)
  if (!client) {
    const codeMatch = question.match(/\b([A-Z][A-Z0-9]{1,5}|[0-9][A-Z]{1,3}[0-9]*)\b/i)
    if (codeMatch) {
      const brut = codeMatch[1]
      const candidat = brut.toUpperCase()
      const commenceParChiffre = /^\d/.test(brut)
      const lettresUniquement = /^[A-Za-z]+$/.test(brut)
      const estToutEnMajuscules = brut === brut.toUpperCase()

      if (
        !MOTS_RESERVES.includes(candidat) &&
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

/**
 * Extrait tous les mots candidats potentiellement des codes clients
 */
export function extraireCandidatsClients(question: string): string[] {
  const matches = question.match(/\b[A-Z0-9]{2,6}\b/gi) || []
  
  const candidats = matches
    .map(m => m.toUpperCase())
    .filter(m => {
      if (/^(19|20)\d{2}$/.test(m)) return false
      if (!/[A-Z]/i.test(m)) return false
      return true
    })
  
  return [...new Set(candidats)]
}

/**
 * Retourne le libellé français d'un critère
 */
export function libelleCritere(critere: keyof CriteresRecherche): string {
  switch (critere) {
    case 'typeDocument': return 'type de document'
    case 'client': return 'client'
    case 'annee': return "année d'exercice"
    case 'risque': return 'risque'
    case 'typeCourrier': return 'type de courrier'
    case 'reference': return 'référence'
    default: return critere
  }
}

// ============================================================================
// CLASSIFICATION DES QUESTIONS
// ============================================================================

/**
 * Vérifie si la question contient une référence contextuelle (il, lui, ses, etc.)
 */
export function contientReferenceContextuelle(question: string): boolean {
  return REFERENCE_PATTERNS.some(pattern => pattern.test(question))
}

/**
 * Vérifie si c'est une question sur l'assurance/courtage
 */
export function estQuestionAssuranceCourtage(question: string): boolean {
  const lower = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!lower) return false

  const patterns = [
    /\bassurance(s)?\b/,
    /\bassureur(s)?\b/,
    /\bcourtage\b/,
    /\bcourtier(s)?\b/,
    /\bprime(s)?\b/,
    /\bcotisation(s)?\b/,
    /\bgarantie(s)?\b/,
    /\bindemnisation(s)?\b/,
    /\bfranchise(s)?\b/,
    /\bresponsabilite civile\b/,
    /\bsouscription\b/,
    /\bpolice d'?assurance\b/,
  ]

  return patterns.some((p) => p.test(lower))
}

/**
 * Classification simplifiée d'une question
 */
export function classifierSimple(question: string, criteresExtraits: CriteresRecherche): ModeAssistant {
  const lower = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  
  // 1. Salutations simples
  const salutations = ['bonjour', 'salut', 'coucou', 'hello', 'bonsoir', 'hey', 'hi', 'yo']
  if (salutations.some(s => lower === s || lower === s + '!')) {
    return 'salutation'
  }
  
  // 2. Confirmations simples
  if (/^(oui|ok|d'?accord|vas[-\s]?y|go|ouais|yep|yes|non|nan|nope|a|b)$/i.test(lower)) {
    return 'confirmation'
  }
  
  // 3. Détecter une recherche de documents
  const aCriteresForts = !!(criteresExtraits.client || criteresExtraits.annee || criteresExtraits.reference)
  const aCriteresFaibles = !!(criteresExtraits.typeDocument || criteresExtraits.risque)
  const aCriteres = aCriteresForts || aCriteresFaibles

  const mentionneArchives = /\b(documents?|fichiers?|archives?)\b/.test(lower)
  const actionRechercheDocs = /\b(cherche|trouve|retrouve|montre|affiche|liste|donne|envoie|recupere|rappelle|ouvre)\b/.test(lower)
  const demandeRecence = /\b(dernier|derniers|derniere|dernieres|recent|recents)\b/.test(lower)
  const demandeListePieces = /\b(mes|les|tous les|la liste des)\b.*\b(avenants?|factures?|contrats?|attestations?|quittances?|devis|sinistres?)\b/.test(lower)
  const demandeDernierePiece = /\b(dernier|derniers|derniere|dernieres|recent|recents)\b.*\b(avenant|facture|contrat|attestation|quittance|devis|sinistre)\b/.test(lower)

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

  // 4. Mots-clés assurance/documents → recherche de documents
  if (estQuestionAssuranceCourtage(question)) {
    return 'recherche_document'
  }
  
  // 5. Questions sur les statistiques
  if (/\b(combien|statistique|stats|nombre|total|compte)\b/.test(lower)) {
    return 'recherche_document'
  }
  
  // Par défaut → recherche de documents
  return 'recherche_document'
}

// ============================================================================
// DÉTECTION D'INTENTION (documents vs statistiques)
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

export function estQuestionComptageContextuel(question: string): boolean {
  const lower = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return COMPTAGE_PATTERNS.some(pattern => pattern.test(lower))
}

export function detectIntent(question: string): 'documents' | 'statistiques' {
  const lower = question.toLowerCase()
  const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const statsKeywords = ['combien', 'nombre', 'statistique', 'stats', 'kpi', 'taux', 'top', 'retard', 'alerte', 'volume', 'total']
  
  const statsTypesPatterns = [
    'types de documents les plus',
    'types les plus frequents',
    'documents les plus frequents',
    'augmente ou diminue',
    'evolution des archives',
    'tendance des archives',
  ]

  if (estQuestionComptageContextuel(question)) {
    return 'statistiques'
  }

  if (statsKeywords.some((kw) => normalized.includes(kw))) {
    return 'statistiques'
  }

  if (statsTypesPatterns.some((pattern) => normalized.includes(pattern))) {
    return 'statistiques'
  }

  return 'documents'
}
