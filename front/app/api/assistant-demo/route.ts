import { NextResponse } from 'next/server'
import { 
  verifierRateLimit, 
  extraireUserIdDepuisToken,
  extraireTokenDepuisCookies,
  generateSessionId,
} from './security'
import type { AssistantResponse, AssistantTrace, DocumentPiece, Statistiques } from './types'
import { RoleUtilisateur } from '../../../types'
import { generateLlmAnswer, isLlmConfigured, validateResponse, addToConversation, getConversationHistory, getConversationHistoryWithPersistence, addToConversationWithPersistence, buildConversationSystemPrompt, buildClarificationSystemPrompt, updateMemoryAfterExchange, detectSubjectTransition, applySubjectTransition, getStructuredMemory, setStructuredMemory, logSubjectTransition, detectUserCorrection, isDocumentFollowUpQuestion, buildDocumentActivePrompt, extractDocumentIndex, getDocumentFromSelection, isContextExpired, getValidContextEntity, updateEntityProtected, CONFIDENCE_THRESHOLD, CONTEXT_EXPIRATION_MS, classifyIntention, convertLlmIndexToSystemIndex, calculerScoreQualiteOcr, SEUILS_CONFIANCE, type DocumentSelection, type ClassificationResult, type ClassificationContext, type OcrQualityResult, type CriteresExtraits } from './llm'
import { 
  recordInteraction, 
  enrichPromptWithLearning,
} from './learning'
import {
  type TypeMessage,
  estSalutation,
  estQuestionDefinitionGenerale,
  estQuestionConseilGeneral,
  estQuestionExplicationConcept,
  estQuestionCapacitesAssistant
} from './classification'
// Import centralisé depuis criteria.ts (source unique de vérité)
import {
  type CriteresRecherche,
  type ModeAssistant,
  TYPE_DOCUMENT_KEYWORDS,
  extraireCriteresRecherche,
  loadValidClients,
  classifierSimple,
  estQuestionAssuranceCourtage,
  estQuestionComptageContextuel,
  detectIntent,
} from './criteria'
import {
  incrementRequest,
  incrementLlmSuccess,
  incrementLlmFallback,
  incrementErrors,
  journaliserAssistant,
} from './telemetry'
import {
  TONES,
  construireInsightsDocuments,
  construireActionsDocuments,
  construireNarrationHeuristique,
  genererNarrationSimple,
  construireResumeStatistiques,
  construireInsightsStatistiques,
  construireActionsStatistiques,
  construireResumeDocuments,
} from './narration'
import {
  BackendError,
  DEFAULT_TOP_K,
  extraireClientMentionne,
  verifierCodeClientBackend,
  logLlmUsage,
  rechercherDocuments,
  collecterStatistiques,
  type FiltresRecherche,
} from './api-client'
import { filtrerParPertinence } from './filtering'

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

type QueryPayload = {
  question?: string
  topK?: number
  tone?: 'amical' | 'formel' | 'concis' | 'premium'
  conversationId?: string | null
}

const ASSISTANT_ENABLED = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? 'true').toLowerCase() !== 'false'

