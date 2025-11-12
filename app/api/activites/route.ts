import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')

    const activites = await prisma.journalActivite.findMany({
      take: limit,
      orderBy: {
        dateAction: 'desc'
      },
      include: {
        utilisateur: true,
        document: {
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
        }
      }
    })

    // Transformer pour Timeline
    const activitesFormatted = activites.map(act => ({
      id: act.id,
      date: act.dateAction,
      titre: getActionTitle(act.action, act.document?.titre),
      description: act.details || getActionDescription(act.action, act.document, act.utilisateur),
      type: mapActionToTimelineType(act.action),
      utilisateur: `${act.utilisateur.prenom} ${act.utilisateur.nom}`,
      document: act.document?.titre || undefined
    }))

    return NextResponse.json({
      success: true,
      activites: activitesFormatted,
      total: activitesFormatted.length
    })
  } catch (error) {
    console.error('Erreur activités:', error)
    return NextResponse.json(
      { success: false, erreur: 'Erreur lors de la récupération des activités' },
      { status: 500 }
    )
  }
}

function getActionTitle(action: string, documentTitre?: string): string {
  switch (action) {
    case 'CREATION':
      return 'Document créé'
    case 'MODIFICATION':
      return 'Document modifié'
    case 'CONSULTATION':
      return 'Document consulté'
    case 'TELECHARGEMENT':
      return 'Document téléchargé'
    case 'SUPPRESSION':
      return 'Document supprimé'
    default:
      return 'Action effectuée'
  }
}

function getActionDescription(action: string, document: any, utilisateur: any): string {
  if (document) {
    return `${document.titre} - ${document.risque.exercice.client.nom}`
  }
  return `Action effectuée par ${utilisateur.prenom} ${utilisateur.nom}`
}

function mapActionToTimelineType(action: string): 'creation' | 'modification' | 'consultation' | 'telechargement' | 'suppression' {
  switch (action) {
    case 'CREATION':
      return 'creation'
    case 'MODIFICATION':
      return 'modification'
    case 'CONSULTATION':
      return 'consultation'
    case 'TELECHARGEMENT':
      return 'telechargement'
    case 'SUPPRESSION':
      return 'suppression'
    default:
      return 'consultation'
  }
}
