// Types TypeScript pour l'application ACS Archive
// Tous les noms sont en français

// Enums (générés par Prisma après prisma generate)
export enum RoleUtilisateur {
  ADMIN = 'ADMIN',
  ARCHIVISTE = 'ARCHIVISTE',
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
  ACS_VERS_COMPAGNIE = 'ACS_VERS_COMPAGNIE',
  AVENANT = 'AVENANT',
  FACTURE = 'FACTURE',
  REGLEMENT = 'REGLEMENT',
  DIVERS = 'DIVERS',
  SINISTRE = 'SINISTRE'
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

// ============================================================================
// TYPES CLIENTS ET ENTREPRISES
// ============================================================================

export type TypeClientAPI = 'ENTREPRISE' | 'PARTICULIER'

export type StatutExerciceAPI = 'ACTIF' | 'ARCHIVE' | 'CLOTURE'

export interface RisqueResumeAPI {
  id: string
  type: string
  numeroPolice: string | null
}

export interface ExerciceResumeAPI {
  id: string
  annee: number
  statut: StatutExerciceAPI
  risques: RisqueResumeAPI[]
}

export interface ClientDRF {
  id: string
  nom: string
  numero_client: string | null
  type: TypeClientAPI
  email: string | null
  telephone: string | null
  adresse: string | null
  cree_le: string
  modifie_le: string
  entreprise: string | null
  entreprise_nom: string | null
  nombre_personnes_rattachees: number
  exercices_count?: number
  exercices?: ExerciceResumeAPI[]
}

export interface ClientAPI {
  id: string
  nom: string
  numeroClient: string | null
  type: TypeClientAPI
  email: string | null
  telephone: string | null
  adresse: string | null
  creeLe: string
  modifieLe: string
  entrepriseId: string | null
  entrepriseNom: string | null
  nombrePersonnesRattachees: number
  exercicesCount: number
  exercices: ExerciceResumeAPI[]
}

export interface FormClient {
  id?: string
  nom: string
  numeroClient: string
  type: TypeClientAPI
  email: string
  telephone: string
  adresse: string
  entrepriseId?: string
}

export interface EntrepriseAPI {
  id: string
  nom: string
  siret: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  cree_le: string
  modifie_le: string
}

export interface ClientsResponse {
  count: number
  next: string | null
  previous: string | null
  results: ClientAPI[]
}

export interface ClientDetailResponse extends ClientAPI {
  // Additional fields for detailed view
  notes?: string
  dateDerniereActivite?: string
}

export interface NouveauRisqueSelection {
  type: string
  numeroPolice: string | null
}

// ============================================================================
// TYPES DOCUMENTS
// ============================================================================

export type StatutDocument = 'TRAITE' | 'EN_COURS' | 'ERREUR'

export interface CategorieDocument {
  id: string
  nom: string
  couleur?: string
  description?: string
}

export interface EtiquetteDocument {
  id: string
  nom: string
  couleur?: string
}

export interface CreateurDocument {
  id: string
  nom: string
  prenom: string
  email?: string
}

export interface DocumentDRF {
  id: string
  titre: string
  description?: string
  nom_fichier: string
  chemin_fichier: string
  type_fichier: string
  taille_fichier: number
  numero_reference?: string
  date_document?: string
  date_creation: string
  date_modification: string
  statut: StatutDocument
  categorie: string
  createur: string
  etiquettes: string[]
  url_telechargement: string
  url_visualisation: string
}

export interface DocumentAPI {
  id: string
  titre: string
  description?: string
  nomFichier: string
  cheminFichier: string
  typeFichier: string
  tailleFichier: number
  numeroReference?: string
  dateDocument?: string
  dateCreation: string
  dateModification: string
  statut: StatutDocument
  categorie: CategorieDocument
  createur: CreateurDocument
  etiquettes: EtiquetteDocument[]
  urlTelechargement: string
  urlVisualisation: string
}

export interface DocumentsResponse {
  count: number
  next: string | null
  previous: string | null
  results: DocumentAPI[]
}

export interface DocumentDetailResponse extends DocumentAPI {
  // Additional fields for detailed view
  metadata?: {
    pages?: number
    auteur?: string
    sujet?: string
    motsCles?: string[]
    langue?: string
  }
  historique?: {
    id: string
    action: string
    dateAction: string
    utilisateur: string
  }[]
}

export interface UploadDocumentRequest {
  titre: string
  description?: string
  categorieId: string
  numeroReference?: string
  dateDocument?: string
  etiquettes?: string[]
  // Plus le fichier FormData
}

export interface UpdateDocumentRequest {
  titre?: string
  description?: string
  categorieId?: string
  numeroReference?: string
  dateDocument?: string
  etiquettes?: string[]
}

export interface DocumentStatistics {
  totalDocuments: number
  totalSizeBytes: number
  documentsByStatus: Record<StatutDocument, number>
  documentsByType: Record<string, number>
  documentsByCategory: Record<string, number>
  recentUploads: {
    id: string
    titre: string
    dateCreation: string
    createur: string
  }[]
}

export interface BulkDocumentOperation {
  operation: 'delete' | 'move' | 'tag'
  documentIds: string[]
  targetCategoryId?: string
  tagsToAdd?: string[]
  tagsToRemove?: string[]
}

export interface BulkOperationResult {
  success: boolean
  processed: number
  failed: number
  results: {
    documentId: string
    success: boolean
    error?: string
  }[]
}
