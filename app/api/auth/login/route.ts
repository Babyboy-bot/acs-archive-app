import { NextRequest, NextResponse } from 'next/server'
import { authentifier } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { nomUtilisateur, motDePasse } = await request.json()

    // Validation des données
    if (!nomUtilisateur || !motDePasse) {
      return NextResponse.json(
        { erreur: 'Nom d\'utilisateur et mot de passe requis' },
        { status: 400 }
      )
    }

    // Authentifier
    const resultat = await authentifier(nomUtilisateur, motDePasse)

    if (!resultat.success) {
      return NextResponse.json(
        { erreur: resultat.erreur },
        { status: 401 }
      )
    }

    // Créer la réponse avec token
    const response = NextResponse.json(
      {
        success: true,
        utilisateur: resultat.utilisateur,
        token: resultat.token
      },
      { status: 200 }
    )

    // Créer un cookie de session sécurisé
    if (resultat.token) {
      response.cookies.set('auth-token', resultat.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 jours
      })
    }

    return response
  } catch (error) {
    console.error('Erreur lors de la connexion:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
