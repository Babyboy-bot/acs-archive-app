/**
 * Système de filtrage multi-critères pour les documents
 * Vérifie que les documents correspondent à TOUS les critères demandés
 */

import type { DocumentPiece } from './types'
import { 
  TYPE_DOCUMENT_KEYWORDS, 
  TYPES_RISQUES, 
  extraireCriteresRecherche,
  type CriteresRecherche 
} from './context'

/**
 * Résultat du filtrage multi-critères
 */
export type ResultatFiltrage = {
  pertinents: DocumentPiece[]
  nonPertinents: DocumentPiece[]
  tousNonPertinents: boolean
  criteresNonTrouves: string[]
  criteresUtilises: CriteresRecherche
}

/**
 * Vérifie si un document correspond à un critère spécifique
 */
export function documentCorrespondAuCritere(piece: DocumentPiece, critere: string, valeur: string): boolean {
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
      const exercice = String(metadata.exercice || '')
      const exerciceStr = exercice.trim()
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
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const typeCourrier = normalize((metadata.type_courrier as string) || '')
      const typeDoc = normalize((metadata.type as string) || '')
      const critereNorm = normalize(valeur)
      return typeCourrier === critereNorm || typeDoc === critereNorm
    }
    
    case 'reference': {
      const ref = ((metadata.reference as string) || '').toUpperCase()
      return ref.includes(valeur) || titre.toUpperCase().includes(valeur) || contenu.toUpperCase().includes(valeur)
    }
    
    default:
      return true
  }
}

/**
 * Fonction principale de filtrage multi-critères
 */
export function filtrerParPertinence(pieces: DocumentPiece[], question: string): ResultatFiltrage {
  const criteres = extraireCriteresRecherche(question)
  
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

/**
 * Ancienne fonction maintenue pour compatibilité
 */
export function verifierPertinenceResultats(pieces: DocumentPiece[], typeDemande: string | null): {
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

/**
 * Génère une narration simple et directe pour les résultats de recherche
 */
export function genererNarrationSimple(
  pieces: DocumentPiece[], 
  criteres: CriteresRecherche,
  contexte: { client?: string | null, annee?: string | null, risque?: string | null }
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
