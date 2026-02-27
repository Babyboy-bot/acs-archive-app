/**
 * Module de filtrage multi-critères des documents
 * Vérifie que les documents correspondent aux critères demandés
 */

import type { DocumentPiece } from './types'
import { type CriteresRecherche, TYPE_DOCUMENT_KEYWORDS, TYPES_RISQUES, extraireCriteresRecherche } from './criteria'

// ============================================================================
// TYPES
// ============================================================================

export type ResultatFiltrage = {
  pertinents: DocumentPiece[]
  nonPertinents: DocumentPiece[]
  tousNonPertinents: boolean
  criteresNonTrouves: string[]
  criteresUtilises: CriteresRecherche
}

// ============================================================================
// FILTRAGE
// ============================================================================

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
  
  if (criteresNonTrouves.size > 0) {
  }
  
  return {
    pertinents,
    nonPertinents,
    tousNonPertinents: pertinents.length === 0 && nonPertinents.length > 0,
    criteresNonTrouves: [...criteresNonTrouves],
    criteresUtilises: criteres
  }
}

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
