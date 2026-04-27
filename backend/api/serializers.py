"""
Serializers pour l'API Django REST Framework
"""
from urllib.parse import urljoin, urlparse

from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework import serializers

from .models import (
    Utilisateur, Client, Exercice, Risque, 
    Document, AssistantConversation, AssistantMessage
)


class UtilisateurSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Utilisateur"""
    
    mot_de_passe = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Lors d'une mise à jour, le champ mot_de_passe devient optionnel
        if self.instance is not None:
            self.fields['mot_de_passe'].required = False

    class Meta:
        model = Utilisateur
        fields = [
            'id', 'nom_utilisateur', 'nom', 'prenom', 'email',
            'role', 'est_actif', 'date_creation', 'date_modification',
            'derniere_connexion', 'mot_de_passe'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification', 'derniere_connexion']
        extra_kwargs = {
            'mot_de_passe': {'write_only': True}
        }
    
    def validate_nom_utilisateur(self, value):
        """Valider l'unicité du nom d'utilisateur"""
        if self.instance is None:  # Création
            if Utilisateur.objects.filter(nom_utilisateur=value).exists():
                raise serializers.ValidationError("Ce nom d'utilisateur est déjà utilisé.")
        else:  # Modification
            if Utilisateur.objects.filter(nom_utilisateur=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("Ce nom d'utilisateur est déjà utilisé.")
        return value
    
    def validate_email(self, value):
        """Valider l'unicité de l'email si fourni"""
        if value:
            if self.instance is None:  # Création
                if Utilisateur.objects.filter(email=value).exists():
                    raise serializers.ValidationError("Cet email est déjà utilisé.")
            else:  # Modification
                if Utilisateur.objects.filter(email=value).exclude(id=self.instance.id).exists():
                    raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value
    
    def validate_role(self, value):
        """Valider que le rôle est autorisé"""
        roles_autorises = ['ADMIN', 'ARCHIVISTE', 'CONSULTANT']
        if value not in roles_autorises:
            raise serializers.ValidationError("Rôle utilisateur invalide.")
        return value
    
    def create(self, validated_data):
        """Créer un nouvel utilisateur avec mot de passe hashé"""
        mot_de_passe = validated_data.pop('mot_de_passe')
        utilisateur = Utilisateur.objects.create_user(
            password=mot_de_passe,
            **validated_data
        )
        return utilisateur
    
    def update(self, instance, validated_data):
        """Mettre à jour un utilisateur"""
        mot_de_passe = validated_data.pop('mot_de_passe', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if mot_de_passe:
            instance.set_password(mot_de_passe)
        
        instance.save()
        return instance


class UtilisateurListSerializer(serializers.ModelSerializer):
    """Serializer simplifié pour la liste des utilisateurs"""
    
    class Meta:
        model = Utilisateur
        fields = [
            'id', 'nom_utilisateur', 'nom', 'prenom', 'email',
            'role', 'est_actif', 'derniere_connexion'
        ]


class ClientBaseSerializer(serializers.ModelSerializer):
    entreprise = serializers.PrimaryKeyRelatedField(
        source='entreprise_parente',
        queryset=Client.objects.all(),
        allow_null=True,
        required=False,
    )
    entreprise_nom = serializers.CharField(source='entreprise_parente.nom', read_only=True)
    nombre_personnes_rattachees = serializers.SerializerMethodField()

    def get_nombre_personnes_rattachees(self, obj):
        if obj.type != 'ENTREPRISE':
            return 0
        return obj.membres.count()


class ClientSimpleSerializer(ClientBaseSerializer):
    """Version légère du serializer Client (sans exercices imbriqués explicites)."""

    class Meta:
        model = Client
        fields = [
            'id', 'nom', 'numero_client', 'type', 'email', 'telephone',
            'adresse', 'entreprise', 'entreprise_nom', 'entreprise_parente',
            'nombre_personnes_rattachees', 'cree_le', 'modifie_le'
        ]
        read_only_fields = ['id', 'cree_le', 'modifie_le']


class ClientSerializer(ClientBaseSerializer):
    """Serializer pour le modèle Client, avec exercices imbriqués."""
    exercices = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id', 'nom', 'numero_client', 'type', 'email', 'telephone',
            'adresse', 'entreprise', 'entreprise_nom', 'entreprise_parente',
            'nombre_personnes_rattachees', 'exercices', 'cree_le', 'modifie_le'
        ]
        read_only_fields = ['id', 'cree_le', 'modifie_le']

    def get_exercices(self, obj):
        if getattr(obj, 'type', None) == 'ENTREPRISE' and hasattr(obj, 'tous_les_exercices'):
            exercices_qs = obj.tous_les_exercices.order_by('-annee')
        else:
            exercices_qs = obj.exercices.all().order_by('-annee')
        return ExerciceSerializer(exercices_qs, many=True, context=self.context).data


class ExerciceSimpleSerializer(serializers.ModelSerializer):
    """Version légère du serializer Exercice (sans risques imbriqués)."""

    client_nom = serializers.CharField(source='client.nom', read_only=True)

    class Meta:
        model = Exercice
        fields = [
            'id', 'annee', 'client', 'client_nom', 'statut',
            'cree_le', 'modifie_le'
        ]
        read_only_fields = ['id', 'cree_le', 'modifie_le']


class ExerciceSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Exercice, avec risques imbriqués."""
    
    client_nom = serializers.CharField(source='client.nom', read_only=True)
    risques = serializers.SerializerMethodField()
    
    class Meta:
        model = Exercice
        fields = [
            'id', 'annee', 'client', 'client_nom', 'statut',
            'risques', 'cree_le', 'modifie_le'
        ]
        read_only_fields = ['id', 'cree_le', 'modifie_le']

    def validate_annee(self, value):
        """Valider que l'année est raisonnable (à partir de 1900)"""
        if value < 1900:
            raise serializers.ValidationError("L'année doit être supérieure à 1900.")
        if value > 2100:
            raise serializers.ValidationError("L'année ne peut pas dépasser 2100.")
        return value

    def get_risques(self, obj):
        risques = obj.risques.all().order_by('type')
        return RisqueSerializer(risques, many=True, context=self.context).data


