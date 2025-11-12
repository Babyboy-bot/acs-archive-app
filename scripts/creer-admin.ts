import { PrismaClient } from '@prisma/client'
import { hasherMotDePasse } from '../lib/auth'

const prisma = new PrismaClient()

async function creerAdmin() {
  try {
    console.log('🔐 Création du compte administrateur...\n')

    // Données de l'admin
    const nomUtilisateur = 'admin'
    const motDePasse = 'Admin@2025' // À changer après première connexion
    const nom = 'Administrateur'
    const prenom = 'Système'
    const email = 'admin@acs.ci'

    // Vérifier si l'admin existe déjà
    const adminExiste = await prisma.utilisateur.findUnique({
      where: { nomUtilisateur }
    })

    if (adminExiste) {
      console.log('❌ Un administrateur existe déjà !')
      console.log(`   Nom d'utilisateur: ${adminExiste.nomUtilisateur}`)
      console.log(`   Nom: ${adminExiste.prenom} ${adminExiste.nom}\n`)
      
      const reponse = await new Promise<string>((resolve) => {
        process.stdout.write('Voulez-vous le remplacer? (oui/non): ')
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim().toLowerCase())
        })
      })

      if (reponse !== 'oui' && reponse !== 'o') {
        console.log('Opération annulée.')
        return
      }

      await prisma.utilisateur.delete({
        where: { id: adminExiste.id }
      })
      console.log('✅ Ancien admin supprimé\n')
    }

    // Hasher le mot de passe
    const motDePasseHash = await hasherMotDePasse(motDePasse)

    // Créer l'admin
    const admin = await prisma.utilisateur.create({
      data: {
        nomUtilisateur,
        nom,
        prenom,
        email,
        motDePasse: motDePasseHash,
        role: 'ADMIN',
        estActif: true
      }
    })

    console.log('✅ Compte administrateur créé avec succès !\n')
    console.log('📋 Informations de connexion:')
    console.log('─────────────────────────────────────')
    console.log(`   Nom d'utilisateur: ${nomUtilisateur}`)
    console.log(`   Mot de passe:      ${motDePasse}`)
    console.log('─────────────────────────────────────')
    console.log('\n⚠️  IMPORTANT: Changez ce mot de passe après la première connexion!\n')

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin:', error)
  } finally {
    await prisma.$disconnect()
  }
}

creerAdmin()
