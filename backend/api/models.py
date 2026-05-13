"""

Modèles Django pour l'application ACS Archive

Correspond au schéma Prisma existant

"""

from django.db import models

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

from django.utils import timezone

import uuid





class UtilisateurManager(BaseUserManager):

    """Manager personnalisé pour le modèle Utilisateur"""

    

    def create_user(self, nom_utilisateur, nom, prenom, password=None, **extra_fields):

        """Créer et sauvegarder un utilisateur"""

        if not nom_utilisateur:

            raise ValueError("Le nom d'utilisateur est obligatoire")

        if not nom:

            raise ValueError("Le nom est obligatoire")

        if not prenom:

            raise ValueError("Le prénom est obligatoire")

        

        user = self.model(

            nom_utilisateur=nom_utilisateur,

            nom=nom,

            prenom=prenom,

            **extra_fields

        )

        # Champ legacy pour compatibilité avec la colonne motDePasse existante en base

        # On évite les valeurs NULL pour respecter la contrainte NOT NULL

        if hasattr(user, "mot_de_passe_legacy"):

            user.mot_de_passe_legacy = ""

        user.set_password(password)

        user.save(using=self._db)

        return user

    

    def create_superuser(self, nom_utilisateur, nom, prenom, password=None, **extra_fields):

        """Créer et sauvegarder un superutilisateur"""

        extra_fields.setdefault('role', 'ADMIN')

        extra_fields.setdefault('est_actif', True)

        extra_fields.setdefault('is_staff', True)

        extra_fields.setdefault('is_superuser', True)

        

        return self.create_user(nom_utilisateur, nom, prenom, password, **extra_fields)





class Utilisateur(AbstractBaseUser, PermissionsMixin):

    """Modèle Utilisateur personnalisé"""

    

    ROLE_CHOICES = [

        ('ADMIN', 'Administrateur'),

        ('ARCHIVISTE', 'Archiviste'),

        ('CONSULTANT', 'Consultant'),

    ]

    

    id = models.TextField(primary_key=True, default=uuid.uuid4)

    nom_utilisateur = models.CharField(max_length=150, unique=True, db_column='nomUtilisateur')

    nom = models.CharField(max_length=150)

    prenom = models.CharField(max_length=150)

    email = models.EmailField(blank=True, null=True)

    mot_de_passe_legacy = models.CharField(max_length=255, db_column='motDePasse', default='', blank=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CONSULTANT')

    est_actif = models.BooleanField(default=True, db_column='estActif')

    date_creation = models.DateTimeField(auto_now_add=True, db_column='dateCreation')

    date_modification = models.DateTimeField(auto_now=True, db_column='dateModification')

    derniere_connexion = models.DateTimeField(null=True, blank=True, db_column='derniereConnexion')

    

    # Champs requis pour Django Admin

    is_staff = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)

    

    objects = UtilisateurManager()

    

    USERNAME_FIELD = 'nom_utilisateur'

    REQUIRED_FIELDS = ['nom', 'prenom']

    

    class Meta:

        db_table = 'utilisateurs'

        verbose_name = 'Utilisateur'

        verbose_name_plural = 'Utilisateurs'

        ordering = ['prenom', 'nom']

    

    def __str__(self):

        return f"{self.prenom} {self.nom} ({self.nom_utilisateur})"

    

    def get_full_name(self):

        return f"{self.prenom} {self.nom}"

    

    def get_short_name(self):

        return self.prenom





class Client(models.Model):

    """Modèle Client"""

    

    TYPE_CHOICES = [

        ('ENTREPRISE', 'Entreprise'),

        ('PARTICULIER', 'Particulier'),

    ]

    

    id = models.TextField(primary_key=True, default=uuid.uuid4)

    nom = models.CharField(max_length=255, unique=True)

    numero_client = models.CharField(max_length=100, unique=True, null=True, blank=True, db_column='numeroClient')

    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='ENTREPRISE')

    email = models.EmailField(null=True, blank=True)

    telephone = models.CharField(max_length=50, null=True, blank=True)

    adresse = models.TextField(null=True, blank=True)

    entreprise_parente = models.ForeignKey(

        'self',

        null=True,

        blank=True,

        related_name='membres',

        limit_choices_to={'type': 'ENTREPRISE'},

        on_delete=models.SET_NULL,

    )

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')

    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')

    

    class Meta:

        db_table = 'clients'

        verbose_name = 'Client'

        verbose_name_plural = 'Clients'

        ordering = ['nom']

    

    def __str__(self):

        return self.nom



    @property

    def tous_les_exercices(self):

        """Retourne les exercices visibles pour ce client.



        - Pour un particulier ou un client sans membres : uniquement ses propres exercices.

        - Pour un client de type ENTREPRISE utilisé comme groupe/flotte :

          agrège les exercices de tous ses membres (particuliers rattachés) sans

          nécessiter d'exercices propres sur le groupe lui-même.

        """

        if self.type != 'ENTREPRISE':

            # Pour un particulier ou un client non-entreprise, on retourne uniquement

            # ses propres exercices.

            return self.exercices.all()



        # Pour une ENTREPRISE utilisée comme groupe/flotte, on agrège :

        # - les exercices directement rattachés à l'entreprise

        # - les exercices de tous ses membres (particuliers rattachés)

        return Exercice.objects.filter(

            models.Q(client=self) | models.Q(client__entreprise_parente=self)

        ).distinct()





