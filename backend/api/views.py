"""
Vues pour l'API Django REST Framework
"""
from rest_framework import viewsets, status, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import authenticate
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Q, Count
from django.db.models.functions import Coalesce, TruncMonth
from datetime import timedelta
from django.core.files.storage import default_storage
from django.conf import settings
import logging
import mimetypes
import uuid
import unicodedata
import re

import numpy as np
import faiss
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

try:
    # Embeddings s├®mantiques avec sentence-transformers
    from sentence_transformers import SentenceTransformer

    _SEMANTIC_MODEL = None
    _SEMANTIC_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'  # Multilingue, rapide, bon pour le fran├ºais

    def get_semantic_model():
        global _SEMANTIC_MODEL
        if _SEMANTIC_MODEL is None:
            logging.info(f"Chargement du mod├¿le s├®mantique: {_SEMANTIC_MODEL_NAME}")
            _SEMANTIC_MODEL = SentenceTransformer(_SEMANTIC_MODEL_NAME)
            logging.info("Mod├¿le s├®mantique charg├® avec succ├¿s")
        return _SEMANTIC_MODEL

    SEMANTIC_SEARCH_AVAILABLE = True
except Exception as exc:
    logging.warning(
        "sentence-transformers non disponible ou ├®chec d'initialisation (%s), recherche s├®mantique d├®sactiv├®e",
        exc,
    )
    SEMANTIC_SEARCH_AVAILABLE = False

    def get_semantic_model():
        return None

try:
    import PyPDF2
    PDF_EXTRACTION_AVAILABLE = True
except ImportError:
    logging.warning("PyPDF2 non disponible, extraction avanc├®e des PDF d├®sactiv├®e")
    PyPDF2 = None  # type: ignore[assignment]
    PDF_EXTRACTION_AVAILABLE = False

from .models import (
    Utilisateur,
    Client,
    Exercice,
    Risque,
    Document,
    DocumentChunk,
    AssistantConversation,
    AssistantMessage,
    LlmMonthlyQuota,
    LlmUsage,
)
from .serializers import (
    UtilisateurSerializer,
    UtilisateurListSerializer,
    LoginSerializer,
    ClientSimpleSerializer,
    ClientSerializer,
    ExerciceSimpleSerializer,
    ExerciceSerializer,
    RisqueSimpleSerializer,
    RisqueSerializer,
    DocumentSerializer,
    AssistantConversationSerializer,
    AssistantMessageSerializer,
)
from .permissions import RoleBasedPermission, IsOwnerOrAdmin


# ============================================================================
# GESTION DES QUOTAS LLM (BACKEND)
# ============================================================================

DEFAULT_MONTHLY_LIMIT = getattr(settings, 'ASSISTANT_LLM_MONTHLY_LIMIT', 30000)
QUOTA_DISABLED = str(getattr(settings, 'ASSISTANT_LLM_QUOTA_DISABLED', 'false')).lower() == 'true'


def _llm_year_month(dt: timezone.datetime) -> str:
    """Retourne une cl├® AAAA-MM pour le mois courant."""

    return dt.strftime('%Y-%m')


def consume_quota(utilisateur: Utilisateur, estimated_tokens: int, purpose: str, ts=None) -> dict:
    """V├®rifie et d├®cr├®mente le quota mensuel LLM pour un utilisateur.

    Retourne un dict {allowed, remaining, percentage} conform├®ment au contrat
    attendu par le front.
    """

    ts = ts or timezone.now()
    year_month = _llm_year_month(ts)

    quota, _ = LlmMonthlyQuota.objects.get_or_create(
        utilisateur=utilisateur,
        year_month=year_month,
        defaults={'limit': DEFAULT_MONTHLY_LIMIT},
    )

    if QUOTA_DISABLED:
        quota.tokens_used += estimated_tokens
        quota.save(update_fields=['tokens_used'])
        return {
            'allowed': True,
            'remaining': DEFAULT_MONTHLY_LIMIT,
            'percentage': 0.0,
        }

    if quota.tokens_used + estimated_tokens > quota.limit:
        remaining = max(0, quota.limit - quota.tokens_used)
        logging.info(
            "LLM_QUOTA_CONSUME blocked user=%s month=%s used=%s limit=%s estimated=%s remaining=%s purpose=%s",
            utilisateur.id,
            year_month,
            quota.tokens_used,
            quota.limit,
            estimated_tokens,
            remaining,
            purpose,
        )
        return {
            'allowed': False,
            'remaining': remaining,
            'percentage': quota.tokens_used / quota.limit if quota.limit else 1.0,
        }

    quota.tokens_used += estimated_tokens
    quota.save(update_fields=['tokens_used'])

    remaining = max(0, quota.limit - quota.tokens_used)
    logging.info(
        "LLM_QUOTA_CONSUME ok user=%s month=%s used=%s limit=%s estimated=%s remaining=%s purpose=%s",
        utilisateur.id,
        year_month,
        quota.tokens_used,
        quota.limit,
        estimated_tokens,
        remaining,
        purpose,
    )
    return {
        'allowed': True,
        'remaining': remaining,
        'percentage': quota.tokens_used / quota.limit if quota.limit else 0.0,
    }


