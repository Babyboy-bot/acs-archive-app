import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Récupérer tous les documents avec filtres
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const recherche = searchParams.get('recherche')
    const risque = searchParams.get('risque')
    const typeCourrier = searchParams.get('typeCourrier')
    const clientId = searchParams.get('clientId')

    const where: any = {}

    if (recherche) {
      where.OR = [
        { titre: { contains: recherche, mode: 'insensitive' } },
        { reference: { contains: recherche, mode: 'insensitive' } },
      ]
    }

    if (risque) {
      where.risque = { type: risque }
    }

    if (typeCourrier) {
      where.typeCourrier = typeCourrier
    }

    if (clientId) {
      where.risque = {
        ...where.risque,
        exercice: {
          clientId: clientId
        }
      }
    }

    const documents = await prisma.document.findMany({
      where,
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

    // Transformer pour le frontend
    const documentsFormatted = documents.map(doc => ({
      id: doc.id,
      titre: doc.titre,
      reference: doc.reference || '',
      client: doc.risque.exercice.client.nom,
      exercice: doc.risque.exercice.annee,
      risque: doc.risque.type,
      typeCourrier: doc.typeCourrier,
      date: doc.creeLe.toISOString().split('T')[0],
      taille: doc.tailleFichier ? `${(doc.tailleFichier / 1024 / 1024).toFixed(1)} MB` : 'N/A',
      cheminFichier: doc.cheminFichier,
      color: doc.risque.type === 'AUTOMOBILE' ? '#D32027' : 
             doc.risque.type === 'SANTE' ? '#10B981' :
             doc.risque.type === 'HABITATION' ? '#F59E0B' :
             doc.risque.type === 'VIE' ? '#8B5CF6' : '#0066B3'
    }))

    return NextResponse.json({ 
      success: true, 
      documents: documentsFormatted,
      total: documentsFormatted.length 
    })
  } catch (error) {
    console.error('Erreur récupération documents:', error)
    return NextResponse.json(
      { success: false, erreur: 'Erreur lors de la récupération des documents' },
      { status: 500 }
    )
  }
}

// POST - Créer un nouveau document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { titre, reference, risqueId, typeCourrier, cheminFichier, tailleFichier, typeFichier, auteurId } = body

    if (!titre || !risqueId || !typeCourrier || !typeFichier || !auteurId) {
      return NextResponse.json(
        { success: false, erreur: 'Données manquantes' },
        { status: 400 }
      )
    }

    const document = await prisma.document.create({
      data: {
        titre,
        reference: reference || null,
        risqueId,
        typeCourrier,
        cheminFichier: cheminFichier || '',
        tailleFichier: tailleFichier || 0,
        typeFichier,
        auteurId
      },
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
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Document créé avec succès',
      document 
    })
  } catch (error) {
    console.error('Erreur création document:', error)
    return NextResponse.json(
      { success: false, erreur: 'Erreur lors de la création du document' },
      { status: 500 }
    )
  }
}
