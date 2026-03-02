/**
 * Module d'appels API backend pour l'assistant - version simplifiée
 */

import type { DocumentPiece, Statistiques } from './types'

// ============================================================================
// TYPES
// ============================================================================

export type DocumentSearchResult = {
  id: string
  titre: string
  reference?: string | null
  client?: string | null
  risque?: string | null
  creeLe?: string | null
}

export type FiltresRecherche = {
  client?: string | null
  typeDocument?: string | null
  annee?: string | null
  risque?: string | null
  reference?: string | null
}

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

/**
 * Recherche de documents via le backend
 */
export async function rechercherDocuments(
  query: string,
  filtres: FiltresRecherche = {},
  token?: string
): Promise<DocumentPiece[]> {
  const params = new URLSearchParams({
    q: query,
    top_k: '5',
  })

  // Ajouter les filtres
  if (filtres.client) params.append('client', filtres.client)
  if (filtres.typeDocument) params.append('type_document', filtres.typeDocument)
  if (filtres.annee) params.append('annee', filtres.annee)
  if (filtres.risque) params.append('risque', filtres.risque)
  if (filtres.reference) params.append('reference', filtres.reference)

  const response = await fetch(`/api/assistant/documents/search?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Erreur recherche: ${response.status}`)
  }

  const data = await response.json()
  return data.results || []
}

/**
 * Collecte les statistiques via le backend
 */
export async function collecterStatistiques(token?: string): Promise<Statistiques> {
  const response = await fetch('/api/assistant/stats/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Erreur stats: ${response.status}`)
  }

  return response.json()
}

/**
 * Vérifie si un code client est valide via le backend
 */
export async function verifierCodeClientBackend(client: string, token?: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/assistant/clients/valid?code=${encodeURIComponent(client)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.valid === true
  } catch {
    return false
  }
}

// ============================================================================
// CLASSES D'ERREUR
// ============================================================================

export class BackendError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

// ============================================================================
// CONSTANTES
// ============================================================================

export const DEFAULT_TOP_K = 5
