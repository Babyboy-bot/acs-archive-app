import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { email, motDePasse } = await request.json()

    // Validation des données
    if (!email || !motDePasse) {
      return NextResponse.json(
        { erreur: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    // Rechercher l'utilisateur
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { email },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        motDePasse: true,
        role: true,
        estActif: true,
      },
    })

    // Vérifier si l'utilisateur existe
    if (!utilisateur) {
      return NextResponse.json(
        { erreur: 'Identifiants invalides' },
        { status: 401 }
      )
    }

    // Vérifier si le compte est actif
    if (!utilisateur.estActif) {
      return NextResponse.json(
        { erreur: 'Compte désactivé' },
        { status: 403 }
      )
    }

    // Vérifier le mot de passe (en production, utiliser bcrypt.compare)
    // Pour l'instant, comparaison directe (à sécuriser plus tard)
    if (utilisateur.motDePasse !== motDePasse) {
      return NextResponse.json(
        { erreur: 'Identifiants invalides' },
        { status: 401 }
      )
    }

    // Créer une session (simplifié - en production utiliser NextAuth ou JWT)
    const sessionData = {
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      email: utilisateur.email,
      role: utilisateur.role,
    }

    // Enregistrer l'activité de connexion
    await prisma.journalActivite.create({
      data: {
        action: 'CONSULTATION',
        details: 'Connexion utilisateur',
        utilisateurId: utilisateur.id,
        adresseIp: request.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    const response = NextResponse.json(
      {
        succes: true,
        utilisateur: sessionData,
      },
      { status: 200 }
    )

    // Créer un cookie de session (simplifié)
    response.cookies.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    })

    return response
  } catch (error) {
    console.error('Erreur lors de la connexion:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