def log_llm_usage(
    utilisateur: Utilisateur,
    provider: str,
    model: str,
    purpose: str,
    tokens_input: int | None,
    tokens_output: int | None,
    ts=None,
) -> None:
    """Journalise un appel LLM d├®taill├® et met ├á jour le compteur mensuel.

    Cette fonction est appel├®e en asynchrone logique c├┤t├® front, apr├¿s l'appel
    LLM, pour enregistrer les tokens r├®ellement consomm├®s.
    """

    ts = ts or timezone.now()
    ti = tokens_input or 0
    to = tokens_output or 0
    total = ti + to

    if total <= 0:
        total = 0

    usage = LlmUsage.objects.create(
        utilisateur=utilisateur,
        timestamp=ts,
        provider=provider,
        model=model,
        purpose=purpose,
        tokens_input=ti,
        tokens_output=to,
        tokens_total=total,
    )

    year_month = _llm_year_month(ts)
    quota, _ = LlmMonthlyQuota.objects.get_or_create(
        utilisateur=utilisateur,
        year_month=year_month,
        defaults={'limit': DEFAULT_MONTHLY_LIMIT},
    )
    quota.tokens_used += total
    quota.save(update_fields=['tokens_used'])

    logging.info(
        "LLM_USAGE_LOG user=%s provider=%s model=%s purpose=%s tokens_input=%s tokens_output=%s tokens_total=%s month=%s quota_used=%s quota_limit=%s",
        utilisateur.id,
        provider,
        model,
        purpose,
        ti,
        to,
        total,
        year_month,
        quota.tokens_used,
        quota.limit,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Vue de connexion - retourne un token JWT via cookies httpOnly."""
    serializer = LoginSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {'erreur': "Nom d'utilisateur et mot de passe requis"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    nom_utilisateur = serializer.validated_data['nom_utilisateur']
    mot_de_passe = serializer.validated_data['mot_de_passe']

    try:
        utilisateur = Utilisateur.objects.get(nom_utilisateur=nom_utilisateur)

        if not utilisateur.est_actif:
            return Response(
                {'erreur': 'Identifiants incorrects'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not utilisateur.check_password(mot_de_passe):
            return Response(
                {'erreur': 'Identifiants incorrects'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Mettre ├á jour la derni├¿re connexion
        utilisateur.derniere_connexion = timezone.now()
        utilisateur.save(update_fields=['derniere_connexion'])

        # G├®n├®rer les tokens JWT
        refresh = RefreshToken.for_user(utilisateur)
        access_token = refresh.access_token

        # Donn├®es de session
        session_data = {
            'id': str(utilisateur.id),
            'nomUtilisateur': utilisateur.nom_utilisateur,
            'nom': utilisateur.nom,
            'prenom': utilisateur.prenom,
            'email': utilisateur.email,
            'role': utilisateur.role,
        }

        # Construire la r├®ponse JSON sans exposer les tokens c├┤t├® client :
        # l'authentification repose d├®sormais uniquement sur les cookies httpOnly.
        response = Response(
            {
                'success': True,
                'utilisateur': session_data,
            },
            status=status.HTTP_200_OK,
        )

        # Déterminer les paramètres des cookies
        # Avec nginx comme reverse proxy, tout est sur le même domaine donc SameSite=Lax fonctionne
        secure_cookie = not settings.DEBUG
        access_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']
        refresh_lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
        samesite_policy = 'Lax'
        
        response.set_cookie(
            'access_token',
            str(access_token),
            httponly=True,
            secure=secure_cookie,
            samesite=samesite_policy,
            max_age=int(access_lifetime.total_seconds()),
        )
        response.set_cookie(
            'refresh_token',
            str(refresh),
            httponly=True,
            secure=secure_cookie,
            samesite=samesite_policy,
            max_age=int(refresh_lifetime.total_seconds()),
        )

        return response

    except Utilisateur.DoesNotExist:
        return Response(
            {'erreur': 'Identifiants incorrects'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    except Exception:
        logging.exception("Erreur lors de la tentative de connexion")
        return Response(
            {'erreur': 'Erreur serveur'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """D├®connexion : efface les cookies JWT c├┤t├® client."""
    response = Response(
        {'success': True, 'message': 'D├®connect├® avec succ├¿s.'},
        status=status.HTTP_200_OK,
    )
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def documents_search_view(request):
    """Recherche rapide de documents pour la barre globale.

    Permet de taper un m├®lange de client / exercice / risque / type de courrier /
    r├®f├®rence / titre, avec une normalisation robuste (suppression des accents,
    casse, ponctuation) pour que les combinaisons comme
    "2FZ 2022 responsabilite civile avenant" retrouvent les bons documents.
    """

    query = (request.query_params.get('q') or '').strip()
    if not query or len(query) < 2:
        return Response({'resultats': []})

    try:
        limit = int(request.query_params.get('limit') or 10)
    except (TypeError, ValueError):
        limit = 10

    norm_query = _normalize_text(query)
    if not norm_query:
        return Response({'resultats': []})

    tokens = [tok for tok in norm_query.split(' ') if tok]
    if not tokens:
        return Response({'resultats': []})

    documents = list(
        Document.objects.select_related('categorie', 'risque__exercice__client').all()
    )
    if not documents:
        return Response({'resultats': []})

    scored: list[tuple[float, dict]] = []

    for document in documents:
        payload = _build_document_payload(document, request)

        parts = [
            payload.get('titre') or '',
            payload.get('description') or '',
            payload.get('reference') or '',
            payload.get('client') or '',
            str(payload.get('exercice') or ''),
            payload.get('risque') or '',
            payload.get('type_courrier_label') or '',
        ]

        searchable = _normalize_text(' '.join(str(part) for part in parts if part))
        if not searchable:
            continue

        match_count = 0
        for token in tokens:
            if token and token in searchable:
                match_count += 1

        if match_count == 0:
            continue

        score = match_count / len(tokens)
        scored.append((score, payload))

    if not scored:
        return Response({'resultats': []})

    scored.sort(key=lambda item: item[0], reverse=True)

    results = []
    for score, payload in scored[: max(limit, 1)]:
        fichier_url = payload.get('fichier_url')
        results.append({
            'id': payload.get('id'),
            'titre': payload.get('titre'),
            'client': payload.get('client'),
            'exercice': payload.get('exercice'),
            'risque': payload.get('risque'),
            'type_courrier': payload.get('type_courrier_label'),
            'cree_le': payload.get('cree_le'),
            'fichier_url': fichier_url,
        })

    return Response({'resultats': results})


# ============================================================================
# ENDPOINTS QUOTAS LLM
# ============================================================================


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def llm_quota_consume(request):
    """V├®rifie et consomme une partie du quota LLM mensuel de l'utilisateur.

    Body attendu:
    {
      "estimated_tokens": 400,
      "purpose": "answer",
      "timestamp": "2025-12-12T16:00:00Z"  (optionnel)
    }
    """

    utilisateur = request.user
    data = request.data or {}

    try:
        estimated = int(data.get('estimated_tokens') or 0)
    except (TypeError, ValueError):
        logging.warning("LLM_QUOTA_CONSUME bad_estimated_tokens user=%s payload=%s", utilisateur.id, data)
        return Response({'detail': 'estimated_tokens invalide'}, status=status.HTTP_400_BAD_REQUEST)

    if estimated <= 0:
        logging.warning("LLM_QUOTA_CONSUME non_positive_estimated user=%s value=%s", utilisateur.id, estimated)
        return Response({'detail': 'estimated_tokens doit ├¬tre > 0'}, status=status.HTTP_400_BAD_REQUEST)

    purpose = data.get('purpose') or 'answer'
    ts_str = data.get('timestamp')
    ts = parse_datetime(ts_str) if ts_str else None

    decision = consume_quota(utilisateur, estimated, purpose, ts)
    return Response(decision, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def llm_usage_log(request):
    """Journalise un appel LLM (usage r├®el en tokens).

    Body attendu:
    {
      "provider": "mistral",
      "model": "mistral-medium-latest",
      "purpose": "answer",
      "tokens_input": 320,
      "tokens_output": 180,
      "timestamp": "2025-12-12T16:00:00Z"
    }
    """

    utilisateur = request.user
    data = request.data or {}

    provider = data.get('provider') or 'unknown'
    model = data.get('model') or 'unknown'
    purpose = data.get('purpose') or 'answer'
    ts_str = data.get('timestamp')
    ts = parse_datetime(ts_str) if ts_str else None

    try:
        tokens_input = int(data.get('tokens_input') or 0)
        tokens_output = int(data.get('tokens_output') or 0)
    except (TypeError, ValueError):
        logging.warning("LLM_USAGE_LOG bad_tokens user=%s payload=%s", utilisateur.id, data)
        return Response({'detail': 'tokens_input ou tokens_output invalide(s)'}, status=status.HTTP_400_BAD_REQUEST)

    log_llm_usage(
        utilisateur=utilisateur,
        provider=provider,
        model=model,
        purpose=purpose,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        ts=ts,
    )

    return Response({'status': 'ok'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def llm_quota_status(request):
    """Retourne l'├®tat du quota LLM courant pour l'utilisateur.

    R├®ponse:
    {
      "limit": 30000,
      "tokens_used": 12345,
      "remaining": 17655,
      "percentage": 0.41,
      "year_month": "2025-12"
    }
    """

    utilisateur = request.user
    now_dt = timezone.now()
    year_month = _llm_year_month(now_dt)

    quota, _ = LlmMonthlyQuota.objects.get_or_create(
        utilisateur=utilisateur,
        year_month=year_month,
        defaults={'limit': DEFAULT_MONTHLY_LIMIT},
    )

    if QUOTA_DISABLED:
        return Response(
            {
                'limit': DEFAULT_MONTHLY_LIMIT,
                'tokens_used': 0,
                'remaining': DEFAULT_MONTHLY_LIMIT,
                'percentage': 0.0,
                'year_month': year_month,
            },
            status=status.HTTP_200_OK,
        )

    remaining = max(0, quota.limit - quota.tokens_used)
    percentage = quota.tokens_used / quota.limit if quota.limit else 0.0

    return Response(
        {
            'limit': quota.limit,
            'tokens_used': quota.tokens_used,
            'remaining': remaining,
            'percentage': percentage,
            'year_month': year_month,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def assistant_health(request):
    """Retourne un ├®tat de sant├® technique de l'assistant LLM.

    V├®rifie la configuration de base du provider LLM (provider, cl├®s, URLs) et
    expose aussi l'├®tat de la recherche s├®mantique.

    R├®ponse JSON minimale:
    {
      "provider": "claude" | "mistral" | "openai" | ...,
      "llm_enabled": true/false,
      "config_ok": true/false,
      "errors": ["..."] ,
      "semantic_search_available": true/false
    }
    """

    utilisateur = request.user
    if utilisateur.role not in ['ADMIN']:
        return Response({'detail': 'Acc├¿s r├®serv├® aux administrateurs'}, status=status.HTTP_403_FORBIDDEN)

    provider = (getattr(settings, 'ASSISTANT_LLM_PROVIDER', 'openai') or 'openai').lower()
    llm_enabled = (str(getattr(settings, 'ASSISTANT_LLM_ENABLED', 'true')).lower() != 'false')

    errors: list[str] = []

    # V├®rifier la configuration selon le provider d├®clar├®
    if not llm_enabled:
        errors.append('LLM d├®sactiv├® via ASSISTANT_LLM_ENABLED=false')
    else:
        if provider in ('openai',):
            api_key = getattr(settings, 'ASSISTANT_LLM_API_KEY', None) or getattr(settings, 'OPENAI_API_KEY', None)
            base_url = getattr(settings, 'ASSISTANT_LLM_BASE_URL', 'https://api.openai.com/v1')
            if not api_key:
                errors.append('Cl├® API OpenAI manquante (ASSISTANT_LLM_API_KEY ou OPENAI_API_KEY)')
            if not isinstance(base_url, str) or not base_url:
                errors.append('ASSISTANT_LLM_BASE_URL invalide ou vide')
        elif provider in ('claude', 'anthropic'):
            claude_key = getattr(settings, 'CLAUDE_API_KEY', None) or getattr(settings, 'ANTHROPIC_API_KEY', None)
            claude_url = getattr(settings, 'CLAUDE_BASE_URL', 'https://api.anthropic.com/v1')
            if not claude_key:
                errors.append('Cl├® API Claude/Anthropic manquante (CLAUDE_API_KEY ou ANTHROPIC_API_KEY)')
            if not isinstance(claude_url, str) or not claude_url:
                errors.append('CLAUDE_BASE_URL invalide ou vide')
        elif provider == 'mistral':
            mistral_key = getattr(settings, 'MISTRAL_API_KEY', None)
            mistral_url = getattr(settings, 'MISTRAL_BASE_URL', 'https://api.mistral.ai/v1')
            if not mistral_key:
                errors.append('Cl├® API Mistral manquante (MISTRAL_API_KEY)')
            if not isinstance(mistral_url, str) or not mistral_url:
                errors.append('MISTRAL_BASE_URL invalide ou vide')
        else:
            # Providers compatibles OpenAI custom ou locaux
            base_url = getattr(settings, 'ASSISTANT_LLM_BASE_URL', None)
            if not base_url:
                errors.append(f'Provider LLM "{provider}" non reconnu et ASSISTANT_LLM_BASE_URL non d├®fini')

    config_ok = llm_enabled and not errors

    data = {
        'provider': provider,
        'llm_enabled': llm_enabled,
        'config_ok': bool(config_ok),
        'errors': errors,
        'semantic_search_available': bool(SEMANTIC_SEARCH_AVAILABLE),
    }

    logging.info(
        "ASSISTANT_HEALTH provider=%s enabled=%s config_ok=%s semantic_search_available=%s errors=%s",
        provider,
        llm_enabled,
        bool(config_ok),
        bool(SEMANTIC_SEARCH_AVAILABLE),
        ";".join(errors) if errors else "",
    )

    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def llm_admin_stats(request):
    """Stats LLM pour les administrateurs.

    Retourne:
    - tokens_par_utilisateur: liste des utilisateurs avec leur consommation
    - usage_mensuel: consommation totale par mois
    - top_utilisateurs: les 10 utilisateurs les plus actifs
    - total_tokens: somme totale de tous les tokens
    """

    utilisateur = request.user
    if utilisateur.role not in ['ADMIN']:
        return Response({'detail': 'Acc├¿s r├®serv├® aux administrateurs'}, status=status.HTTP_403_FORBIDDEN)

    now_dt = timezone.now()
    current_month = _llm_year_month(now_dt)

    # Tokens par utilisateur pour le mois courant
    quotas_mois = LlmMonthlyQuota.objects.filter(year_month=current_month).select_related('utilisateur')
    tokens_par_utilisateur = [
        {
            'utilisateur_id': q.utilisateur.id,
            'nom_utilisateur': q.utilisateur.nom_utilisateur,
            'nom_complet': f"{q.utilisateur.prenom} {q.utilisateur.nom}",
            'tokens_used': q.tokens_used,
            'limit': q.limit,
            'percentage': q.tokens_used / q.limit if q.limit else 0,
        }
        for q in quotas_mois
    ]

    # Usage mensuel (tous les mois)
    from django.db.models import Sum
    usage_mensuel = (
        LlmMonthlyQuota.objects.values('year_month')
        .annotate(total_tokens=Sum('tokens_used'))
        .order_by('-year_month')[:12]
    )

    # Top 10 utilisateurs (mois courant)
    top_utilisateurs = sorted(tokens_par_utilisateur, key=lambda x: x['tokens_used'], reverse=True)[:10]

    # Total tokens (tous les temps)
    total_tokens = LlmUsage.objects.aggregate(total=Sum('tokens_total'))['total'] or 0

    return Response(
        {
            'tokens_par_utilisateur': tokens_par_utilisateur,
            'usage_mensuel': list(usage_mensuel),
            'top_utilisateurs': top_utilisateurs,
            'total_tokens': total_tokens,
            'current_month': current_month,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def llm_admin_history(request):
    """Historique d├®taill├® des requ├¬tes LLM (admin uniquement).

    Query params:
    - utilisateur_id: filtrer par utilisateur
    - provider: filtrer par provider (mistral, openai)
    - purpose: filtrer par purpose (router, answer, summary)
    - limit: nombre de r├®sultats (d├®faut 100, max 500)
    """

    utilisateur = request.user
    if utilisateur.role not in ['ADMIN']:
        return Response({'detail': 'Acc├¿s r├®serv├® aux administrateurs'}, status=status.HTTP_403_FORBIDDEN)

    queryset = LlmUsage.objects.select_related('utilisateur').all()

    # Filtres
    utilisateur_id = request.query_params.get('utilisateur_id')
    if utilisateur_id:
        queryset = queryset.filter(utilisateur_id=utilisateur_id)

    provider = request.query_params.get('provider')
    if provider:
        queryset = queryset.filter(provider=provider)

    purpose = request.query_params.get('purpose')
    if purpose:
        queryset = queryset.filter(purpose=purpose)

    # Limite
    try:
        limit = int(request.query_params.get('limit', 100))
        limit = min(limit, 500)
    except (TypeError, ValueError):
        limit = 100

    usages = queryset.order_by('-timestamp')[:limit]

    data = [
        {
            'id': u.id,
            'utilisateur': {
                'id': u.utilisateur.id,
                'nom_utilisateur': u.utilisateur.nom_utilisateur,
                'nom_complet': f"{u.utilisateur.prenom} {u.utilisateur.nom}",
            },
            'timestamp': u.timestamp.isoformat(),
            'provider': u.provider,
            'model': u.model,
            'purpose': u.purpose,
            'tokens_input': u.tokens_input,
            'tokens_output': u.tokens_output,
            'tokens_total': u.tokens_total,
        }
        for u in usages
    ]

    return Response({'history': data, 'count': len(data)}, status=status.HTTP_200_OK)


setattr(documents_search_view, 'ressource', 'documents')


class UtilisateurViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour g├®rer les utilisateurs
    """
    queryset = Utilisateur.objects.all()
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'utilisateurs'
    
    def get_serializer_class(self):
        """Utiliser un serializer diff├®rent pour la liste"""
        if self.action == 'list':
            return UtilisateurListSerializer
        return UtilisateurSerializer
    
    def get_queryset(self):
        """Filtrer les utilisateurs selon les param├¿tres"""
        queryset = Utilisateur.objects.all().order_by('prenom', 'nom')
        
        # Filtrer par r├┤le
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
        """Cr├®er un utilisateur et logger l'activit├®"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()

        return Response({
            'success': True,
            'message': 'Utilisateur cr├®├® avec succ├¿s',
            'utilisateur': UtilisateurListSerializer(utilisateur).data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Mettre ├á jour un utilisateur et logger l'activit├®"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()

        return Response({
            'success': True,
            'message': 'Profil mis ├á jour avec succ├¿s',
            'utilisateur': UtilisateurListSerializer(utilisateur).data
        })
    
    def destroy(self, request, *args, **kwargs):
        """Supprimer un utilisateur (soft delete recommand├®)"""
        instance = self.get_object()
        
        # Plut├┤t que de supprimer, on d├®sactive
        instance.est_actif = False
        instance.save()

        return Response({
            'success': True,
            'message': 'Utilisateur d├®sactiv├® avec succ├¿s'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='change-password')
    def change_password(self, request, pk=None):
        """Modifier le mot de passe d'un utilisateur"""
        utilisateur = self.get_object()

        if request.user.role != 'ADMIN':
            return Response({'erreur': "Seuls les administrateurs peuvent modifier les mots de passe."}, status=status.HTTP_403_FORBIDDEN)

        ancien_mdp = request.data.get('ancien_mot_de_passe') or request.data.get('ancienMotDePasse')
        nouveau_mdp = request.data.get('nouveau_mot_de_passe') or request.data.get('nouveauMotDePasse')

        if not nouveau_mdp:
            return Response({'erreur': 'Le nouveau mot de passe est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(nouveau_mdp) < 8:
            return Response({'erreur': 'Le nouveau mot de passe doit contenir au moins 8 caract├¿res.'}, status=status.HTTP_400_BAD_REQUEST)

        # Si l'administrateur modifie son propre mot de passe, l'ancien est requis par s├®curit├®
        if str(request.user.id) == str(utilisateur.id):
            if not ancien_mdp:
                return Response({'erreur': "Merci d'indiquer votre mot de passe actuel."}, status=status.HTTP_400_BAD_REQUEST)
            if not utilisateur.check_password(ancien_mdp):
                return Response({'erreur': 'Le mot de passe actuel est incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        utilisateur.set_password(nouveau_mdp)
        utilisateur.save(update_fields=['password'])

        return Response({'success': True, 'message': 'Mot de passe modifi├® avec succ├¿s.'}, status=status.HTTP_200_OK)


class ClientViewSet(viewsets.ModelViewSet):
    """ViewSet pour g├®rer les clients"""
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'  # Les clients font partie de la gestion documentaire

    # Pas de pagination c├┤t├® API pour permettre ├á lÔÇÖinterface de g├®rer sa propre pagination
    pagination_class = None

    def get_serializer_class(self):
        """Retourner une version l├®g├¿re si ?simple=1 est demand├® pour la liste."""
        request = getattr(self, 'request', None)
        if self.action == 'list' and request is not None:
            simple = (request.query_params.get('simple') or '').lower()
            if simple in ('1', 'true', 'yes'):
                return ClientSimpleSerializer
        return ClientSerializer

    def get_queryset(self):
        queryset = Client.objects.all()

        # Recherche plein texte sur le nom (param├¿tre ?search=)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(Q(nom__icontains=search) | Q(numero_client__icontains=search))

        # Filtre par type de client (ENTREPRISE / PARTICULIER) via ?type=
        type_param = self.request.query_params.get('type') or None
        if type_param:
            queryset = queryset.filter(type=type_param)

        # Respecter le param├¿tre dÔÇÖordering si fourni, sinon trier par nom
        ordering = self.request.query_params.get('ordering') or None
        if ordering:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('nom')

        return queryset


class ExerciceViewSet(viewsets.ModelViewSet):
    """ViewSet pour g├®rer les exercices"""
    queryset = Exercice.objects.all()
    serializer_class = ExerciceSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'
    pagination_class = None

    def get_serializer_class(self):
        """Version l├®g├¿re pour les listes avec ?simple=1 (sans risques imbriqu├®s)."""
        request = getattr(self, 'request', None)
        if self.action == 'list' and request is not None:
            simple = (request.query_params.get('simple') or '').lower()
            if simple in ('1', 'true', 'yes'):
                return ExerciceSimpleSerializer
        return ExerciceSerializer

    def get_queryset(self):
        """Filtrer les exercices selon le client si ?client=<id> est fourni"""
        queryset = Exercice.objects.all().order_by('-annee')
        client_id = self.request.query_params.get('client')
        if client_id:
            try:
                client = Client.objects.get(pk=client_id)
            except Client.DoesNotExist:
                queryset = Exercice.objects.none()
            else:
                # Cas sp├®cial flotte/groupe : pour une ENTREPRISE, inclure ├á la fois
                # ses exercices propres et ceux de ses membres (particuliers rattach├®s).
                if client.type == 'ENTREPRISE':
                    queryset = queryset.filter(
                        Q(client=client) | Q(client__entreprise_parente=client)
                    )
                else:
                    queryset = queryset.filter(client=client)

        # Pour les usages "simples" (recherche avanc├®e), permettre de limiter
        # le nombre de r├®sultats via ?page_size=...
        simple = (self.request.query_params.get('simple') or '').lower()
        page_size_param = self.request.query_params.get('page_size')
        if simple in ('1', 'true', 'yes') and page_size_param:
            try:
                page_size = int(page_size_param)
                if page_size > 0:
                    queryset = queryset[:page_size]
            except (TypeError, ValueError):
                pass

        return queryset


class RisqueViewSet(viewsets.ModelViewSet):
    """ViewSet pour g├®rer les risques"""
    queryset = Risque.objects.all()
    serializer_class = RisqueSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'

    def get_serializer_class(self):
        """Version l├®g├¿re pour les listes avec ?simple=1 (type uniquement)."""
        request = getattr(self, 'request', None)
        if self.action == 'list' and request is not None:
            simple = (request.query_params.get('simple') or '').lower()
            if simple in ('1', 'true', 'yes'):
                return RisqueSimpleSerializer
        return RisqueSerializer

    def get_queryset(self):
        queryset = Risque.objects.all()

        # Pour les usages simples (chargement des filtres), on peut limiter via ?page_size
        simple = (self.request.query_params.get('simple') or '').lower()
        page_size_param = self.request.query_params.get('page_size')
        if simple in ('1', 'true', 'yes') and page_size_param:
            try:
                page_size = int(page_size_param)
                if page_size > 0:
                    queryset = queryset[:page_size]
            except (TypeError, ValueError):
                pass

        return queryset


class DocumentViewSet(viewsets.ModelViewSet):
    """ViewSet pour g├®rer les documents"""
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'
    
    def get_queryset(self):
        """Filtrer les documents selon les param├¿tres"""
        queryset = Document.objects.all().order_by('-cree_le')
        
        # Filtrer par risque
        risque_id = self.request.query_params.get('risque', None)
        if risque_id:
            queryset = queryset.filter(risque_id=risque_id)
        
        # Filtrer par auteur
        auteur_id = self.request.query_params.get('auteur', None)
        if auteur_id:
            queryset = queryset.filter(auteur_id=auteur_id)
        
        # Filtrer par statut archiv├®
        est_archive = self.request.query_params.get('est_archive', None)
        if est_archive is not None:
            queryset = queryset.filter(est_archive=est_archive.lower() == 'true')
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Créer un document et logger l'activité"""
        from .search_index import invalidate_document_index
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = serializer.save()
        try:
            chunker_document(document)
        except Exception:
            logging.exception("Erreur lors de la génération des chunks de document")
        
        # Invalider l'index de recherche
        invalidate_document_index()

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Mettre à jour un document"""
        from .search_index import invalidate_document_index
        
        response = super().update(request, *args, **kwargs)
        invalidate_document_index()
        return response
    
    def destroy(self, request, *args, **kwargs):
        """Supprimer un document"""
        from .search_index import invalidate_document_index
        
        response = super().destroy(request, *args, **kwargs)
        invalidate_document_index()
        return response
    
    @action(detail=False, methods=['get'])
    def recents(self, request):
        """Récupérer les documents récents"""
        from django.utils.dateparse import parse_datetime
        
        limit = int(request.query_params.get('limit', 10))
        since = request.query_params.get('since', None)
        
        queryset = Document.objects.all().order_by('-cree_le')[:limit]
        
        if since:
            since_date = parse_datetime(since)
            if since_date:
                queryset = Document.objects.filter(cree_le__gt=since_date).order_by('-cree_le')[:limit]
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class DocumentUploadView(APIView):
    """T├®l├®verser un document avec fichier"""

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
            logging.exception("Erreur lors de la cr├®ation du document")
            default_storage.delete(chemin)
            raise

        try:
            chunker_document(document)
        except Exception:
            logging.exception("Erreur lors de la génération des chunks de document (upload)")
        
        # Invalider l'index de recherche
        from .search_index import invalidate_document_index
        invalidate_document_index()

        serializer = DocumentSerializer(document, context={'request': request})
        return Response({
            'success': True,
            'message': 'Document téléversé avec succès',
            'document': serializer.data
        }, status=status.HTTP_201_CREATED)


class AssistantConversationViewSet(viewsets.ModelViewSet):
    """ViewSet pour g├®rer les conversations de l'assistant IA"""

    serializer_class = AssistantConversationSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'assistant'

    def get_queryset(self):
        user = self.request.user
        return AssistantConversation.objects.filter(utilisateur=user).order_by('-dernier_message_le', '-cree_le')

    def perform_create(self, serializer):
        conversation = serializer.save(utilisateur=self.request.user)
        if conversation.dernier_message_le is None:
            conversation.dernier_message_le = conversation.cree_le
            conversation.save(update_fields=['dernier_message_le'])


class AssistantMessageViewSet(viewsets.ModelViewSet):
    """ViewSet pour g├®rer les messages de l'assistant IA"""

    serializer_class = AssistantMessageSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'assistant'

    def get_queryset(self):
        user = self.request.user
        queryset = AssistantMessage.objects.select_related('conversation', 'conversation__utilisateur')
        queryset = queryset.filter(conversation__utilisateur=user)

        conversation_id = self.request.query_params.get('conversation')
        if conversation_id:
            queryset = queryset.filter(conversation_id=conversation_id)

        return queryset.order_by('cree_le')

    def perform_create(self, serializer):
        conversation = serializer.validated_data.get('conversation')
        if conversation.utilisateur != self.request.user:
            raise PermissionDenied("Vous ne pouvez pas ├®crire dans une conversation qui ne vous appartient pas.")

        message = serializer.save()

        conversation.dernier_message_le = message.cree_le
        conversation.nombre_messages = (conversation.nombre_messages or 0) + 1
        conversation.save(update_fields=['dernier_message_le', 'nombre_messages'])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assistant_feedback(request):
    data = request.data or {}
    interaction_id = data.get('interactionId') or data.get('interaction_id')
    feedback = data.get('feedback')
    comment = data.get('comment')

    if not interaction_id or not feedback:
        return Response({'detail': 'interactionId et feedback sont requis'}, status=status.HTTP_400_BAD_REQUEST)

    qs = AssistantMessage.objects.select_related('conversation', 'conversation__utilisateur').filter(
        conversation__utilisateur=request.user,
        metadata__interactionId=interaction_id,
    )

    if not qs.exists():
        return Response({'detail': 'Aucun message correspondant ├á cet interactionId'}, status=status.HTTP_404_NOT_FOUND)

    updated = 0
    for msg in qs:
        meta = msg.metadata or {}
        fb_meta = meta.get('feedback') or {}
        fb_meta.update(
            {
                'value': feedback,
                'comment': comment,
                'timestamp': timezone.now().isoformat(),
            }
        )
        meta['feedback'] = fb_meta
        msg.metadata = meta
        msg.save(update_fields=['metadata'])
        updated += 1

    logging.info(
        "ASSISTANT_FEEDBACK user=%s interaction_id=%s feedback=%s updated_messages=%s",
        request.user.id,
        interaction_id,
        feedback,
        updated,
    )

    return Response({'success': True, 'updated': updated}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def stats_view(request):
    """Statistiques synth├®tiques pour le tableau de bord"""
    total_documents = Document.objects.count()
    uploads_today = Document.objects.filter(cree_le__date=timezone.now().date()).count()
    total_clients = Client.objects.count()
    total_utilisateurs = Utilisateur.objects.count()

    return Response({
        'documents': total_documents,
        'uploadsAujourdhui': uploads_today,
        'clients': total_clients,
        'utilisateurs': total_utilisateurs,
    })


setattr(stats_view, 'ressource', 'stats')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_stats_view(request):
    """Statistiques agr├®g├®es optimis├®es pour l'assistant IA"""

    base_queryset = Document.objects.select_related('categorie', 'risque__exercice__client')

    total_documents = base_queryset.count()

    date_queryset = base_queryset.annotate(date_ref=Coalesce('date_document', 'cree_le'))

    documents_par_mois_qs = (
        date_queryset
        .filter(date_ref__isnull=False)
        .annotate(mois=TruncMonth('date_ref'))
        .values('mois')
        .annotate(total=Count('id'))
        .order_by('mois')
    )

    documents_par_mois_list = list(documents_par_mois_qs)
    if len(documents_par_mois_list) > 6:
        documents_par_mois_list = documents_par_mois_list[-6:]

    documents_par_mois = {
        entry['mois'].strftime('%Y-%m') if entry['mois'] else 'Inconnu': entry['total']
        for entry in documents_par_mois_list
    }

    top_clients_qs = (
        base_queryset
        .values('risque__exercice__client__nom')
        .annotate(total=Count('id'))
        .order_by('-total')[:5]
    )
    top_clients = [
        {
            'client': entry['risque__exercice__client__nom'] or 'Client inconnu',
            'compte': entry['total'],
        }
        for entry in top_clients_qs
    ]

    now = timezone.now()
    retard_threshold = now - timedelta(days=30)
    peremption_threshold = now - timedelta(days=5 * 365)

    documents_en_retard = (
        date_queryset
        .filter(est_archive=False, date_ref__lt=retard_threshold)
        .count()
    )

    alertes_peremption = (
        date_queryset
        .filter(date_ref__lt=peremption_threshold)
        .count()
    )

    taux_conformite = 1
    if total_documents:
        taux_conformite = max(0, min(1, (total_documents - documents_en_retard) / total_documents))

    # Totaux de clients pour permettre ├á l'assistant de r├®pondre de mani├¿re
    # fiable aux questions de type "combien de clients" sans deviner ├á
    # partir d'un ├®chantillon de documents.
    total_clients = Client.objects.count()
    total_clients_particuliers = Client.objects.filter(type='PARTICULIER').count()
    total_clients_entreprises = Client.objects.filter(type='ENTREPRISE').count()

    data = {
        'documents_par_mois': documents_par_mois,
        'top_clients': top_clients,
        'kpi': {
            'taux_conformite': taux_conformite,
            'documents_en_retard': documents_en_retard,
            'alertes_peremption': alertes_peremption,
        },
        'totaux_clients': {
            'total': total_clients,
            'particuliers': total_clients_particuliers,
            'entreprises': total_clients_entreprises,
        },
    }

    return Response(data)


setattr(assistant_stats_view, 'ressource', 'stats')


def _build_document_payload(document: Document, request=None) -> dict:
    client_nom = None
    exercice_annee = None
    risque_type = None
    if document.risque and document.risque.exercice:
        exercice = document.risque.exercice
        exercice_annee = exercice.annee
        risque_type = document.risque.type
        if exercice.client:
            client_nom = exercice.client.nom

    categorie_nom = document.categorie.nom if document.categorie else None
    type_label = document.get_type_courrier_display() if document.type_courrier else None

    # Essayer de r├®cup├®rer l'URL de fichier de la m├¬me fa├ºon que sur les autres ├®crans
    fichier_url = None
    if request is not None:
        try:
            serializer = DocumentSerializer(document, context={'request': request})
            fichier_url = serializer.data.get('fichier_url')
        except Exception:
            fichier_url = None

    return {
        'id': str(document.id),
        'titre': document.titre,
        'description': document.description,
        'categorie': categorie_nom,
        'type_courrier': document.type_courrier,
        'type_courrier_label': type_label,
        'reference': document.reference,
        'client': client_nom,
        'exercice': exercice_annee,
        'risque': risque_type,
        'date_document': document.date_document.isoformat() if document.date_document else None,
        'cree_le': document.cree_le.isoformat() if document.cree_le else None,
        'est_archive': document.est_archive,
        'fichier_url': fichier_url,
    }


def _normalize_text(value: str) -> str:
    """Normaliser une cha├«ne pour les recherches plein texte (accents, casse, espaces).

    Cette fonction est utilis├®e pour la recherche rapide afin de rendre robustes les
    correspondances sur les noms de clients, ann├®es d'exercice, types de risques et
    types de courrier, y compris lorsque l'utilisateur tape sans accents ou avec des
    s├®parateurs diff├®rents.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)

    value = unicodedata.normalize('NFD', value)
    value = ''.join(ch for ch in value if unicodedata.category(ch) != 'Mn')
    value = value.lower()
    value = re.sub(r"[^0-9a-zA-Z]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _extract_text_from_pdf(document: Document) -> list[tuple[int, str]]:
    """
    Extrait le texte d'un PDF avec fallback OCR pour les documents scannés.
    """
    if not document.chemin_fichier:
        return []

    pages: list[tuple[int, str]] = []
    total_text_length = 0
    
    # Essayer l'extraction native avec PyPDF2
    if PDF_EXTRACTION_AVAILABLE:
        try:
            with default_storage.open(document.chemin_fichier, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for index, page in enumerate(reader.pages):
                    try:
                        text = page.extract_text() or ""
                    except Exception:
                        logging.exception("Erreur extraction texte page %s du document %s", index + 1, document.id)
                        text = ""
                    if text.strip():
                        pages.append((index + 1, text))
                        total_text_length += len(text)
        except Exception:
            logging.exception("Erreur ouverture PDF pour le document %s", document.id)
    
    # Si peu de texte extrait, essayer l'OCR
    avg_text_per_page = total_text_length / max(len(pages), 1) if pages else 0
    
    if avg_text_per_page < 100:  # Seuil: moins de 100 caractères par page
        try:
            from .ocr import is_pdf_ocr_available, ocr_pdf_bytes
            
            if is_pdf_ocr_available():
                logging.info(f"Document {document.id}: peu de texte ({avg_text_per_page:.0f} car/page), tentative OCR...")
                
                with default_storage.open(document.chemin_fichier, 'rb') as f:
                    pdf_bytes = f.read()
                
                ocr_pages = ocr_pdf_bytes(pdf_bytes)
                if ocr_pages:
                    logging.info(f"Document {document.id}: OCR réussi, {len(ocr_pages)} pages extraites")
                    return ocr_pages
        except Exception:
            logging.exception("Erreur OCR pour le document %s", document.id)
    
    return pages


def chunker_document(document: Document) -> None:
    """
    Découpe un document en chunks pour la recherche.
    Utilise un chunking intelligent basé sur les paragraphes et phrases.
    """
    from .chunking import chunk_document_pages, chunk_document_text
    
    client_nom = None
    exercice_annee = None
    risque_type = None
    if document.risque and document.risque.exercice:
        exercice = document.risque.exercice
        exercice_annee = exercice.annee
        risque_type = document.risque.type
        if exercice.client:
            client_nom = exercice.client.nom

    # Supprimer les anciens chunks
    DocumentChunk.objects.filter(document=document).delete()
    
    chunks_crees = 0

    # Extraction avancée pour les PDF si possible
    type_fichier = (document.type_fichier or "").lower()
    if 'pdf' in type_fichier:
        pages = _extract_text_from_pdf(document)
        if pages:
            # Utiliser le chunker intelligent
            chunked_pages = chunk_document_pages(pages)
            
            for page_num, chunk_text, ordre in chunked_pages:
                if chunk_text and chunk_text.strip():
                    DocumentChunk.objects.create(
                        document=document,
                        ordre=ordre,
                        page=page_num,
                        texte=chunk_text,
                        client_nom=client_nom,
                        exercice_annee=exercice_annee,
                        risque_type=risque_type,
                        type_courrier=document.type_courrier,
                        reference=document.reference,
                    )
                    chunks_crees += 1

    # Fallback simple si aucune extraction PDF n'est possible ou n'a rien produit
    if chunks_crees == 0:
        texte = document.description or document.titre or ''
        if not texte.strip():
            return

        # Utiliser le chunker intelligent même pour le texte simple
        chunks = chunk_document_text(texte)
        for ordre, chunk_text in enumerate(chunks):
            DocumentChunk.objects.create(
                document=document,
                ordre=ordre,
                page=None,
                texte=chunk_text,
                client_nom=client_nom,
                exercice_annee=exercice_annee,
                risque_type=risque_type,
                type_courrier=document.type_courrier,
                reference=document.reference,
            )
    
    logging.info(f"Document {document.id}: {chunks_crees} chunks créés")


def _build_document_text(payload: dict) -> str:
    parts = [
        payload.get('titre'),
        payload.get('description'),
        payload.get('categorie'),
        payload.get('type_courrier_label'),
        payload.get('reference'),
        payload.get('client'),
    ]

    risque = payload.get('risque')
    if risque is not None:
        parts.append(str(risque))

    exercice = payload.get('exercice')
    if exercice is not None:
        parts.append(str(exercice))

    texte = ' '.join(str(part) for part in parts if part is not None and str(part).strip())
    return texte or str(payload.get('titre') or '')


def _build_document_metadata(payload: dict) -> dict:
    return {
        'titre': payload.get('titre'),
        'description': payload.get('description'),
        'categorie': payload.get('categorie'),
        'type': payload.get('type_courrier_label'),
        'reference': payload.get('reference'),
        'client': payload.get('client'),
        'exercice': payload.get('exercice'),
        'risque': payload.get('risque'),
        # Ne pas utiliser cree_le comme date_document : seule la date r├®elle (si renseign├®e)
        # est conserv├®e, et l'ann├®e d'exercice sert de r├®f├®rence principale pour les recherches.
        'date_document': payload.get('date_document'),
        'statut_archive': payload.get('est_archive'),
        'fichier_url': payload.get('fichier_url'),
        'page': payload.get('chunk_page'),
        'chunk_ordre': payload.get('chunk_ordre'),
    }


def _build_document_highlights(metadata: dict) -> list[str]:
    highlights = []
    if metadata.get('client'):
        highlights.append(f"Client : {metadata['client']}")
    if metadata.get('categorie'):
        highlights.append(f"Cat├®gorie : {metadata['categorie']}")
    if metadata.get('type'):
        highlights.append(f"Type : {metadata['type']}")
    if metadata.get('reference'):
        highlights.append(f"R├®f├®rence : {metadata['reference']}")
    if metadata.get('date_document'):
        highlights.append(f"Date : {metadata['date_document'][:10]}")
    return highlights


def _build_document_content(payload: dict, metadata: dict) -> str:
    lignes = []
    if payload.get('description'):
        lignes.append(payload['description'])
    if metadata.get('client'):
        lignes.append(f"Client : {metadata['client']}")
    if metadata.get('reference'):
        lignes.append(f"R├®f├®rence : {metadata['reference']}")
    if metadata.get('type'):
        lignes.append(f"Type de courrier : {metadata['type']}")
    if metadata.get('categorie'):
        lignes.append(f"Cat├®gorie : {metadata['categorie']}")
    if metadata.get('date_document'):
        lignes.append(f"Date : {metadata['date_document'][:10]}")
    return '\n'.join(lignes) or 'Informations limit├®es sur ce document.'


def _build_assistant_result(payload: dict, score: float, *, is_fallback: bool = False) -> dict:
    metadata = _build_document_metadata(payload)
    if is_fallback:
        metadata['isFallback'] = True
    highlights = _build_document_highlights(metadata)
    content = _build_document_content(payload, metadata)
    return {
        'id': payload['id'],
        'titre': payload['titre'],
        'score': round(float(score), 6),
        'metadata': metadata,
        'highlights': highlights,
        'content': content,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_document_search_view(request):
    """Recherche TF-IDF optimisée pour l'assistant IA avec index persistant"""
    from .search_index import get_document_index, rebuild_document_index

    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response({'results': []})

    try:
        top_k = int(request.query_params.get('top_k') or 5)
    except ValueError:
        top_k = 5

    # Utiliser l'index persistant (reconstruit automatiquement si nécessaire)
    try:
        rebuild_document_index()
        index = get_document_index()
        search_results = index.search_tfidf(query, top_k=top_k)
        
        results = []
        for payload, score in search_results:
            results.append(_build_assistant_result(payload, score))
        
        return Response({'results': results, 'index_stats': index.get_stats()})
    except Exception as e:
        logging.error(f"Erreur index persistant, fallback sur calcul direct: {e}")
    
    # Fallback: calcul direct si l'index échoue
    documents = list(
        Document.objects.select_related('categorie', 'risque__exercice__client').all()
    )

    if not documents:
        return Response({'results': []})

    payloads = [_build_document_payload(doc, request) for doc in documents]
    corpus = [_build_document_text(payload) for payload in payloads]

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(corpus)
    query_vector = vectorizer.transform([query])
    scores = linear_kernel(query_vector, tfidf_matrix).flatten()

    indexed_scores = list(enumerate(scores.tolist()))
    indexed_scores.sort(key=lambda item: item[1], reverse=True)

    results = []
    for index, score in indexed_scores[: max(top_k, 1)]:
        if score <= 0:
            continue
        payload = payloads[index]
        results.append(_build_assistant_result(payload, score))

    return Response({'results': results})


setattr(assistant_document_search_view, 'ressource', 'documents')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_document_search_faiss_view(request):
    """Recherche vectorielle via FAISS pour l'assistant IA"""

    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response({'results': []})

    include_fallback = (request.query_params.get('include_fallback') or '').lower() == 'true'

    try:
        top_k = int(request.query_params.get('top_k') or 5)
    except ValueError:
        top_k = 5

    documents = list(
        Document.objects.select_related('categorie', 'risque__exercice__client').all()
    )

    if not documents:
        return Response({'results': []})

    payloads = [_build_document_payload(doc) for doc in documents]
    corpus = [_build_document_text(payload) for payload in payloads]

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(corpus)

    if tfidf_matrix.shape[1] == 0:
        return Response({'results': []})

    doc_matrix = tfidf_matrix.astype(np.float32).toarray()
    if doc_matrix.size == 0:
        return Response({'results': []})

    faiss.normalize_L2(doc_matrix)

    query_vector = vectorizer.transform([query]).astype(np.float32).toarray()
    if query_vector.size == 0 or not np.any(query_vector):
        if include_fallback:
            fallback_document = Document.objects.select_related('categorie', 'risque__exercice__client').order_by('-cree_le').first()
            if fallback_document:
                payload = _build_document_payload(fallback_document, request)
                return Response({'results': [_build_assistant_result(payload, 0.0, is_fallback=True)]})
        return Response({'results': []})

    faiss.normalize_L2(query_vector)

    index = faiss.IndexFlatIP(doc_matrix.shape[1])
    index.add(doc_matrix)

    distances, indices = index.search(query_vector, max(top_k, 1))

    results = []
    for idx, score in zip(indices[0], distances[0]):
        if idx < 0:
            continue
        if score <= 0:
            continue
        payload = payloads[idx]
        results.append(_build_assistant_result(payload, float(score)))

    if include_fallback and not results:
        fallback_document = Document.objects.select_related('categorie', 'risque__exercice__client').order_by('-cree_le').first()
        if fallback_document:
            payload = _build_document_payload(fallback_document, request)
            results.append(_build_assistant_result(payload, 0.0, is_fallback=True))

    return Response({'results': results})


setattr(assistant_document_search_faiss_view, 'ressource', 'documents')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def document_search_view(request):
    """Recherche simplifi├®e de documents"""
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


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_semantic_search_view(request):
    """
    Recherche s├®mantique avanc├®e pour l'assistant IA.
    Utilise des embeddings multilingues pour comprendre le sens des requ├¬tes.
    Fallback sur TF-IDF si sentence-transformers n'est pas disponible.
    
    Param├¿tres de filtre optionnels :
    - client: code client (ex: 3CB)
    - exercice: ann├®e de l'exercice (ex: 2018)
    - risque: type de risque (ex: sante)
    """
    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response({'results': [], 'method': 'none'})

    try:
        top_k = int(request.query_params.get('top_k') or 5)
    except ValueError:
        top_k = 5

    include_fallback = (request.query_params.get('include_fallback') or '').lower() == 'true'
    
    # Filtres optionnels pour affiner la recherche
    client_filter = (request.query_params.get('client') or '').strip().upper()
    exercice_filter = (request.query_params.get('exercice') or '').strip()
    risque_filter = (request.query_params.get('risque') or '').strip().lower()

    # Construire la requ├¬te avec filtres
    queryset = Document.objects.select_related('categorie', 'risque__exercice__client')
    
    if client_filter:
        # Le client peut ├¬tre identifi├® par son nom ou son numero_client
        queryset = queryset.filter(
            Q(risque__exercice__client__nom__iexact=client_filter) |
            Q(risque__exercice__client__numero_client__iexact=client_filter)
        )
        logging.info(f"Filtre client: {client_filter}")
    
    if exercice_filter:
        try:
            annee = int(exercice_filter)
            queryset = queryset.filter(risque__exercice__annee=annee)
            logging.info(f"Filtre exercice: {annee}")
        except ValueError:
            pass
    
    if risque_filter:
        # Le risque est identifi├® par son type
        queryset = queryset.filter(risque__type__icontains=risque_filter)
        logging.info(f"Filtre risque: {risque_filter}")
    
    documents = list(queryset.all())

    if not documents:
        return Response({'results': [], 'method': 'none'})

    payloads = [_build_document_payload(doc, request) for doc in documents]
    corpus = [_build_document_text(payload) for payload in payloads]

    # Essayer la recherche s├®mantique si disponible
    if SEMANTIC_SEARCH_AVAILABLE:
        try:
            model = get_semantic_model()
            if model is not None:
                # Encoder la requ├¬te et les documents
                query_embedding = model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
                doc_embeddings = model.encode(corpus, convert_to_numpy=True, normalize_embeddings=True)
                
                # Cr├®er l'index FAISS avec les embeddings s├®mantiques
                dimension = doc_embeddings.shape[1]
                index = faiss.IndexFlatIP(dimension)
                index.add(doc_embeddings.astype(np.float32))
                
                # Rechercher les documents les plus similaires
                distances, indices = index.search(query_embedding.astype(np.float32), min(top_k, len(documents)))
                
                results = []
                for idx, score in zip(indices[0], distances[0]):
                    if idx < 0 or score <= 0:
                        continue
                    payload = payloads[idx]
                    result = _build_assistant_result(payload, float(score))
                    result['search_method'] = 'semantic'
                    results.append(result)
                
                if results:
                    try:
                        apercu = [
                            {
                                'id': r.get('id'),
                                'client': (r.get('metadata') or {}).get('client'),
                                'exercice': (r.get('metadata') or {}).get('exercice'),
                                'risque': (r.get('metadata') or {}).get('risque'),
                                'score': r.get('score'),
                            }
                            for r in results[:10]
                        ]
                        logging.info(
                            "Assistant semantic search: query=%r client=%s exercice=%s risque=%s top=%s",
                            query,
                            client_filter or None,
                            exercice_filter or None,
                            risque_filter or None,
                            apercu,
                        )
                    except Exception as log_error:
                        logging.error("Erreur lors du logging des r├®sultats s├®mantiques: %s", log_error)

                    return Response({'results': results, 'method': 'semantic'})
                
                # Pas de r├®sultats s├®mantiques, fallback
                logging.info("Recherche s├®mantique: aucun r├®sultat, fallback TF-IDF")
        except Exception as e:
            logging.error(f"Erreur recherche s├®mantique: {e}, fallback TF-IDF")

    # Fallback sur TF-IDF si la recherche s├®mantique ├®choue ou n'est pas disponible.
    # On privil├®gie les chunks de documents (texte extrait des PDF) s'ils sont disponibles.
    try:
        chunks_qs = DocumentChunk.objects.filter(document__in=documents)
        chunks = list(
            chunks_qs.select_related(
                'document__categorie',
                'document__risque__exercice__client',
            )
        )
    except Exception:
        logging.exception("Erreur lors de la r├®cup├®ration des chunks pour la recherche TF-IDF")
        chunks = []

    if chunks:
        new_payloads = []
        new_corpus = []
        for chunk in chunks:
            base_payload = _build_document_payload(chunk.document, request)
            payload = dict(base_payload)
            payload['description'] = chunk.texte
            payload['chunk_page'] = chunk.page
            payload['chunk_ordre'] = chunk.ordre
            new_payloads.append(payload)
            new_corpus.append(_build_document_text(payload))
        payloads = new_payloads
        corpus = new_corpus

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(corpus)
    query_vector = vectorizer.transform([query])
    scores = linear_kernel(query_vector, tfidf_matrix).flatten()

    indexed_scores = list(enumerate(scores.tolist()))

    # Agr├®ger les scores au niveau du document pour ├®viter de renvoyer plusieurs
    # fois le m├¬me document lorsque plusieurs chunks sont pertinents.
    doc_best = {}
    for idx, score in indexed_scores:
        if score <= 0:
            continue
        if idx < 0 or idx >= len(payloads):
            continue
        payload = payloads[idx]
        doc_id = str(payload.get('id') or '')
        if not doc_id:
            continue
        current = doc_best.get(doc_id)
        if current is None or score > current[0]:
            # Conserver le meilleur chunk (score le plus ├®lev├®) pour chaque document
            doc_best[doc_id] = (score, payload)

    # Trier les documents par score d├®croissant (meilleur chunk en premier)
    sorted_docs = sorted(doc_best.items(), key=lambda item: item[1][0], reverse=True)

    results = []
    for _, (score, payload) in sorted_docs[: max(top_k, 1)]:
        result = _build_assistant_result(payload, score)
        result['search_method'] = 'tfidf'
        results.append(result)

    # Fallback document si aucun r├®sultat
    if include_fallback and not results:
        fallback_document = Document.objects.select_related('categorie', 'risque__exercice__client').order_by('-cree_le').first()
        if fallback_document:
            payload = _build_document_payload(fallback_document, request)
            result = _build_assistant_result(payload, 0.0, is_fallback=True)
            result['search_method'] = 'fallback'
            results.append(result)

    if results:
        try:
            apercu = [
                {
                    'id': r.get('id'),
                    'client': (r.get('metadata') or {}).get('client'),
                    'exercice': (r.get('metadata') or {}).get('exercice'),
                    'risque': (r.get('metadata') or {}).get('risque'),
                    'score': r.get('score'),
                }
                for r in results[:10]
            ]
            logging.info(
                "Assistant TF-IDF search: query=%r client=%s exercice=%s risque=%s top=%s",
                query,
                client_filter or None,
                exercice_filter or None,
                risque_filter or None,
                apercu,
            )
        except Exception as log_error:
            logging.error("Erreur lors du logging des r├®sultats TF-IDF: %s", log_error)

    return Response({'results': results, 'method': 'tfidf' if results else 'none'})


setattr(assistant_semantic_search_view, 'ressource', 'documents')


# ============================================================================
# HEALTHCHECK ENDPOINTS
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Endpoint de santé basique (liveness probe)."""
    return Response({
        'status': 'healthy',
        'service': 'acs-archive-api',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def ready_check(request):
    """Endpoint de disponibilité (readiness probe)."""
    checks = {'database': False}
    errors = []
    
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        checks['database'] = True
    except Exception as e:
        errors.append(f'Database: {str(e)}')
    
    is_ready = checks['database']
    
    return Response({
        'status': 'ready' if is_ready else 'not_ready',
        'checks': checks,
        'errors': errors if errors else None,
    }, status=status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['GET'])
@permission_classes([AllowAny])
def version_info(request):
    """Informations sur la version de l'API."""
    import django
    import sys
    
    return Response({
        'api_version': '1.0.0',
        'django_version': django.__version__,
        'python_version': sys.version.split()[0],
    })


# ============================================================================
# AUDIT LOG ENDPOINTS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def audit_log_list(request):
    """Liste des logs d'audit."""
    from .models import HistoriqueActivite
    
    logs = HistoriqueActivite.objects.all().order_by('-date_action')[:100]
    data = [
        {
            'id': log.id,
            'utilisateur': log.utilisateur.nom_utilisateur if log.utilisateur else None,
            'action': log.action,
            'details': log.details,
            'date': log.date_action.isoformat(),
        }
        for log in logs
    ]
    return Response({'logs': data})


setattr(audit_log_list, 'ressource', 'audit')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def audit_log_detail(request, log_id):
    """Détail d'un log d'audit."""
    from .models import HistoriqueActivite
    
    try:
        log = HistoriqueActivite.objects.get(id=log_id)
        return Response({
            'id': log.id,
            'utilisateur': log.utilisateur.nom_utilisateur if log.utilisateur else None,
            'action': log.action,
            'details': log.details,
            'date': log.date_action.isoformat(),
        })
    except HistoriqueActivite.DoesNotExist:
        return Response({'error': 'Log non trouvé'}, status=status.HTTP_404_NOT_FOUND)


setattr(audit_log_detail, 'ressource', 'audit')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def audit_log_stats(request):
    """Statistiques des logs d'audit."""
    from .models import HistoriqueActivite
    
    total = HistoriqueActivite.objects.count()
    return Response({
        'total_logs': total,
    })


setattr(audit_log_stats, 'ressource', 'audit')


# ============================================================================
# ASSISTANT LEARNING ENDPOINTS (placeholder)
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assistant_learning_record(request):
    """Enregistre un feedback d'apprentissage."""
    return Response({
        'success': True,
        'message': 'Feedback enregistré (fonctionnalité en développement)',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def assistant_learning_similar(request):
    """Recherche des patterns similaires."""
    return Response({
        'patterns': [],
        'message': 'Fonctionnalité en développement',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_learning_stats(request):
    """Statistiques d'apprentissage."""
    return Response({
        'total_patterns': 0,
        'message': 'Fonctionnalité en développement',
    })


setattr(assistant_learning_stats, 'ressource', 'assistant')


@api_view(['POST'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_learning_pattern_update(request):
    """Met à jour un pattern d'apprentissage."""
    return Response({
        'success': True,
        'message': 'Pattern mis à jour (fonctionnalité en développement)',
    })


setattr(assistant_learning_pattern_update, 'ressource', 'assistant')
