"""
Vues pour l'API Django REST Framework
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db.models import Q
from django.core.files.storage import default_storage
import mimetypes
import uuid

from .models import (
    Utilisateur, Client, Exercice, Risque,
    Categorie, Document
)
from .serializers import (
    UtilisateurSerializer, UtilisateurListSerializer, LoginSerializer,
    ClientSerializer, ExerciceSerializer, RisqueSerializer,
    CategorieSerializer, DocumentSerializer
)
from .permissions import RoleBasedPermission, IsOwnerOrAdmin


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Vue de connexion - retourne un token JWT
    """
    serializer = LoginSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(
            {'erreur': 'Nom d\'utilisateur et mot de passe requis'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    nom_utilisateur = serializer.validated_data['nom_utilisateur']
    mot_de_passe = serializer.validated_data['mot_de_passe']
    
    try:
        utilisateur = Utilisateur.objects.get(nom_utilisateur=nom_utilisateur)
        
        if not utilisateur.est_actif:
            return Response(
                {'erreur': 'Identifiants incorrects'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not utilisateur.check_password(mot_de_passe):
            return Response(
                {'erreur': 'Identifiants incorrects'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Mettre à jour la dernière connexion
        utilisateur.derniere_connexion = timezone.now()
        utilisateur.save(update_fields=['derniere_connexion'])
        
        # Générer les tokens JWT
        refresh = RefreshToken.for_user(utilisateur)
        
        # Données de session
        session_data = {
            'id': str(utilisateur.id),
            'nomUtilisateur': utilisateur.nom_utilisateur,
            'nom': utilisateur.nom,
            'prenom': utilisateur.prenom,
            'email': utilisateur.email,
            'role': utilisateur.role
        }
        
        return Response({
            'success': True,
            'token': str(refresh.access_token),
            'refresh': str(refresh),
            'utilisateur': session_data
        }, status=status.HTTP_200_OK)
        
    except Utilisateur.DoesNotExist:
        return Response(
            {'erreur': 'Identifiants incorrects'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    except Exception as e:
        return Response(
            {'erreur': 'Erreur serveur'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class UtilisateurViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les utilisateurs
    """
    queryset = Utilisateur.objects.all()
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'utilisateurs'
    
    def get_serializer_class(self):
        """Utiliser un serializer différent pour la liste"""
        if self.action == 'list':
            return UtilisateurListSerializer
        return UtilisateurSerializer
    
    def get_queryset(self):
        """Filtrer les utilisateurs selon les paramètres"""
        queryset = Utilisateur.objects.all().order_by('prenom', 'nom')
        
        # Filtrer par rôle
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role)
        
        # Filtrer par statut actif
        est_actif = self.request.query_params.get('est_actif', None)
        if est_actif is not None:
            queryset = queryset.filter(est_actif=est_actif.lower() == 'true')
        
        # Recherche
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(nom__icontains=search) |
                Q(prenom__icontains=search) |
                Q(nom_utilisateur__icontains=search) |
                Q(email__icontains=search)
            )
        
        return queryset

    def create(self, request, *args, **kwargs):
        """Créer un utilisateur et logger l'activité"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()

        return Response({
            'success': True,
            'message': 'Utilisateur créé avec succès',
            'utilisateur': UtilisateurListSerializer(utilisateur).data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Mettre à jour un utilisateur et logger l'activité"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()

        return Response({
            'success': True,
            'message': 'Profil mis à jour avec succès',
            'utilisateur': UtilisateurListSerializer(utilisateur).data
        })
    
    def destroy(self, request, *args, **kwargs):
        """Supprimer un utilisateur (soft delete recommandé)"""
        instance = self.get_object()
        
        # Plutôt que de supprimer, on désactive
        instance.est_actif = False
        instance.save()

        return Response({
            'success': True,
            'message': 'Utilisateur désactivé avec succès'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='change-password')
    def change_password(self, request, pk=None):
        """Modifier le mot de passe d'un utilisateur"""
        utilisateur = self.get_object()

        # Autoriser uniquement l'utilisateur concerné ou un administrateur
        if request.user.role != 'ADMIN' and str(request.user.id) != str(utilisateur.id):
            return Response({'erreur': "Vous n'avez pas la permission de modifier ce mot de passe."}, status=status.HTTP_403_FORBIDDEN)

        ancien_mdp = request.data.get('ancien_mot_de_passe') or request.data.get('ancienMotDePasse')
        nouveau_mdp = request.data.get('nouveau_mot_de_passe') or request.data.get('nouveauMotDePasse')

        if not ancien_mdp or not nouveau_mdp:
            return Response({'erreur': "Merci de fournir l'ancien et le nouveau mot de passe."}, status=status.HTTP_400_BAD_REQUEST)

        if not utilisateur.check_password(ancien_mdp):
            return Response({'erreur': 'Le mot de passe actuel est incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(nouveau_mdp) < 8:
            return Response({'erreur': 'Le nouveau mot de passe doit contenir au moins 8 caractères.'}, status=status.HTTP_400_BAD_REQUEST)

        utilisateur.set_password(nouveau_mdp)
        utilisateur.save(update_fields=['password'])

        return Response({'success': True, 'message': 'Mot de passe modifié avec succès.'}, status=status.HTTP_200_OK)


class ClientViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les clients"""
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'  # Les clients font partie de la gestion documentaire


class ExerciceViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les exercices"""
    queryset = Exercice.objects.all()
    serializer_class = ExerciceSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'


class RisqueViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les risques"""
    queryset = Risque.objects.all()
    serializer_class = RisqueSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'


class CategorieViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les catégories"""
    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'categories'


class DocumentViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les documents"""
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'
    
    def get_queryset(self):
        """Filtrer les documents selon les paramètres"""
        queryset = Document.objects.all().order_by('-cree_le')
        
        # Filtrer par risque
        risque_id = self.request.query_params.get('risque', None)
        if risque_id:
            queryset = queryset.filter(risque_id=risque_id)
        
        # Filtrer par catégorie
        categorie_id = self.request.query_params.get('categorie', None)
        if categorie_id:
            queryset = queryset.filter(categorie_id=categorie_id)
        
        # Filtrer par auteur
        auteur_id = self.request.query_params.get('auteur', None)
        if auteur_id:
            queryset = queryset.filter(auteur_id=auteur_id)
        
        # Filtrer par statut archivé
        est_archive = self.request.query_params.get('est_archive', None)
        if est_archive is not None:
            queryset = queryset.filter(est_archive=est_archive.lower() == 'true')
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Créer un document et logger l'activité"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DocumentUploadView(APIView):
    """Téléverser un document avec fichier"""

    permission_classes = [IsAuthenticated, RoleBasedPermission]
    parser_classes = (MultiPartParser, FormParser)
    ressource = 'documents'

    def post(self, request, *args, **kwargs):
        fichier = request.FILES.get('file')
        titre = (request.data.get('titre') or '').strip()
        description = (request.data.get('description') or '').strip() or None
        risque_id = request.data.get('risque_id') or request.data.get('risqueId')
        type_courrier = request.data.get('type_courrier') or request.data.get('typeCourrier')
        reference = (request.data.get('reference') or '').strip() or None
        categorie_id = request.data.get('categorie_id') or request.data.get('categorieId') or None
        date_document = request.data.get('date_document') or request.data.get('dateDocument') or None

        if not fichier or not titre or not risque_id or not type_courrier:
            return Response(
                {'erreur': 'Le fichier, le titre, le risque et le type de courrier sont obligatoires.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        extension = mimetypes.guess_extension(fichier.content_type or '') or ''
        nom_fichier = f"documents/{uuid.uuid4()}{extension}"
        chemin = default_storage.save(nom_fichier, fichier)

        try:
            document = Document.objects.create(
                titre=titre,
                description=description,
                chemin_fichier=chemin,
                type_fichier=fichier.content_type or mimetypes.guess_type(fichier.name)[0] or 'application/octet-stream',
                taille_fichier=fichier.size,
                type_courrier=type_courrier,
                risque_id=risque_id,
                auteur=request.user,
                categorie_id=categorie_id,
                reference=reference,
                date_document=date_document
            )
        except Exception:
            default_storage.delete(chemin)
            return Response({'erreur': 'Erreur lors de la création du document.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = DocumentSerializer(document, context={'request': request})
        return Response({
            'success': True,
            'message': 'Document téléversé avec succès',
            'document': serializer.data
        }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def stats_view(request):
    """Statistiques synthétiques pour le tableau de bord"""
    total_documents = Document.objects.count()
    uploads_today = Document.objects.filter(cree_le__date=timezone.now().date()).count()
    total_clients = Client.objects.count()
    total_categories = Categorie.objects.count()

    return Response({
        'documents': total_documents,
        'uploadsAujourdhui': uploads_today,
        'clients': total_clients,
        'categories': total_categories
    })


setattr(stats_view, 'ressource', 'stats')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def document_search_view(request):
    """Recherche simplifiée de documents"""
    terme = (request.query_params.get('q') or '').strip()
    limite = int(request.query_params.get('limit') or 10)

    if not terme:
        return Response({'resultats': []})

    documents = Document.objects.select_related('risque__exercice__client').filter(
        Q(titre__icontains=terme) |
        Q(reference__icontains=terme) |
        Q(risque__exercice__client__nom__icontains=terme)
    ).order_by('-cree_le')[:limite]

    resultats = []
    for doc in documents:
        client_nom = doc.risque.exercice.client.nom if doc.risque and doc.risque.exercice else 'Client inconnu'
        resultats.append({
            'id': str(doc.id),
            'titre': doc.titre,
            'reference': doc.reference,
            'client': client_nom,
            'risque': doc.risque.type if doc.risque else None,
            'creeLe': doc.cree_le.isoformat() if doc.cree_le else None
        })

    return Response({'resultats': resultats})


setattr(document_search_view, 'ressource', 'documents')
