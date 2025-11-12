import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Compter documents
    const totalDocuments = await prisma.document.count()

    // Utilisateurs actifs
    const utilisateursActifs = await prisma.utilisateur.count({
      where: { estActif: true }
    })

    // Documents aujourd'hui
    const aujourdhui = new Date()
    aujourdhui.setHours(0, 0, 0, 0)
    
    const documentsAujourdhui = await prisma.document.count({
      where: {
        creeLe: {
          gte: aujourdhui
        }
      }
    })

    // Consultations dernière heure (depuis journal activités)
    const uneHeureAvant = new Date(Date.now() - 60 * 60 * 1000)
    const consultationsHeure = await prisma.journalActivite.count({
      where: {
        action: 'CONSULTATION',
        dateAction: {
          gte: uneHeureAvant
        }
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        documents: totalDocuments,
        utilisateursActifs,
        uploadsAujourdhui: documentsAujourdhui,
        consultationsHeure
      }
    })
  } catch (error) {
    console.error('Erreur stats:', error)
    return NextResponse.json(
      { success: false, erreur: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