class Exercice(models.Model):

    """Modèle Exercice (année fiscale)"""

    

    STATUT_CHOICES = [

        ('ACTIF', 'Actif'),

        ('ARCHIVE', 'Archivé'),

        ('CLOTURE', 'Clôturé'),

    ]

    

    id = models.TextField(primary_key=True, default=uuid.uuid4)

    annee = models.IntegerField()

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='exercices', db_column='clientId')

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='ACTIF')

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')

    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')

    

    class Meta:

        db_table = 'exercices'

        verbose_name = 'Exercice'

        verbose_name_plural = 'Exercices'

        unique_together = [['client', 'annee']]

        ordering = ['-annee']

    

    def __str__(self):

        return f"{self.client.nom} - {self.annee}"





class Risque(models.Model):

    """Modèle Risque"""

    

    id = models.TextField(primary_key=True, default=uuid.uuid4)

    type = models.CharField(max_length=100)

    numero_police = models.CharField(max_length=100, null=True, blank=True, db_column='numeroPolice')

    exercice = models.ForeignKey(Exercice, on_delete=models.CASCADE, related_name='risques', db_column='exerciceId')

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')

    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')

    

    class Meta:

        db_table = 'risques'

        verbose_name = 'Risque'

        verbose_name_plural = 'Risques'

        ordering = ['type']

    

    def __str__(self):

        return f"{self.get_type_display()} - {self.exercice}"





class Categorie(models.Model):

    """Modèle Catégorie de documents"""

    

    id = models.TextField(primary_key=True, default=uuid.uuid4)

    nom = models.CharField(max_length=100, unique=True)

    description = models.TextField(null=True, blank=True)

    couleur = models.CharField(max_length=7, default='#D32027')

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')

    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')

    

    class Meta:

        db_table = 'categories'

        verbose_name = 'Catégorie'

        verbose_name_plural = 'Catégories'

        ordering = ['nom']

    

    def __str__(self):

        return self.nom





class Document(models.Model):

    """Modèle Document"""

    

    TYPE_COURRIER_CHOICES = [

        ('ACS_VERS_CLIENT', 'ACS vers Client'),

        ('ACS_VERS_COMPAGNIE', 'ACS vers Compagnie'),

        ('AVENANT', 'Avenant'),

        ('FACTURE', 'Facture'),

        ('REGLEMENT', 'Règlement'),

        ('DIVERS', 'Divers'),

        ('SINISTRE', 'Sinistre'),

    ]

    

    id = models.TextField(primary_key=True, default=uuid.uuid4)

    titre = models.CharField(max_length=255)

    description = models.TextField(null=True, blank=True)

    chemin_fichier = models.CharField(max_length=500, db_column='cheminFichier')

    type_fichier = models.CharField(max_length=50, db_column='typeFichier')

    taille_fichier = models.IntegerField(db_column='tailleFichier')

    type_courrier = models.CharField(max_length=30, choices=TYPE_COURRIER_CHOICES, db_column='typeCourrier')

    risque = models.ForeignKey(Risque, on_delete=models.CASCADE, related_name='documents', db_column='risqueId')

    auteur = models.ForeignKey(Utilisateur, on_delete=models.PROTECT, related_name='documents', db_column='auteurId')

    categorie = models.ForeignKey(Categorie, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents', db_column='categorieId')

    date_document = models.DateTimeField(null=True, blank=True, db_column='dateDocument')

    reference = models.CharField(max_length=100, null=True, blank=True)

    est_archive = models.BooleanField(default=False, db_column='estArchive')

    date_archivage = models.DateTimeField(null=True, blank=True, db_column='dateArchivage')

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')

    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')

    chunking_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'En attente'),
            ('completed', 'Terminé'),
            ('failed', 'Échoué'),
        ],
        default='pending',
        db_column='chunkingStatus'
    )

    chunking_error = models.TextField(null=True, blank=True, db_column='chunkingError')

    file_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    is_deleted = models.BooleanField(default=False, db_index=True)

    deleted_at = models.DateTimeField(null=True, blank=True)

    deleted_by = models.ForeignKey(
        'Utilisateur', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='documents_supprimes'
    )

    class Meta:

        db_table = 'documents'

        verbose_name = 'Document'

        verbose_name_plural = 'Documents'

        ordering = ['-cree_le']

        indexes = [

            models.Index(fields=['risque']),

            models.Index(fields=['auteur']),

            models.Index(fields=['categorie']),

            models.Index(fields=['cree_le']),

            models.Index(fields=['type_courrier']),

            models.Index(fields=['est_archive']),

            models.Index(fields=['date_document']),

        ]

    

    def __str__(self):

        return self.titre