class RisqueSimpleSerializer(serializers.ModelSerializer):
    """Version légère du serializer Risque (id + type uniquement)."""

    class Meta:
        model = Risque
        fields = ['id', 'type']
        read_only_fields = ['id']


class RisqueSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Risque"""
    
    exercice_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Risque
        fields = [
            'id', 'type', 'numero_police', 'exercice', 'exercice_info',
            'cree_le', 'modifie_le'
        ]
        read_only_fields = ['id', 'cree_le', 'modifie_le']
    
    def validate_type(self, value):
        """Normalise le type de risque : strip + title case pour éviter les doublons."""
        return ' '.join(value.strip().split()).title()

    def get_exercice_info(self, obj):
        return {
            'annee': obj.exercice.annee,
            'client': obj.exercice.client.nom
        }


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Document"""
    
    auteur_nom = serializers.CharField(source='auteur.get_full_name', read_only=True)
    risque_detail = RisqueSerializer(source='risque', read_only=True)
    fichier_url = serializers.SerializerMethodField()

    def get_fichier_url(self, obj):
        if not obj.chemin_fichier:
            return None

        try:
            chemin = default_storage.url(obj.chemin_fichier)
        except Exception:
            chemin = str(obj.chemin_fichier)

        if chemin.startswith(('http://', 'https://')):
            parsed = urlparse(chemin)
            chemin = parsed.path or chemin

        if not chemin.startswith('/'):
            chemin = f'/{chemin}'

        media_prefix = settings.MEDIA_URL or '/media/'
        if not media_prefix.startswith('/'):
            media_prefix = f'/{media_prefix}'
        if not media_prefix.endswith('/'):
            media_prefix = f'{media_prefix}/'

        if chemin.startswith('/media/'):
            return chemin

        cleaned = chemin.lstrip('/')
        return f"{media_prefix}{cleaned}" if media_prefix.endswith('/') else f"{media_prefix}/{cleaned}"

    class Meta:
        model = Document
        fields = [
            'id', 'titre', 'description', 'chemin_fichier', 'type_fichier',
            'taille_fichier', 'type_courrier', 'risque', 'risque_detail',
            'auteur', 'auteur_nom', 'categorie', 'date_document', 'reference',
            'est_archive', 'date_archivage', 'fichier_url', 'cree_le', 'modifie_le'
        ]
        read_only_fields = ['id', 'cree_le', 'modifie_le']


class AssistantConversationSerializer(serializers.ModelSerializer):
    """Serializer pour les conversations de l'assistant IA"""

    nombre_messages = serializers.IntegerField(read_only=True)
    dernier_message_le = serializers.DateTimeField(read_only=True)

    class Meta:
        model = AssistantConversation
        fields = [
            'id', 'utilisateur', 'titre', 'memoire_resume', 'memoire_etat',
            'nombre_messages', 'dernier_message_le', 'cree_le', 'modifie_le'
        ]
        read_only_fields = ['id', 'utilisateur', 'cree_le', 'modifie_le', 'dernier_message_le', 'nombre_messages']


class AssistantMessageSerializer(serializers.ModelSerializer):
    """Serializer pour les messages de l'assistant IA"""

    class Meta:
        model = AssistantMessage
        fields = [
            'id', 'conversation', 'role', 'contenu', 'metadata', 'cree_le'
        ]
        read_only_fields = ['id', 'cree_le']
