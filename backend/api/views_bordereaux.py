"""
Vues pour la gestion des Bordereaux
"""
import hashlib
import logging
import mimetypes
import uuid

from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Q

from .models import Bordereau, Client
from .permissions import RoleBasedPermission
from .serializers import BordereauSerializer


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Clients-Compagnies (clients de type ENTREPRISE)
# ---------------------------------------------------------------------------

class CompagnieListView(APIView):
    """Lister les clients de type ENTREPRISE (utilisés comme compagnies dans les bordereaux)."""

    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'

    def get(self, request):
        compagnies = Client.objects.filter(type='ENTREPRISE').order_by('nom')
        data = [{'id': c.id, 'nom': c.nom, 'numero_client': c.numero_client} for c in compagnies]
        return Response(data)


# ---------------------------------------------------------------------------
# Bordereaux
# ---------------------------------------------------------------------------

ALLOWED_MIME_TYPES = {
    'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
    'image/gif', 'image/webp', 'image/tiff',
}


class BordereauListView(APIView):
    """Lister les bordereaux avec filtres optionnels."""

    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'

    def get(self, request):
        qs = Bordereau.objects.filter(is_deleted=False).select_related('compagnie', 'auteur')

        compagnie_id = request.query_params.get('compagnie')
        if compagnie_id:
            qs = qs.filter(compagnie_id=compagnie_id)

        annee = request.query_params.get('annee')
        if annee:
            qs = qs.filter(annee=annee)

        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(titre__icontains=q)
                | Q(reference__icontains=q)
                | Q(compagnie__nom__icontains=q)
            ).distinct()

        count = qs.count()

        try:
            page = max(1, int(request.query_params.get('page', 1)))
            page_size = min(100, max(1, int(request.query_params.get('page_size', 20))))
        except (ValueError, TypeError):
            page, page_size = 1, 20

        offset = (page - 1) * page_size
        qs_page = qs[offset:offset + page_size]

        serializer = BordereauSerializer(qs_page, many=True)
        return Response({
            'results': serializer.data,
            'count': count,
            'page': page,
            'page_size': page_size,
            'num_pages': max(1, (count + page_size - 1) // page_size),
        })


class BordereauUploadView(APIView):
    """Téléverser un bordereau."""

    permission_classes = [IsAuthenticated, RoleBasedPermission]
    parser_classes = (MultiPartParser, FormParser)
    ressource = 'documents'

    def post(self, request):
        fichier = request.FILES.get('file')
        titre = (request.data.get('titre') or '').strip()
        reference = (request.data.get('reference') or '').strip() or None
        annee_raw = request.data.get('annee')
        compagnie_id = request.data.get('compagnie_id') or request.data.get('compagnieId')

        if not fichier or not titre or not annee_raw or not compagnie_id:
            return Response(
                {'erreur': 'Le fichier, le titre, l\'année et la compagnie sont obligatoires.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            annee = int(annee_raw)
        except (ValueError, TypeError):
            return Response({'erreur': 'L\'année doit être un entier.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            compagnie = Client.objects.get(pk=compagnie_id, type='ENTREPRISE')
        except Client.DoesNotExist:
            return Response({'erreur': 'Compagnie (client entreprise) introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        fichier_mime = (fichier.content_type or '').split(';')[0].strip().lower()
        if fichier_mime not in ALLOWED_MIME_TYPES:
            return Response(
                {'erreur': f'Type de fichier non autorisé : {fichier_mime}. Formats acceptés : PDF, JPEG, PNG, GIF, WEBP, TIFF.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Hash SHA-256 pour dédoublonnage
        sha256 = hashlib.sha256()
        for chunk in fichier.chunks():
            sha256.update(chunk)
        file_hash = sha256.hexdigest()
        fichier.seek(0)

        extension = mimetypes.guess_extension(fichier.content_type or '') or ''
        nom_fichier = f"bordereaux/{uuid.uuid4()}{extension}"
        chemin = default_storage.save(nom_fichier, fichier)

        try:
            bordereau = Bordereau.objects.create(
                titre=titre,
                reference=reference,
                annee=annee,
                compagnie=compagnie,
                chemin_fichier=chemin,
                type_fichier=fichier.content_type or mimetypes.guess_type(fichier.name)[0] or 'application/octet-stream',
                taille_fichier=fichier.size,
                file_hash=file_hash,
                auteur=request.user,
            )
        except Exception:
            logger.exception("Erreur lors de la création du bordereau")
            default_storage.delete(chemin)
            raise

        serializer = BordereauSerializer(bordereau)
        return Response(
            {'success': True, 'message': 'Bordereau téléversé avec succès.', 'bordereau': serializer.data},
            status=status.HTTP_201_CREATED,
        )


class BordereauDetailView(APIView):
    """Détail + modification + suppression d'un bordereau."""

    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'

    def _get(self, bordereau_id):
        try:
            return Bordereau.objects.get(pk=bordereau_id, is_deleted=False)
        except Bordereau.DoesNotExist:
            return None

    def get(self, request, bordereau_id):
        obj = self._get(bordereau_id)
        if not obj:
            return Response({'erreur': 'Bordereau introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(BordereauSerializer(obj).data)

    def patch(self, request, bordereau_id):
        if getattr(request.user, 'role', None) not in ('ADMIN', 'ARCHIVISTE'):
            return Response({'erreur': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get(bordereau_id)
        if not obj:
            return Response({'erreur': 'Bordereau introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        champs_modifies = []

        titre = (request.data.get('titre') or '').strip()
        if titre:
            obj.titre = titre
            champs_modifies.append('titre')

        reference = request.data.get('reference')
        if reference is not None:
            obj.reference = reference.strip() or None
            champs_modifies.append('reference')

        annee_raw = request.data.get('annee')
        if annee_raw is not None:
            try:
                obj.annee = int(annee_raw)
                champs_modifies.append('annee')
            except (ValueError, TypeError):
                return Response({'erreur': 'L\'année doit être un entier.'}, status=status.HTTP_400_BAD_REQUEST)

        compagnie_id = request.data.get('compagnie_id') or request.data.get('compagnieId')
        if compagnie_id:
            try:
                obj.compagnie = Client.objects.get(pk=compagnie_id, type='ENTREPRISE')
                champs_modifies.append('compagnie')
            except Client.DoesNotExist:
                return Response({'erreur': 'Compagnie introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        if champs_modifies:
            obj.save(update_fields=champs_modifies + ['modifie_le'])

        return Response(BordereauSerializer(obj).data)

    def delete(self, request, bordereau_id):
        if getattr(request.user, 'role', None) not in ('ADMIN', 'ARCHIVISTE'):
            return Response({'erreur': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get(bordereau_id)
        if not obj:
            return Response({'erreur': 'Bordereau introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        from django.utils import timezone
        obj.is_deleted = True
        obj.deleted_at = timezone.now()
        obj.deleted_by = request.user
        obj.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])
        return Response({'success': True}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Corbeille Bordereaux
# ---------------------------------------------------------------------------

class BordereauCorbeilleListView(APIView):
    """Lister les bordereaux supprimés (soft delete). Réservé ADMIN."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'role', None) not in ('ADMIN', 'ARCHIVISTE'):
            return Response({'erreur': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        qs = (
            Bordereau.objects
            .filter(is_deleted=True)
            .select_related('compagnie', 'auteur', 'deleted_by')
            .order_by('-deleted_at')
        )
        data = [
            {
                'id': b.id,
                'titre': b.titre,
                'reference': b.reference,
                'annee': b.annee,
                'compagnie': b.compagnie.nom if b.compagnie_id else None,
                'taille_fichier': b.taille_fichier,
                'deleted_at': b.deleted_at.isoformat() if b.deleted_at else None,
                'deleted_by': b.deleted_by.get_full_name() if b.deleted_by else None,
            }
            for b in qs
        ]
        return Response({'bordereaux': data, 'total': len(data)})


class BordereauRestoreView(APIView):
    """Restaurer un bordereau supprimé."""

    permission_classes = [IsAuthenticated]

    def post(self, request, bordereau_id):
        if getattr(request.user, 'role', None) not in ('ADMIN', 'ARCHIVISTE'):
            return Response({'erreur': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = Bordereau.objects.get(pk=bordereau_id, is_deleted=True)
        except Bordereau.DoesNotExist:
            return Response({'erreur': 'Bordereau introuvable dans la corbeille.'}, status=status.HTTP_404_NOT_FOUND)
        obj.is_deleted = False
        obj.deleted_at = None
        obj.deleted_by = None
        obj.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])
        return Response({'success': True, 'message': 'Bordereau restauré.'})


class BordereauPurgeView(APIView):
    """Suppression définitive d'un bordereau (ADMIN uniquement)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, bordereau_id):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'erreur': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = Bordereau.objects.get(pk=bordereau_id, is_deleted=True)
        except Bordereau.DoesNotExist:
            return Response({'erreur': 'Bordereau introuvable dans la corbeille.'}, status=status.HTTP_404_NOT_FOUND)
        default_storage.delete(obj.chemin_fichier)
        obj.delete()
        return Response({'success': True}, status=status.HTTP_200_OK)