class DocumentChunk(models.Model):

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks')

    ordre = models.IntegerField()

    page = models.IntegerField(null=True, blank=True)

    texte = models.TextField()

    client_nom = models.CharField(max_length=255, null=True, blank=True)

    exercice_annee = models.IntegerField(null=True, blank=True)

    risque_type = models.CharField(max_length=255, null=True, blank=True)

    type_courrier = models.CharField(max_length=30, null=True, blank=True)

    reference = models.CharField(max_length=100, null=True, blank=True)

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')

    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')



    class Meta:

        db_table = 'document_chunks'

        verbose_name = 'Chunk de document'

        verbose_name_plural = 'Chunks de document'

        ordering = ['document', 'ordre']

        indexes = [

            models.Index(fields=['document', 'ordre']),

            models.Index(fields=['exercice_annee']),

            models.Index(fields=['risque_type']),

        ]



    def __str__(self):

        return f"Chunk {self.ordre} de {self.document_id}"





class AssistantConversation(models.Model):

    """Conversation sauvegardée de l'assistant IA pour un utilisateur."""



    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    utilisateur = models.ForeignKey(Utilisateur, on_delete=models.CASCADE, related_name='assistant_conversations')

    titre = models.CharField(max_length=255, blank=True)

    memoire_resume = models.TextField(blank=True, default='')

    memoire_etat = models.JSONField(default=dict, blank=True)

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')

    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')

    dernier_message_le = models.DateTimeField(null=True, blank=True)

    nombre_messages = models.IntegerField(default=0)



    class Meta:

        db_table = 'assistant_conversations'

        verbose_name = 'Conversation assistant'

        verbose_name_plural = 'Conversations assistant'

        ordering = ['-dernier_message_le', '-cree_le']



    def __str__(self):

        return self.titre or f'Conversation {self.id}'





class AssistantMessage(models.Model):

    """Message d'une conversation de l'assistant IA."""



    ROLE_CHOICES = [

        ('USER', 'Utilisateur'),

        ('ASSISTANT', 'Assistant'),

    ]



    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    conversation = models.ForeignKey(AssistantConversation, on_delete=models.CASCADE, related_name='messages')

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    contenu = models.TextField()

    metadata = models.JSONField(default=dict, blank=True)

    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')



    class Meta:

        db_table = 'assistant_messages'

        verbose_name = 'Message assistant'

        verbose_name_plural = 'Messages assistant'

        ordering = ['cree_le']

        indexes = [

            models.Index(fields=['conversation', 'cree_le']),

        ]



    def __str__(self):

        return f'[{self.role}] {self.contenu[:50]}'





class LlmMonthlyQuota(models.Model):

    """Compteur mensuel de tokens LLM par utilisateur.



    Permet de savoir rapidement si un utilisateur a dépassé son quota du mois

    sans recalcul à partir de l'historique complet.

    """



    utilisateur = models.ForeignKey(

        Utilisateur,

        on_delete=models.CASCADE,

        related_name='llm_quotas',

    )

    year_month = models.CharField(max_length=7)  # 'YYYY-MM'

    tokens_used = models.PositiveIntegerField(default=0)

    limit = models.PositiveIntegerField(default=30000)



    class Meta:

        db_table = 'llm_monthly_quotas'

        verbose_name = 'Quota LLM mensuel'

        verbose_name_plural = 'Quotas LLM mensuels'

        unique_together = [['utilisateur', 'year_month']]

        ordering = ['-year_month']



    def __str__(self) -> str:  # pragma: no cover - représentation simple

        return f"{self.utilisateur_id} {self.year_month}: {self.tokens_used}/{self.limit}"





