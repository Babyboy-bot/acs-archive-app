import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-tres-securise-changez-moi'

export interface UtilisateurSession {
  id: string
  nomUtilisateur: string
  nom: string
  prenom: string
  email: string | null
  role: 'ADMIN' | 'GESTIONNAIRE' | 'EMPLOYE' | 'CONSULTANT'
}

// Hasher un mot de passe
export async function hasherMotDePasse(motDePasse: string): Promise<string> {
  return bcrypt.hash(motDePasse, 10)
}

// Vérifier un mot de passe
export async function verifierMotDePasse(motDePasse: string, hash: string): Promise<boolean> {
  return bcrypt.compare(motDePasse, hash)
}

// Générer un token JWT
export function genererToken(utilisateur: UtilisateurSession): string {
  return jwt.sign(utilisateur, JWT_SECRET, { expiresIn: '7d' })
}

// Vérifier un token JWT
export function verifierToken(token: string): UtilisateurSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UtilisateurSession
  } catch {
    return null
  }
}

// Authentifier un utilisateur
export async function authentifier(nomUtilisateur: string, motDePasse: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { nomUtilisateur }
  })

  if (!utilisateur || !utilisateur.estActif) {
    return { success: false, erreur: 'Identifiants incorrects' }
  }

  const motDePasseValide = await verifierMotDePasse(motDePasse, utilisateur.motDePasse)
  
  if (!motDePasseValide) {
    return { success: false, erreur: 'Identifiants incorrects' }
  }

  // Mettre à jour dernière connexion
  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { derniereConnexion: new Date() }
  })

  const sessionData: UtilisateurSession = {
    id: utilisateur.id,
    nomUtilisateur: utilisateur.nomUtilisateur,
    nom: utilisateur.nom,
    prenom: utilisateur.prenom,
    email: utilisateur.email,
    role: utilisateur.role
  }

  const token = genererToken(sessionData)

  return {
    success: true,
    token,
    utilisateur: sessionData
  }
}

// Vérifier les permissions
export function aLaPermission(
  role: string,
  action: 'voir' | 'creer' | 'modifier' | 'supprimer',
  ressource: 'documents' | 'utilisateurs' | 'categories' | 'stats'
): boolean {
  const permissions: Record<string, Record<string, string[]>> = {
    ADMIN: {
      documents: ['voir', 'creer', 'modifier', 'supprimer'],
      utilisateurs: ['voir', 'creer', 'modifier', 'supprimer'],
      categories: ['voir', 'creer', 'modifier', 'supprimer'],
      stats: ['voir']
    },
    GESTIONNAIRE: {
      documents: ['voir', 'creer', 'modifier', 'supprimer'],
      utilisateurs: ['voir', 'creer', 'modifier'],
      categories: ['voir', 'creer', 'modifier'],
      stats: ['voir']
    },
    EMPLOYE: {
      documents: ['voir', 'creer', 'modifier'],
      utilisateurs: [],
      categories: ['voir'],
      stats: ['voir']
    },
    CONSULTANT: {
      documents: ['voir'],
      utilisateurs: [],
      categories: ['voir'],
      stats: []
    }
  }

  return permissions[role]?.[ressource]?.includes(action) || false
}
