import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'documents', 'clients', 'all'

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        resultats: []
      })
    }

    const resultats: any[] = []

    // Recherche dans documents
    if (type === 'documents' || type === 'all') {
      const documents = await prisma.document.findMany({
        where: {
          OR: [
            { titre: { contains: query, mode: 'insensitive' } },
            { reference: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 10,
        include: {
          risque: {
            include: {
              exercice: {
                include: {
                  client: true
                }
              }
            }
          }
        },
        orderBy: {
          creeLe: 'desc'
        }
      })

      documents.forEach(doc => {
        resultats.push({
          id: doc.id,
          type: 'document',
          titre: doc.titre,
          description: `${doc.risque.exercice.client.nom} - ${doc.risque.type}`,
          url: `/documents/${doc.id}`,
          icone: 'document',
          score: calculateScore(query, doc.titre, doc.reference || '')
        })
      })
    }

    // Recherche dans clients
    if (type === 'clients' || type === 'all') {
      const clients = await prisma.client.findMany({
        where: {
          OR: [
            { nom: { contains: query, mode: 'insensitive' } },
            { numeroClient: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 5,
        include: {
          _count: {
            select: { exercices: true }
          }
        }
      })

      clients.forEach(client => {
        resultats.push({
          id: client.id,
          type: 'client',
          titre: client.nom,
          description: `${client._count.exercices} exercice${client._count.exercices > 1 ? 's' : ''}`,
          url: `/clients/${client.id}`,
          icone: 'building',
          score: calculateScore(query, client.nom, client.numeroClient || '')
        })
      })
    }

    // Trier par score (pertinence)
    resultats.sort((a, b) => b.score - a.score)

    // Générer suggestions IA
    const suggestions = generateAISuggestions(query, resultats)

    return NextResponse.json({
      success: true,
      resultats: resultats.slice(0, 15),
      suggestions
    })
  } catch (error) {
    console.error('Erreur recherche:', error)
    return NextResponse.json(
      { success: false, erreur: 'Erreur lors de la recherche' },
      { status: 500 }
    )
  }
}

// Calcul de score de pertinence
function calculateScore(query: string, ...fields: string[]): number {
  const queryLower = query.toLowerCase()
  let score = 0

  fields.forEach((field, index) => {
    const fieldLower = field.toLowerCase()
    
    // Match exact = score élevé
    if (fieldLower === queryLower) {
      score += 100 / (index + 1)
    }
    // Commence par = bon score
    else if (fieldLower.startsWith(queryLower)) {
      score += 50 / (index + 1)
    }
    // Contient = score moyen
    else if (fieldLower.includes(queryLower)) {
      score += 25 / (index + 1)
    }
  })

  return score
}

// Générer suggestions IA (simulées)
function generateAISuggestions(query: string, resultats: any[]): string[] {
  const suggestions: string[] = []
  const queryLower = query.toLowerCase()

  // Suggestions basées sur mots-clés
  if (queryLower.includes('auto')) {
    suggestions.push('Documents automobile 2025')
    suggestions.push('Polices automobiles tous clients')
  }

  if (queryLower.includes('santé') || queryLower.includes('sante')) {
    suggestions.push('Contrats santé collective')
    suggestions.push('Attestations santé en cours')
  }

  if (queryLower.includes('entreprise')) {
    suggestions.push('Tous les documents entreprises')
    suggestions.push('Exercices actifs entreprises')
  }

  // Suggestions basées sur résultats
  if (resultats.length > 0 && resultats[0].type === 'client') {
    suggestions.push(`Tous les documents de ${resultats[0].titre}`)
  }

  return suggestions.slice(0, 3)
}
