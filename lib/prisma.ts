import { PrismaClient } from '@prisma/client'

// Déclaration globale pour TypeScript
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Instance unique de Prisma Client
export const prisma = global.prisma || new PrismaClient()

// En développement, on garde l'instance en cache pour éviter les reconnexions
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}
