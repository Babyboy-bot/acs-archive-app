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

// Types de risques reconnus dans ACS (basé sur les données réelles de la base)
// IMPORTANT: Les abréviations courantes sont mappées vers les noms complets
export const TYPES_RISQUES: Record<string, string[]> = {
  // === SANTÉ ===
  'sante': ['sante', 'santé', 'maladie', 'hospitalisation', 'medical', 'médical'],
  
  // === AUTOMOBILE ===
  'automobile': ['auto', 'automobile', 'vehicule', 'véhicule', 'voiture', 'moto', 'flotte', 'parc automobile'],
  
  // === HABITATION ===
  'multirisque habitation': ['mrh', 'habitation', 'maison', 'appartement', 'logement', 'multirisque habitation'],
  
  // === VIE / DÉCÈS ===
  'deces': ['vie', 'deces', 'décès', 'deces toutes causes', 'temporaire deces', 'deces emprunteur'],
  'retraite': ['retraite', 'epargne', 'épargne', 'horizon retraite', 'retraite complementaire', 'rachat capital retraite'],
  
  // === PRÉVOYANCE ===
  'prevoyance': ['prevoyance', 'prévoyance', 'prev', 'prevoyance collective', 'prevoyance entreprise', 'prevoyance deces'],
  'indemnite fin de carriere': ['ifc', 'indemnite fin carriere', 'indemnité fin carrière', 'indemnites fin de carriere'],
  'frais funeraires': ['ff', 'frais funeraires', 'funerailles', 'assistance frais funerailles', 'protection sociale funerailles'],
  'rente education': ['rente education', 'rente scolaire'],
  
  // === RESPONSABILITÉ CIVILE ===
  'responsabilite civile': ['rc', 'responsabilite civile', 'responsabilité civile', 'responabilite civile'],
  
  // === INDIVIDUEL ACCIDENT (IA) ===
  'individuel accident': ['ia', 'individuel accident', 'individuelle accident', 'individuelle accidents', 'accident individuel'],
  
  // === INCENDIE ===
  'incendie': ['incendie', 'feu', 'inc'],
  
  // === MULTIRISQUE PROFESSIONNEL ===
  'multirisque professionnel': [
    'mrp', 'multirisque professionnel', 'multirisque professionnelle', 'multirisques professionnel',
    'multirisque pro', 'multirisques pro', 'pro',
    'multirisque bureau', 'multirisque commercant', 'multirisque entreprise', 'multirisque immeuble',
    'mri', 'multirisque immeuble',
  ],
  
  // === TRANSPORT ===
  'transport': ['transport', 'transport facultes', 'marchandise', 'maritime', 'aerien', 'aérien'],
  
  // === CONSTRUCTION / CHANTIER ===
  'tous risques chantier': ['trc', 'tous risques chantier', 'chantier', 'construction', 'decennale', 'décennale', 'dommage ouvrage'],
  
  // === CAUTION ===
  'caution': ['caution', 'cautions'],
  
  // === GLOBAL / DOMMAGES ===
  'global dommage': ['gd', 'global dommage', 'global dommages', 'globale dommage', 'globale dommages', 'tous dommages'],
  'global banque': ['gb', 'global banque', 'globale banque'],
  
  // === VOL ===
  'vol': ['vol', 'vols', 'vol et detournement', 'vol et detournements', 'vols et detournements'],
  
  // === INFORMATIQUE ===
  'tous risques informatiques': ['tri', 'tous risques informatiques', 'informatique', 'info'],
  
  // === BRIS DE MACHINE ===
  'bris de machine': ['bdm', 'bris de machine', 'bris machine'],
  
  // === AUTRES ===
  'voyage': ['voyage', 'assistance voyage', 'evacuation sanitaire'],
  'degats des eaux': ['dde', 'degats des eaux', 'dégâts des eaux'],
  'corps et moteur': ['corps et moteur', 'corps moteur'],
  'pipelines': ['pipelines', 'pipeline'],
  'assurance stocks': ['stocks', 'assurance des stocks', 'assurance stocks'],
  'divers': ['divers', 'autres', 'divers general'],
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
  // Mots de référence contextuelle (ne pas confondre avec des clients)
  'MEME', 'MÊME', 'PAREIL', 'IDEM', 'AUSSI', 'ENCORE', 'TOUJOURS',
  'DERNIER', 'DERNIERE', 'PREMIER', 'PREMIERE', 'SUIVANT', 'PRECEDENT',
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
// CACHE DES CLIENTS VALIDES (Liste blanche + Recherche floue)
// ============================================================================

// Cache des codes clients valides chargés depuis le backend
let _validClientsCache: Set<string> | null = null
let _fullClientNamesCache: string[] = []
let _validClientsCacheExpiry: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Charge la liste des codes clients valides depuis le backend.
 * Utilise un cache pour éviter les appels répétés.
 */
export async function loadValidClients(token: string | null): Promise<Set<string>> {
  const now = Date.now()
  
  // Retourner le cache s'il est encore valide
  if (_validClientsCache && now < _validClientsCacheExpiry) {
    return _validClientsCache
  }
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(`${baseUrl}/assistant/valid-clients/`, { headers })
    if (response.ok) {
      const data = await response.json()
      _validClientsCache = new Set(data.codes || [])
      _fullClientNamesCache = data.clients || []
      _validClientsCacheExpiry = now + CACHE_TTL_MS
      return _validClientsCache
    }
  } catch (error) {
    console.warn('Impossible de charger la liste des clients valides:', error)
  }
  
  // Fallback: retourner un Set vide (la liste noire sera utilisée)
  return new Set()
}

