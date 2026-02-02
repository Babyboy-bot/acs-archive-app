import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware Next.js pour la protection des routes côté serveur.
 * 
 * Vérifie la présence du cookie access_token avant d'autoriser l'accès
 * aux routes protégées. Cela évite le "flash" de contenu avant redirection
 * qui se produit avec une vérification côté client uniquement.
 */

// Routes publiques (accessibles sans authentification)
const PUBLIC_ROUTES = [
  '/connexion',
  '/mot-de-passe-oublie',
  '/contact-administrateur',
]

// Routes API et assets à ignorer
const IGNORED_PREFIXES = [
  '/api/',
  '/_next/',
  '/favicon.ico',
  '/acs-logo.svg',
  '/static/',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorer les routes API, assets statiques et fichiers Next.js
  if (IGNORED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Autoriser les routes publiques
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // Vérifier la présence du cookie access_token
  const accessToken = request.cookies.get('access_token')?.value

  if (!accessToken) {
    // Pas de token = rediriger vers la page de connexion
    const loginUrl = new URL('/connexion', request.url)
    // Sauvegarder l'URL demandée pour redirection après connexion (optionnel)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token présent = autoriser l'accès
  // Note: La validité du token sera vérifiée par le backend lors des appels API
  return NextResponse.next()
}

export const config = {
  // Matcher pour toutes les routes sauf les fichiers statiques
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
