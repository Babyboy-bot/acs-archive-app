import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: { exercices: true }
        }
      },
      orderBy: {
        nom: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      clients
    })
  } catch (error) {
    console.error('Erreur clients:', error)
    return NextResponse.json(
      { success: false, erreur: 'Erreur lors de la récupération des clients' },
      { status: 500 }
    )
  }
}