class LlmUsage(models.Model):

    """Journal détaillé des appels LLM par utilisateur.



    Sert pour l'audit, les statistiques d'usage et le recalage éventuel des comptes.

    """



    PURPOSE_CHOICES = [

        ('router', 'Router'),

        ('answer', 'Answer'),

        ('summary', 'Summary'),

    ]



    utilisateur = models.ForeignKey(

        Utilisateur,

        on_delete=models.CASCADE,

        related_name='llm_usages',

    )

    timestamp = models.DateTimeField()

    provider = models.CharField(max_length=50)

    model = models.CharField(max_length=100)

    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)

    tokens_input = models.PositiveIntegerField(default=0)

    tokens_output = models.PositiveIntegerField(default=0)

    tokens_total = models.PositiveIntegerField()



    class Meta:

        db_table = 'llm_usage'

        verbose_name = "Usage LLM"

        verbose_name_plural = "Usages LLM"

        ordering = ['-timestamp']



    def __str__(self) -> str:  # pragma: no cover - représentation simple

        return f"{self.utilisateur_id} {self.purpose} {self.tokens_total} @ {self.timestamp}"





class AuditLog(models.Model):

    """Journal d'audit pour tracer les actions importantes.

    

    Enregistre toutes les actions sur les documents et données sensibles.

    """

    

    ACTION_CHOICES = [

        ('CREATE', 'Création'),

        ('READ', 'Consultation'),

        ('UPDATE', 'Modification'),

        ('DELETE', 'Suppression'),

        ('DOWNLOAD', 'Téléchargement'),

        ('PRINT', 'Impression'),

        ('EXPORT', 'Export'),

        ('LOGIN', 'Connexion'),

        ('LOGOUT', 'Déconnexion'),

        ('SEARCH', 'Recherche'),

        ('ACCESS_DENIED', 'Accès refusé'),

    ]

    

    RESOURCE_CHOICES = [

        ('document', 'Document'),

        ('client', 'Client'),

        ('exercice', 'Exercice'),

        ('risque', 'Risque'),

        ('utilisateur', 'Utilisateur'),

        ('categorie', 'Catégorie'),

        ('session', 'Session'),

        ('assistant', 'Assistant IA'),

    ]

    

    id = models.BigAutoField(primary_key=True)

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    

    # Qui a fait l'action

    utilisateur = models.ForeignKey(

        Utilisateur,

        on_delete=models.SET_NULL,

        null=True,

        blank=True,

        related_name='audit_logs',

    )

    utilisateur_nom = models.CharField(max_length=255, blank=True)  # Copie pour historique

    

    # Quelle action

    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)

    

    # Sur quelle ressource

    resource_type = models.CharField(max_length=50, choices=RESOURCE_CHOICES, db_index=True)

    resource_id = models.CharField(max_length=100, blank=True)

    resource_name = models.CharField(max_length=500, blank=True)  # Titre/nom pour lisibilité

    

    # Détails

    details = models.JSONField(default=dict, blank=True)  # Données avant/après, etc.

    ip_address = models.GenericIPAddressField(null=True, blank=True)

    user_agent = models.TextField(blank=True)

    

    # Résultat

    success = models.BooleanField(default=True)

    error_message = models.TextField(blank=True)

    

    class Meta:

        db_table = 'audit_logs'

        verbose_name = "Journal d'audit"

        verbose_name_plural = "Journaux d'audit"

        ordering = ['-timestamp']

        indexes = [

            models.Index(fields=['timestamp', 'action']),

            models.Index(fields=['resource_type', 'resource_id']),

            models.Index(fields=['utilisateur', 'timestamp']),

        ]

    

    def __str__(self) -> str:

        return f"{self.timestamp} - {self.utilisateur_nom} - {self.action} - {self.resource_type}"

    

    @classmethod

    def log(

        cls,

        action: str,

        resource_type: str,

        resource_id: str = '',

        resource_name: str = '',

        utilisateur=None,

        details: dict = None,

        ip_address: str = None,

        user_agent: str = '',

        success: bool = True,

        error_message: str = '',

    ):

        """Méthode helper pour créer une entrée d'audit."""

        return cls.objects.create(

            utilisateur=utilisateur,

            utilisateur_nom=str(utilisateur) if utilisateur else 'Anonyme',

            action=action,

            resource_type=resource_type,

            resource_id=str(resource_id),

            resource_name=resource_name[:500] if resource_name else '',

            details=details or {},

            ip_address=ip_address,

            user_agent=user_agent[:1000] if user_agent else '',

            success=success,

            error_message=error_message,

        )



