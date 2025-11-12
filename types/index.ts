// Types TypeScript pour l'application ACS Archive
// Tous les noms sont en français

// Enums (générés par Prisma après prisma generate)
export enum RoleUtilisateur {
  ADMIN = 'ADMIN',
  GESTIONNAIRE = 'GESTIONNAIRE',
  EMPLOYE = 'EMPLOYE',
  CONSULTANT = 'CONSULTANT'
}

export enum TypeAction {
  CREATION = 'CREATION',
  CONSULTATION = 'CONSULTATION',
  MODIFICATION = 'MODIFICATION',
  SUPPRESSION = 'SUPPRESSION',
  TELECHARGEMENT = 'TELECHARGEMENT'
}

export enum TypeClient {
  ENTREPRISE = 'ENTREPRISE',
  PARTICULIER = 'PARTICULIER'
}

export enum TypeRisque {
  AUTOMOBILE = 'AUTOMOBILE',
  SANTE = 'SANTE',
  HABITATION = 'HABITATION',
  VIE = 'VIE',
  RESPONSABILITE_CIVILE = 'RESPONSABILITE_CIVILE',
  AUTRE = 'AUTRE'
}

export enum TypeCourrier {
  ACS_VERS_CLIENT = 'ACS_VERS_CLIENT',
  ACS_VERS_COMPAGNIE = 'ACS_VERS_COMPAGNIE'
}

export enum StatutExercice {
  ACTIF = 'ACTIF',
  ARCHIVE = 'ARCHIVE',
  CLOTURE = 'CLOTURE'
}

// Type pour un utilisateur connecté (sans mot de passe)
export type UtilisateurConnecte = {
  id: string
  nom: string
  prenom: string
  email: string
  role: RoleUtilisateur
  estActif: boolean
}

// Type pour les données de connexion
export type DonneesConnexion = {
  email: string
  motDePasse: string
}

// Type pour l'inscription d'un nouvel utilisateur
export type DonneesInscription = {
  nom: string
  prenom: string
  email: string
  motDePasse: string
  role?: RoleUtilisateur
}

// Type pour un document
export type DocumentInfo = {
  id: string
  titre: string
  description?: string
  nomFichier: string
  cheminFichier: string
  typeFichier: string
  tailleFichier: number
  numeroReference?: string
  dateDocument?: Date
  dateCreation: Date
  categorie: {
    id: string
    nom: string
    couleur?: string
  }
  createur: {
    id: string
    nom: string
    prenom: string
  }
  etiquettes: {
    id: string
    nom: string
    couleur?: string
  }[]
}

// Type pour le téléversement de fichier
export type DonneesTeleversement = {
  titre: string
  description?: string
  categorieId: string
  numeroReference?: string
  dateDocument?: Date
  etiquettes?: string[]
}

// Type pour une entrée du journal d'activité
export type EntreeJournal = {
  id: string
  action: TypeAction
  details?: string
  adresseIp?: string
  dateAction: Date
  utilisateur: {
    nom: string
    prenom: string
  }
  document?: {
    titre: string
  }
}

// Type pour les statistiques du tableau de bord
export type StatistiquesDashboard = {
  nombreDocuments: number
  nombreUtilisateurs: number
  nombreCategories: number
  espaceTotalUtilise: number // en octets
  documentsRecents: DocumentInfo[]
  activitesRecentes: EntreeJournal[]
}

// Type pour les filtres de recherche
export type FiltresRecherche = {
  texte?: string
  categorieId?: string
  etiquettes?: string[]
  dateDebut?: Date
  dateFin?: Date
  createurId?: string
}

// Type pour la réponse API standard
export type ReponseAPI<T = unknown> = {
  succes: boolean
  message?: string
  donnees?: T
  erreur?: string
}
