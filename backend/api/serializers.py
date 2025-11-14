"""
Serializers pour l'API Django REST Framework
"""
from urllib.parse import urljoin

from django.conf import settings
from django.core.files.storage import default_storage
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import (
    Utilisateur, Client, Exercice, Risque, 
    Categorie, Document
)


class UtilisateurSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Utilisateur"""
    
    mot_de_passe = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
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


class LoginSerializer(serializers.Serializer):
    """Serializer pour la connexion"""
    
    nom_utilisateur = serializers.CharField(required=True)
    mot_de_passe = serializers.CharField(required=True, write_only=True, style={'input_type': 'password'})


class ClientSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Client"""
    exercices = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['id', 'cree_le', 'modifie_le']

    def get_exercices(self, obj):
        exercices = obj.exercices.all().order_by('-annee')
        return ExerciceSerializer(exercices, many=True, context=self.context).data


class ExerciceSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Exercice"""
    
    client_nom = serializers.CharField(source='client.nom', read_only=True)
    risques = serializers.SerializerMethodField()
    
    class Meta:
        model = Exercice
        fields = '__all__'
        read_only_fields = ['id', 'cree_le', 'modifie_le']

    def get_risques(self, obj):
        risques = obj.risques.all().order_by('type')
        return RisqueSerializer(risques, many=True, context=self.context).data


class RisqueSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Risque"""
    
    exercice_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Risque
        fields = '__all__'
        read_only_fields = ['id', 'cree_le', 'modifie_le']
    
    def get_exercice_info(self, obj):
        return {
            'annee': obj.exercice.annee,
            'client': obj.exercice.client.nom
        }


class CategorieSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Catégorie"""
    
    class Meta:
        model = Categorie
        fields = '__all__'
        read_only_fields = ['id', 'cree_le', 'modifie_le']


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Document"""
    
    auteur_nom = serializers.CharField(source='auteur.get_full_name', read_only=True)
    categorie_nom = serializers.CharField(source='categorie.nom', read_only=True, allow_null=True)
    risque_detail = RisqueSerializer(source='risque', read_only=True)
    fichier_url = serializers.SerializerMethodField()

    def get_fichier_url(self, obj):
        if not obj.chemin_fichier:
            return None

        try:
            relative_url = default_storage.url(obj.chemin_fichier)
        except Exception:
            relative_url = obj.chemin_fichier

        if relative_url.startswith(('http://', 'https://')):
            return relative_url

        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(relative_url)

        media_url = settings.MEDIA_URL
        if not media_url.endswith('/'):
            media_url = f'{media_url}/'
        return urljoin(media_url, obj.chemin_fichier.lstrip('/'))

    class Meta:
        model = Document
        fields = '__all__'
        read_only_fields = ['id', 'cree_le', 'modifie_le']