/**
 * Recherche floue : trouve le nom complet du client à partir d'un mot partiel.
 * Ex: "NESTLE" → "NESTLE - CI", "MTN" → "MTN CI"
 * 
 * Retourne:
 * - Le nom exact si trouvé directement
 * - Le nom complet si un seul client contient le mot
 * - null si aucun match ou plusieurs matchs ambigus
 */
export function fuzzyMatchClient(candidat: string): string | null {
  const upper = candidat.toUpperCase()
  
  // 0. Exclure les mots réservés (références contextuelles comme "MEME", "MÊME", etc.)
  if (MOTS_RESERVES.includes(upper)) {
    return null
  }
  
  // 1. Match exact dans les codes
  if (_validClientsCache?.has(upper)) {
    // Chercher le nom complet correspondant
    const exactMatch = _fullClientNamesCache.find(name => name === upper)
    if (exactMatch) return exactMatch
    
    // Le candidat est un mot d'un nom composé, chercher le nom complet
    const containingNames = _fullClientNamesCache.filter(name => {
      const cleaned = name.replace(/-/g, ' ').replace(/_/g, ' ')
      return cleaned.split(/\s+/).some(word => word === upper)
    })
    
    if (containingNames.length === 1) {
      return containingNames[0]
    }
    // Si plusieurs matchs, retourner le candidat tel quel (sera utilisé pour la recherche)
    return upper
  }
  
  // 2. Recherche floue : le candidat est contenu dans un nom de client
  const fuzzyMatches = _fullClientNamesCache.filter(name => {
    const cleaned = name.replace(/-/g, ' ').replace(/_/g, ' ')
    return cleaned.includes(upper) || cleaned.split(/\s+/).some(word => word.startsWith(upper))
  })
  
  if (fuzzyMatches.length === 1) {
    // Un seul match → on l'utilise
    return fuzzyMatches[0]
  } else if (fuzzyMatches.length > 1) {
    // Plusieurs matchs → on garde le candidat pour laisser la recherche backend décider
    // Mais on valide que c'est bien un client potentiel
    return upper
  }
  
  // 3. Aucun match → ce n'est pas un client
  return null
}

/**
 * Vérifie si un candidat est un code client valide.
 * Utilise la liste blanche (DB) si disponible, sinon fallback sur liste noire.
 */
export function isValidClientCode(candidat: string, validClients: Set<string>): boolean {
  const upper = candidat.toUpperCase()
  
  // Si on a une liste blanche chargée, l'utiliser (approche robuste)
  if (validClients.size > 0) {
    // Match exact ou recherche floue
    return validClients.has(upper) || fuzzyMatchClient(upper) !== null
  }
  
  // Fallback: utiliser la liste noire (moins fiable)
  return !MOTS_RESERVES.includes(upper) && !/^(19|20)\d{2}$/.test(upper)
}

/**
 * Version synchrone pour compatibilité - utilise le cache existant ou la liste noire
 */
export function isValidClientCodeSync(candidat: string): boolean {
  return isValidClientCode(candidat, _validClientsCache || new Set())
}

/**
 * Résout un candidat client vers son nom complet dans la DB.
 * Utilise la recherche floue pour gérer les cas comme NESTLE → NESTLE - CI
 */
export function resolveClientName(candidat: string): string | null {
  if (!candidat) return null
  return fuzzyMatchClient(candidat.toUpperCase())
}

// ============================================================================
// EXTRACTION DES CRITÈRES
// ============================================================================

/**
 * Extrait tous les critères de filtrage d'une question (version synchrone)
 * Note: Pour une validation robuste des clients, utiliser extraireCriteresRechercheAsync
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
  // Utilise la recherche floue pour résoudre les noms partiels (ex: NESTLE → NESTLE - CI)
  let client: string | null = null
  
  // Pattern 1: "client XXX" ou "du client XXX"
  const clientExplicite = question.match(/\b(?:du\s+)?client\s+([A-Z0-9][A-Z0-9\-\s]{1,25})\b/i)
  if (clientExplicite) {
    const candidat = clientExplicite[1].trim().toUpperCase()
    const resolved = resolveClientName(candidat)
    if (resolved) {
      client = resolved
    }
  }
  
  // Pattern 2: "de XXX" ou "du XXX" (très commun: "de 3CB", "du 3CB")
  if (!client) {
    const deClientMatch = question.match(/\b(?:de|du)\s+([0-9][A-Z]{1,5}|[A-Z][A-Z0-9]{1,5})\b/i)
    if (deClientMatch) {
      const candidat = deClientMatch[1].toUpperCase()
      const resolved = resolveClientName(candidat)
      if (resolved) {
        client = resolved
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

      if (commenceParChiffre || !lettresUniquement || estToutEnMajuscules) {
        const resolved = resolveClientName(candidat)
        if (resolved) {
          client = resolved
        }
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
