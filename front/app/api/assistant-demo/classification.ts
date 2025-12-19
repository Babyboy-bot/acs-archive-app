/**
 * Module de classification des messages utilisateur
 * 
 * Responsabilités :
 * - Analyser et classifier les messages (salutation, question, hors-scope, etc.)
 * - Détecter la langue, le sentiment, l'urgence
 * - Générer des réponses appropriées pour les messages non-document
 */

import { TYPE_DOCUMENT_KEYWORDS } from './criteria'

// ============================================================================
// TYPES
// ============================================================================

export type TypeMessage = 
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
export type MessageMetadata = {
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
// FONCTIONS UTILITAIRES DE DÉTECTION
// ============================================================================

export function detecterLangue(text: string): 'fr' | 'en' | 'autre' {
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

export function detecterSentiment(text: string): 'positif' | 'negatif' | 'neutre' {
  const positif = /\b(merci|super|genial|parfait|excellent|bien|content|ravi|bravo|cool|top|nickel|formidable|magnifique)\b/
  const negatif = /\b(nul|mauvais|horrible|frustre|decu|enerve|agace|probleme|erreur|bug|marche pas|fonctionne pas|impossible)\b/
  
  if (positif.test(text)) return 'positif'
  if (negatif.test(text)) return 'negatif'
  return 'neutre'
}

export function detecterPeriode(text: string): string | null {
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

export function detecterFaibleQualite(text: string, words: string[]): boolean {
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

// ============================================================================
// CLASSIFICATION PRINCIPALE
// ============================================================================

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
  // =========================================================================
  
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
  
  const contientMotCleAcs = MOTS_CLES_ACS.some(mot => {
    const regex = new RegExp(`\\b${mot}\\b`, 'i')
    return regex.test(normalized)
  })
  
  const contientCodeClient = /\b[A-Z0-9]{2,5}\b/.test(normalized) && /\b(client|document|pour|de|du)\b/.test(normalized)
  
  if (contientMotCleAcs || contientCodeClient) {
    // Continue vers document
  } else {
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
    /^(document|documents|doc|docs)[?!.]?$/,
    /^(client|clients)[?!.]?$/,
    /^(cherche|recherche|trouve|trouver)[?!.]?$/,
    /^(montre|voir|affiche)[?!.]?$/,
    /^(quoi|que|comment|ou|quand|pourquoi)[?!]?$/,
    /^(aide|help|sos|besoin)[?!]?$/,
    /^(tout|tous|toutes)[?!.]?$/,
    /^(un truc|quelque chose|n'?importe quoi)[?!.]?$/,
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

// ============================================================================
// FONCTION PRINCIPALE D'ANALYSE
// ============================================================================

export function analyserMessageComplet(question: string): MessageMetadata {
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
  
  // Détection de client potentiel
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
  
  // Question multiple
  const questionMultiple = (normalized.match(/\?/g) || []).length > 1 || /\bet\b.*\?/.test(normalized)
  
  // Faible qualité
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

// ============================================================================
// GÉNÉRATION DE RÉPONSES
// ============================================================================

export function genererReponseNonDocument(type: TypeMessage, question: string): string {
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

// ============================================================================
// FONCTIONS DE DÉTECTION SPÉCIALISÉES
// ============================================================================

export function estSalutation(question: string): boolean {
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

export function estQuestionDefinitionGenerale(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!normalized) return false

  const normalizedQuotes = normalized
    .replace(/['']/g, "'")
    .replace(/[''–—]/g, '-')

  const definitionPatterns = [
    /^c'?e?st quoi/,
    /^qu'?e?st[- ]ce qu/,
    /^que signifie/,
    /^que veut dire/,
    /^ca (veut|signifie|represente) quoi/,
    /^definition d[eu']/,
    /^defini[rs]/,
    /^explique[- ]?moi (ce qu|le |la |les |un |une )/,
    /^(peux-?tu|tu peux) m'?expliquer/,
    /^(dis-?moi|dit-?moi) ce qu/,
    /quelle (est la )?difference entre/,
    /qu'?entend[- ]?on par/,
    /ca correspond a quoi/,
    /a quoi (ca |cela )?(sert|correspond)/,
  ]

  const isDefinitionQuestion = definitionPatterns.some((pattern) => pattern.test(normalizedQuotes))
  
  if (!isDefinitionQuestion) return false

  const documentRequestIndicators = [
    /\b[0-9]{1,2}[a-z]{2}\b/i,
    /\b(client|pour) [a-z0-9]{2,4}\b/i,
    /\b(montre|affiche|liste|donne|trouve|cherche|recupere)\b.*\b(moi|les|mes|tous)\b/,
    /\b(mes|les|tous les|la liste des)\b.*(documents?|factures?|contrats?|courriers?)/,
    /\bdu [0-9]{1,2}/,
    /\bn[°o] ?[0-9]+\b/i,
  ]

  const isDocumentRequest = documentRequestIndicators.some((pattern) => pattern.test(normalizedQuotes))
  
  return !isDocumentRequest
}

export function estQuestionConseilGeneral(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!normalized) return false

  const normalizedQuotes = normalized
    .replace(/['']/g, "'")
    .replace(/[''–—]/g, '-')

  const conseilPatterns = [
    /^comment (bien |faire |puis-?je |peut-?on |dois-?je )?/,
    /^que (dois-?je|faut-?il|me conseilles?)/,
    /^quels? (sont les |bons? )?(conseils?|reflexes?|pratiques?)/,
    /\b(tu |vous )?(me |nous )?conseille(s|z|rais)/,
    /^si je (demarrais|partais|commencais)/,
    /\bmeilleure? (facon|methode|pratique|maniere)\b/,
    /\bbonnes? pratiques?\b/,
    /\b(eviter|prevenir|anticiper) (les |des |que )/,
    /\b(organiser|structurer|classer|ranger|gerer)\b.*\b(mes|les|ses)\b/,
    /^(as-?tu|avez-?vous) (des |un )?(conseils?|suggestions?|recommandations?)/,
  ]

  const isConseilQuestion = conseilPatterns.some((pattern) => pattern.test(normalizedQuotes))
  
  if (!isConseilQuestion) return false

  const documentRequestIndicators = [
    /\b[0-9]{1,2}[a-z]{2}\b/i,
    /\b(client|pour) [a-z0-9]{2,4}\b/i,
    /\b(montre|affiche|liste|donne|trouve)\b.*\b(moi|les)\b/,
    /\bdu [0-9]{1,2}/,
    /\bn[°o] ?[0-9]+\b/i,
  ]

  return !documentRequestIndicators.some((pattern) => pattern.test(normalizedQuotes))
}

export function estQuestionExplicationConcept(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!normalized) return false

  const normalizedQuotes = normalized
    .replace(/['']/g, "'")
    .replace(/[''–—]/g, '-')

  const explicationPatterns = [
    /^je (veux|veut|voudrais|souhaite|aimerais) (juste )?(comprendre|savoir)/,
    /^(explique|dis|dit)[- ]?(moi|nous)/,
    /\b(dis|dit)[- ]?m'?en plus\b/,
    /^(peux-?tu|tu peux|pourrais-?tu) (m'?|me )?(expliquer|clarifier|detailler)/,
    /^(j'?ai|je) (pas |mal )?(compris|saisi)/,
    /\b(plus |mieux )?(d'?explications?|de details?|d'?infos?)\b/,
    /^(c'?est|ca serait) (quoi |comment )?(exactement|precisement|concretement)/,
    /\bje (ne )?(comprends?|sais) (pas|plus)\b/,
    /^en (gros|resume|clair|fait)/,
    /\b(reformule|clarifie|precise|developpe)\b/,
  ]

  const isExplicationQuestion = explicationPatterns.some((pattern) => pattern.test(normalizedQuotes))
  
  if (!isExplicationQuestion) return false

  const documentRequestIndicators = [
    /\b[0-9]{1,2}[a-z]{2}\b/i,
    /\b(client|pour) [a-z0-9]{2,4}\b/i,
    /\b(montre|affiche|liste|donne|trouve)\b.*\b(moi|les)\b/,
    /\bdu [0-9]{1,2}/,
    /\bn[°o] ?[0-9]+\b/i,
  ]

  return !documentRequestIndicators.some((pattern) => pattern.test(normalizedQuotes))
}

export function estQuestionCapacitesAssistant(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!normalized) return false

  const normalizedQuotes = normalized
    .replace(/['']/g, "'")
    .replace(/[''–—]/g, '-')

  const capacitesPatterns = [
    /^(que |qu'?est-?ce que )(tu )?(sais|peux)[- ]?(tu )?(faire|chercher|trouver)/,
    /^(tu )?(sais|peux)[- ]?(tu )?(faire|chercher|trouver) quoi/,
    /^(quelles sont tes |tes )(capacites|fonctionnalites|limites|possibilites)/,
    /^(jusqu'?ou|a quel point) (tu )?(peux|sais)/,
    /^(tu )?(es|est)[- ]?(tu )?(capable|en mesure) de/,
    /^(comment )?(tu )?(fonctionnes?|marches?)/,
    /^(tu )?(peux|sais)[- ]?(tu )?m'?aider (a|pour|avec)/,
    /^(qu'?est-?ce que je peux te demander|que puis-?je te demander)/,
    /^(aide|help|sos|au secours)[!?]*$/,
  ]

  return capacitesPatterns.some((pattern) => pattern.test(normalizedQuotes))
}
