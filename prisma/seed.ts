import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Début du seed de la base de données...')

  // 1. Créer un utilisateur admin
  const admin = await prisma.utilisateur.upsert({
    where: { email: 'elie.kassi@acs.ci' },
    update: {},
    create: {
      nom: 'Kassi',
      prenom: 'Elie Emmanuel',
      email: 'elie.kassi@acs.ci',
      motDePasse: 'admin123', // À hasher en production avec bcrypt
      role: 'ADMIN',
      estActif: true,
    },
  })
  console.log('✅ Utilisateur admin créé:', admin.email)

  // 2. Créer des clients
  const client1 = await prisma.client.create({
    data: {
      nom: 'Entreprise ABC',
      numeroClient: 'CLI-2025-001',
      type: 'ENTREPRISE',
      email: 'contact@abc.ci',
      telephone: '+225 27 20 00 00 00',
      adresse: 'Abidjan, Plateau',
    },
  })

  const client2 = await prisma.client.create({
    data: {
      nom: 'SARL Transport CI',
      numeroClient: 'CLI-2025-002',
      type: 'ENTREPRISE',
      email: 'info@transportci.com',
      telephone: '+225 27 21 00 00 00',
      adresse: 'Abidjan, Yopougon',
    },
  })

  const client3 = await prisma.client.create({
    data: {
      nom: 'Kouassi Jean-Marie',
      numeroClient: 'CLI-2025-003',
      type: 'PARTICULIER',
      email: 'jm.kouassi@gmail.com',
      telephone: '+225 07 00 00 00 00',
    },
  })
  console.log('✅ 3 clients créés')

  // 3. Créer des exercices
  const exercice1_2025 = await prisma.exercice.create({
    data: {
      annee: 2025,
      clientId: client1.id,
      statut: 'ACTIF',
    },
  })

  const exercice1_2024 = await prisma.exercice.create({
    data: {
      annee: 2024,
      clientId: client1.id,
      statut: 'ARCHIVE',
    },
  })

  const exercice2_2025 = await prisma.exercice.create({
    data: {
      annee: 2025,
      clientId: client2.id,
      statut: 'ACTIF',
    },
  })

  const exercice3_2025 = await prisma.exercice.create({
    data: {
      annee: 2025,
      clientId: client3.id,
      statut: 'ACTIF',
    },
  })
  console.log('✅ 4 exercices créés')

  // 4. Créer des risques
  const risqueAuto1 = await prisma.risque.create({
    data: {
      type: 'AUTOMOBILE',
      numeroPolice: 'POL-AUTO-2025-001',
      exerciceId: exercice1_2025.id,
    },
  })

  const risqueSante1 = await prisma.risque.create({
    data: {
      type: 'SANTE',
      numeroPolice: 'POL-SANTE-2025-002',
      exerciceId: exercice1_2025.id,
    },
  })

  const risqueAuto2 = await prisma.risque.create({
    data: {
      type: 'AUTOMOBILE',
      numeroPolice: 'POL-AUTO-2025-003',
      exerciceId: exercice2_2025.id,
    },
  })

  const risqueHabitation = await prisma.risque.create({
    data: {
      type: 'HABITATION',
      numeroPolice: 'POL-HAB-2025-004',
      exerciceId: exercice3_2025.id,
    },
  })
  console.log('✅ 4 risques créés')

  // 5. Créer des documents
  const doc1 = await prisma.document.create({
    data: {
      titre: 'Police Automobile 2025 - Entreprise ABC',
      description: 'Contrat d\'assurance automobile pour la flotte de véhicules',
      cheminFichier: '/documents/2025/pol-auto-001.pdf',
      typeFichier: 'application/pdf',
      tailleFichier: 2457600, // 2.4 MB
      typeCourrier: 'ACS_VERS_CLIENT',
      risqueId: risqueAuto1.id,
      auteurId: admin.id,
      dateDocument: new Date('2025-01-15'),
      reference: 'DOC-2025-001',
    },
  })

  const doc2 = await prisma.document.create({
    data: {
      titre: 'Demande de cotation - Compagnie XYZ',
      description: 'Demande de cotation pour assurance automobile',
      cheminFichier: '/documents/2025/cotation-xyz-001.pdf',
      typeFichier: 'application/pdf',
      tailleFichier: 870400, // 850 KB
      typeCourrier: 'ACS_VERS_COMPAGNIE',
      risqueId: risqueAuto1.id,
      auteurId: admin.id,
      dateDocument: new Date('2025-01-10'),
      reference: 'DOC-2025-002',
    },
  })

  const doc3 = await prisma.document.create({
    data: {
      titre: 'Attestation santé collective',
      description: 'Attestation d\'assurance santé pour les employés',
      cheminFichier: '/documents/2025/att-sante-002.pdf',
      typeFichier: 'application/pdf',
      tailleFichier: 1258291, // 1.2 MB
      typeCourrier: 'ACS_VERS_CLIENT',
      risqueId: risqueSante1.id,
      auteurId: admin.id,
      dateDocument: new Date('2025-02-01'),
      reference: 'DOC-2025-003',
    },
  })

  const doc4 = await prisma.document.create({
    data: {
      titre: 'Contrat flotte véhicules - Transport CI',
      description: 'Assurance flotte pour 15 véhicules de transport',
      cheminFichier: '/documents/2025/flotte-transport-003.pdf',
      typeFichier: 'application/pdf',
      tailleFichier: 3145728, // 3 MB
      typeCourrier: 'ACS_VERS_CLIENT',
      risqueId: risqueAuto2.id,
      auteurId: admin.id,
      dateDocument: new Date('2025-01-20'),
      reference: 'DOC-2025-004',
    },
  })

  const doc5 = await prisma.document.create({
    data: {
      titre: 'Police habitation particulier',
      description: 'Assurance multirisque habitation',
      cheminFichier: '/documents/2025/hab-particulier-004.pdf',
      typeFichier: 'application/pdf',
      tailleFichier: 1572864, // 1.5 MB
      typeCourrier: 'ACS_VERS_CLIENT',
      risqueId: risqueHabitation.id,
      auteurId: admin.id,
      dateDocument: new Date('2025-02-15'),
      reference: 'DOC-2025-005',
    },
  })
  console.log('✅ 5 documents créés')

  // 6. Créer des entrées de journal
  await prisma.journalActivite.createMany({
    data: [
      {
        action: 'CREATION',
        details: 'Création du document: Police Automobile 2025',
        utilisateurId: admin.id,
        documentId: doc1.id,
        adresseIp: '127.0.0.1',
      },
      {
        action: 'CREATION',
        details: 'Création du document: Demande de cotation',
        utilisateurId: admin.id,
        documentId: doc2.id,
        adresseIp: '127.0.0.1',
      },
      {
        action: 'CONSULTATION',
        details: 'Consultation du document: Police Automobile 2025',
        utilisateurId: admin.id,
        documentId: doc1.id,
        adresseIp: '127.0.0.1',
      },
    ],
  })
  console.log('✅ Journal d\'activité créé')

  console.log('\n🎉 Seed terminé avec succès!')
  console.log('\n📊 Résumé:')
  console.log('   - 1 utilisateur admin')
  console.log('   - 3 clients')
  console.log('   - 4 exercices')
  console.log('   - 4 risques')
  console.log('   - 5 documents')
  console.log('   - 3 entrées de journal')
  console.log('\n🔐 Identifiants admin:')
  console.log('   Email: elie.kassi@acs.ci')
  console.log('   Mot de passe: admin123')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
