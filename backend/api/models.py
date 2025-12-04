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
            user.mot_de_passe_legacy = password or ""
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
    
    id = models.CharField(primary_key=True, max_length=50, default=uuid.uuid4, editable=False)
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
    
    id = models.CharField(primary_key=True, max_length=50, default=uuid.uuid4, editable=False)
    nom = models.CharField(max_length=255, unique=True)
    numero_client = models.CharField(max_length=100, unique=True, null=True, blank=True, db_column='numeroClient')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='ENTREPRISE')
    email = models.EmailField(null=True, blank=True)
    telephone = models.CharField(max_length=50, null=True, blank=True)
    adresse = models.TextField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True, db_column='creeLe')
    modifie_le = models.DateTimeField(auto_now=True, db_column='modifieLe')
    
    class Meta:
        db_table = 'clients'
        verbose_name = 'Client'
        verbose_name_plural = 'Clients'
        ordering = ['nom']
    
    def __str__(self):
        return self.nom


class Exercice(models.Model):
    """Modèle Exercice (année fiscale)"""
    
    STATUT_CHOICES = [
        ('ACTIF', 'Actif'),
        ('ARCHIVE', 'Archivé'),
        ('CLOTURE', 'Clôturé'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
    
    id = models.CharField(primary_key=True, max_length=50, default=uuid.uuid4, editable=False)
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
    
    id = models.CharField(primary_key=True, max_length=50, default=uuid.uuid4, editable=False)
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
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
        ]
    
    def __str__(self):
        return self.titre