const ROLES_AUTORISES = new Set<RoleUtilisateur>([
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
	
	const clientRegex = /(?:client|nom(?:\s+de)?|pour)\s+(?:du|de|la)?\s*([a-z0-9]{2,4})/i;
	const clientMatch = normalized.match(clientRegex);
	
	if (clientMatch && clientMatch[1]) {
	  const nomClient = clientMatch[1].toUpperCase();
	  
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

	const mentionsClients = normalized.includes('client') || normalized.includes('clients')
	const mentionsCompte = ['combien', 'nombre', 'total'].some((keyword) => normalized.includes(keyword))
	if (!mentionsClients || !mentionsCompte) return null

	const isParticuliers = normalized.includes('particulier') || normalized.includes('particuliers')
	const isEntreprises = normalized.includes('entreprise') || normalized.includes('entreprises')

	if (isParticuliers) return 'particuliers'
	if (isEntreprises) return 'entreprises'
	return 'tous'
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
  const userId = extraireUserIdDepuisToken(token)

  try {
    if (!ASSISTANT_ENABLED) {
      return NextResponse.json({ erreur: 'Assistant désactivé' }, { status: 503 })
    }

    // Rate limit par IP ET par userId pour une protection robuste
    const rateLimit = verifierRateLimit(request, userId)
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
    // IMPORTANT: isoler le contexte par discussion (conversationId)
    const sessionId = generateSessionId(token, payload.conversationId)

    // Charger la liste des clients valides (liste blanche) pour éviter les faux positifs
    // Cette liste est mise en cache pendant 5 minutes
    await loadValidClients(token)

    // Hydrater l'historique depuis la persistance si nécessaire (utile en dev / hot-reload)
    // Important : on doit hydrater AVANT de traiter une réponse A/B, sinon on ne retrouve pas
    // la dernière question de clarification et on boucle.
    await getConversationHistoryWithPersistence(sessionId, token)

    const choixClarif = extraireChoixClarification(questionBrute)
    const clarif = choixClarif ? recupererDerniereClarification(sessionId) : null

    let questionOriginale = questionBrute
    let modeAssistantForce: ModeAssistant | null = null
    let clarificationResolue = false
    if (choixClarif && clarif) {
      questionOriginale = choixClarif.reste
        ? `${clarif.questionBase}\n\nPrécision utilisateur: ${choixClarif.reste}`
        : clarif.questionBase
      modeAssistantForce = 'recherche_document'
      clarificationResolue = true
    }
    
    // Récupérer le contexte de conversation (pour les requêtes de suivi)
    const contexteConv = extraireContexteHistorique(sessionId)
    
    // Extraire les critères de la question originale
    const criteresQuestion = extraireCriteresRecherche(questionOriginale)

    let clientQuestion = criteresQuestion.client
    if (clientQuestion) {
      const validation = await verifierCodeClientBackend(clientQuestion, token)
      if (validation === false) {
        clientQuestion = null
      }
    }
    
    // =========================================================================
    // MODE SUIVI DOCUMENT - Classification LLM légère + fallback patterns
    // =========================================================================
    const currentMemory = getStructuredMemory(sessionId)
    const selectionCount = currentMemory.focus_actuel.selection?.length || 0
    
    // Récupérer le contexte précédent (client, année, risque) depuis la mémoire
    // Utilise getValidContextEntity pour vérifier l'expiration (10 min)
    const lastClient = getValidContextEntity(currentMemory, 'client') || criteresQuestion.client || null
    const lastAnnee = getValidContextEntity(currentMemory, 'annee') || criteresQuestion.annee || null
    const lastRisque = getValidContextEntity(currentMemory, 'risque') || criteresQuestion.risque || null
    
    // Construire le contexte pour la classification
    const classificationContext: ClassificationContext = {
      hasDocumentsDisplayed: selectionCount > 0,
      documentCount: selectionCount,
      hasActiveDocument: !!currentMemory.document_actif,
      lastSearchQuery: currentMemory.resultats.derniere_recherche || undefined,
      lastClient: lastClient || undefined,
      lastAnnee: lastAnnee || undefined,
      lastRisque: lastRisque || undefined,
    }
    
    // Classification LLM (toujours appelée pour détecter les références contextuelles)
    let classification: ClassificationResult | null = null
    let isFollowUpOnDocument = false
    let requestedIndex: number | null = null
    
    // Tenter la classification LLM
    classification = await classifyIntention(questionOriginale, classificationContext)
    
    if (classification) {
      if (classification.intention === 'suivi_document') {
        isFollowUpOnDocument = true
        requestedIndex = convertLlmIndexToSystemIndex(classification.index_document ?? null, selectionCount)
      } else if (classification.intention === 'recherche_document' && classification.criteres) {
        // Utiliser les critères extraits par le LLM (résout automatiquement "même client" → client réel)
        if (classification.criteres.client) {
          criteresQuestion.client = classification.criteres.client
        }
        if (classification.criteres.annee) {
          criteresQuestion.annee = classification.criteres.annee
        }
        if (classification.criteres.type_document) {
          criteresQuestion.typeDocument = classification.criteres.type_document
        }
        if (classification.criteres.risque) {
          criteresQuestion.risque = classification.criteres.risque
        }
      }
    } else if (classificationContext.hasDocumentsDisplayed || classificationContext.hasActiveDocument) {
      // Fallback vers patterns regex si LLM échoue et qu'il y a des documents affichés
      isFollowUpOnDocument = isDocumentFollowUpQuestion(questionOriginale, currentMemory)
      requestedIndex = extractDocumentIndex(questionOriginale, selectionCount)
      if (isFollowUpOnDocument) {
      }
    }
    
    if (isFollowUpOnDocument) {
      
      // Chercher le document cible
      let targetDoc: { id: string; titre: string; contenu: string; metadata: Record<string, unknown> } | null = null
      
      // Priorité 1: Document depuis la sélection (multi-documents)
      if (selectionCount > 0) {
        const docFromSelection = getDocumentFromSelection(currentMemory, requestedIndex)
        if (docFromSelection) {
          targetDoc = {
            id: docFromSelection.id,
            titre: docFromSelection.label,
            contenu: docFromSelection.contenu || '',
            metadata: docFromSelection.metadata,
          }
        }
      }
      
      // Priorité 2: Document actif unique
      if (!targetDoc && currentMemory.document_actif) {
        targetDoc = {
          id: currentMemory.document_actif.id || 'doc-actif',
          titre: currentMemory.document_actif.titre || 'Document',
          contenu: currentMemory.document_actif.contenu || '',
          metadata: currentMemory.document_actif.metadata || {},
        }
      }
      
      if (targetDoc) {
        // Construire le prompt avec le contenu du document
        let documentPrompt = `[DOCUMENT SELECTIONNE]\n`
        documentPrompt += `Titre: ${targetDoc.titre}\n`
        
        const meta = targetDoc.metadata
        if (meta.client) documentPrompt += `Client: ${meta.client}\n`
        if (meta.exercice) documentPrompt += `Exercice: ${meta.exercice}\n`
        if (meta.type_courrier) documentPrompt += `Type: ${meta.type_courrier}\n`
        if (meta.risque) documentPrompt += `Risque: ${meta.risque}\n`
        if (meta.reference) documentPrompt += `Référence: ${meta.reference}\n`
        
        if (targetDoc.contenu) {
          const contenuTronque = targetDoc.contenu.length > 2000 
            ? targetDoc.contenu.substring(0, 2000) + '...[tronqué]'
            : targetDoc.contenu
          documentPrompt += `\nContenu du document:\n${contenuTronque}\n`
        }
        
        // Calculer le score de qualité OCR du contenu
        const ocrQuality = calculerScoreQualiteOcr(targetDoc.contenu)
        
        // Générer une réponse LLM basée sur le document
        const systemPromptDoc = `Tu es un assistant d'archivage ACS. L'utilisateur te pose une question sur un document qu'il vient de consulter.

${documentPrompt}

IMPORTANT: Réponds de manière concise et précise en te basant UNIQUEMENT sur les informations du document ci-dessus. Ne déduis pas d'informations supplémentaires.`

        try {
          const llmResponse = await generateLlmAnswer({
            question: questionOriginale,
            intent: 'documents',
            sessionId,
            token,
            customSystemPrompt: systemPromptDoc,
          })
          
          // Ajouter l'avertissement OCR si nécessaire
          let reponseFinale = llmResponse.content
          if (ocrQuality.avertissement) {
            reponseFinale = `${llmResponse.content}\n\n---\n${ocrQuality.avertissement}`
          }
          
          // Réutiliser le document comme pièce jointe
          const pieceActif: DocumentPiece = {
            id: targetDoc.id,
            source: targetDoc.titre,
            content: targetDoc.contenu,
            metadata: targetDoc.metadata,
            score: 1.0,
          }
          
          const reponseDoc: AssistantResponse = {
            question: questionOriginale,
            type: 'documents',
            resume: reponseFinale,
            pieces: [], // Ne pas ré-afficher le document, juste le résumé
            insights: [],
            actions: [],
            narration: {
              texte: reponseFinale,
              source: 'llm',
            },
          }
          
          await addToConversationWithPersistence(sessionId, 'user', questionOriginale, token)
          await addToConversationWithPersistence(sessionId, 'assistant', reponseFinale, token)
          
          return NextResponse.json(reponseDoc)
        } catch (err) {
          console.warn('Erreur LLM pour suivi document:', err)
          
          // Fallback: retourner une réponse basée sur les métadonnées du document
          // au lieu de déclencher une nouvelle recherche
          const meta = targetDoc.metadata
          let fallbackResume = `Voici les informations disponibles sur le document **${targetDoc.titre}** :\n\n`
          if (meta.client) fallbackResume += `- **Client** : ${meta.client}\n`
          if (meta.exercice) fallbackResume += `- **Exercice** : ${meta.exercice}\n`
          if (meta.type_courrier) fallbackResume += `- **Type** : ${meta.type_courrier}\n`
          if (meta.risque) fallbackResume += `- **Risque** : ${meta.risque}\n`
          if (meta.reference) fallbackResume += `- **Référence** : ${meta.reference}\n`
          
          if (targetDoc.contenu && targetDoc.contenu.length > 100) {
            const extrait = targetDoc.contenu.substring(0, 300).trim()
            fallbackResume += `\n**Extrait du contenu** :\n${extrait}...`
          } else {
            fallbackResume += `\n*Le contenu détaillé n'est pas disponible pour ce document.*`
          }
          
          const pieceActif: DocumentPiece = {
            id: targetDoc.id,
            source: targetDoc.titre,
            content: targetDoc.contenu,
            metadata: targetDoc.metadata,
            score: 1.0,
          }
          
          const reponseFallback: AssistantResponse = {
            question: questionOriginale,
            type: 'documents',
            resume: fallbackResume,
            pieces: [], // Ne pas ré-afficher le document, juste le résumé
            insights: [],
            actions: [],
            narration: {
              texte: fallbackResume,
              source: 'heuristique',
            },
          }
          
          await addToConversationWithPersistence(sessionId, 'user', questionOriginale, token)
          await addToConversationWithPersistence(sessionId, 'assistant', fallbackResume, token)
          
          return NextResponse.json(reponseFallback)
        }
      }
    }
    
    // =========================================================================
    // ROUTEUR DE SUJET - Détecte continuité/nouveau sujet/clarification
    // =========================================================================
    const subjectAnalysis = detectSubjectTransition(currentMemory, questionOriginale, {
      client: clientQuestion,
      annee: criteresQuestion.annee,
      type_document: criteresQuestion.typeDocument,
      risque: criteresQuestion.risque,
    })
    
    // Détecter si l'utilisateur corrige une mauvaise détection précédente
    const isUserCorrection = detectUserCorrection(sessionId, subjectAnalysis)
    if (isUserCorrection) {
    }
    
    
    // Appliquer la transition selon le type et la confiance
    let updatedMemory = currentMemory
    if (subjectAnalysis.transition === 'new_subject' || subjectAnalysis.transition === 'return_subject') {
      // Appliquer seulement si confiance suffisante
      if (subjectAnalysis.confidence >= CONFIDENCE_THRESHOLD) {
        updatedMemory = applySubjectTransition(currentMemory, subjectAnalysis)
        setStructuredMemory(sessionId, updatedMemory)
      } else {
      }
    }
    
    // Logger la télémétrie
    logSubjectTransition(sessionId, questionOriginale, subjectAnalysis, currentMemory, updatedMemory)
    
    // Fusionner avec le contexte de conversation (critères explicites prioritaires)
    const criteresFinal: CriteresRecherche = {
      typeDocument: criteresQuestion.typeDocument || contexteConv.typeDocument,
      client: clientQuestion || contexteConv.client,
      annee: criteresQuestion.annee || contexteConv.annee,
      risque: criteresQuestion.risque || contexteConv.risque,
      typeCourrier: criteresQuestion.typeCourrier,
      reference: criteresQuestion.reference,
    }

    if (criteresFinal.client) {
      const validationFinale = await verifierCodeClientBackend(criteresFinal.client, token)
      if (validationFinale === false) {
        criteresFinal.client = null
      }
    }
    
    // Classification simplifiée
    const modeAssistant = modeAssistantForce ?? classifierSimple(questionOriginale, criteresFinal)
    
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
        "D'accord. Dis-moi ce que tu souhaites rechercher dans les archives ACS. Par exemple : 'Documents du client 3CB' ou 'Factures 2023'."

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

    if (modeAssistant === 'hors_perimetre') {
      const message =
        "Je peux uniquement rechercher des documents dans les archives ACS. Reformule ta demande, par exemple : 'Documents du client 3CB' ou 'Factures 2023'."
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
      
      
      // CAS SPÉCIAL: Si la dernière réponse disait "pas trouvé" pour un type de document
      // Alors "Combien en a-t-il ?" = "Combien de [type] ?" → 0
      if (dernierVide && typeCible && clientCible) {
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
      if (!ROLES_AUTORISES.has(role)) {
        return construireReponseRestreinte(question, intent, role)
      }
      const statistiques = await collecterStatistiques(token)
      const resumeParDefaut = construireResumeStatistiques(statistiques)
      const insights = construireInsightsStatistiques(statistiques)
      const actions = construireActionsStatistiques(statistiques)

      const typeQuestionClients = analyserQuestionClients(question)
      
      // Si c'est une question sur un client spécifique, on bascule vers la recherche de documents
      if (typeQuestionClients && typeof typeQuestionClients === 'object' && typeQuestionClients.type === 'client_specifique') {
        
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

    if (!ROLES_AUTORISES.has(role)) {
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
    } else {
      // Aucun document ne respecte tous les critères, mais on ne masque pas les résultats.
      // On renvoie quand même les documents trouvés par la recherche de base pour permettre
      // à l'utilisateur de se repérer manuellement (référence, montant, type d'avenant, etc.).
      pieces = piecesRecherche
      if (piecesRecherche.length > 0) {
        messageNonTrouve = true
        criteresManquants = filtrage.criteresNonTrouves
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

    // =========================================================================
    // MISE À JOUR DE LA MÉMOIRE STRUCTURÉE (résumé incrémental)
    // Permet au LLM de garder le contexte sur les longues conversations
    // =========================================================================
    if (token) {
      // Extraire le titre du premier document si un seul résultat
      const documentSelectionne = pieces.length === 1 
        ? ((pieces[0].metadata?.titre as string) || (pieces[0].metadata?.reference as string) || pieces[0].source || null)
        : null
      
      // Stocker le document actif complet si un seul document trouvé
      const documentActif = pieces.length === 1 ? {
        id: pieces[0].id,
        titre: pieces[0].source || (pieces[0].metadata?.titre as string) || 'Document',
        contenu: pieces[0].content || '',
        metadata: pieces[0].metadata || {},
      } : null
      
      // Stocker la liste des documents affichés (pour multi-documents)
      const focusSelection: DocumentSelection[] = pieces.slice(0, 10).map((piece, index) => ({
        id: piece.id,
        numero: index + 1,
        label: piece.source || (piece.metadata?.titre as string) || `Document ${index + 1}`,
        contenu: piece.content || null,
        metadata: piece.metadata || {},
      }))
      
      updateMemoryAfterExchange(token, sessionId, questionOriginale, narration.texte, {
        client: clientContexte || undefined,
        annee: anneeContexte || undefined,
        risque: risqueContexte || undefined,
        type_document: typeDocumentContexte || undefined,
        documents_trouves: pieces.length,
        document_selectionne: documentSelectionne,
        document_actif: documentActif,
        focus_selection: focusSelection.length > 0 ? focusSelection : undefined,
        etat: pieces.length > 0 ? 'resultats_affiches' : 'recherche_en_cours',
      }).catch(err => {
        console.warn('Échec mise à jour mémoire structurée:', err)
      })
    }

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
