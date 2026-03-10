"""
Vues pour l'API Django REST Framework
"""
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.throttling import AnonRateThrottle
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import authenticate
from django.utils import timezone
from urllib.parse import urlparse
from django.http import JsonResponse


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
from sklearn.metrics.pairwise import linear_kernel
from sklearn.feature_extraction.text import TfidfVectorizer

import time
import httpx
import json


def should_use_secure_cookie(request):
    host = (request.get_host() or '').split(':')[0]
    if settings.DEBUG:
        return False
    if host in ('localhost', '127.0.0.1'):
        return False
    return request.is_secure()


try:
    import pypdf as PyPDF2
    PDF_EXTRACTION_AVAILABLE = True
except ImportError:
    logging.warning("pypdf non disponible, extraction avancée des PDF désactivée")
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
from .permissions import RoleBasedPermission


# ============================================================================
# CACHE TF-IDF (OPTIMISATION)
# ============================================================================

import threading
import hashlib
from pathlib import Path
import joblib  # Sérialisation sécurisée (remplace pickle pour éviter CWE-502)

# Cache en mémoire pour le TF-IDF
_tfidf_cache = {}
_cache_lock = threading.Lock()

def _get_cache_key(data: str) -> str:
    """Génère une clé de cache unique pour les données."""
    return hashlib.md5(data.encode('utf-8')).hexdigest()

def _get_cache_file_path(cache_key: str, suffix: str) -> Path:
    """Retourne le chemin du fichier cache."""
    cache_dir = Path(settings.SEARCH_INDEX_DIR)
    cache_dir.mkdir(exist_ok=True, parents=True)
    return cache_dir / f"{cache_key}.{suffix}"

def _load_tfidf_from_cache(corpus_hash: str):
    """Charge le TF-IDF depuis le cache disque si disponible.
    
    Utilise joblib (plus sécurisé que pickle pour scikit-learn).
    """
    cache_file = _get_cache_file_path(corpus_hash, 'tfidf.joblib')
    cache_file_old = _get_cache_file_path(corpus_hash, 'tfidf')  # Ancien format
    
    with _cache_lock:
        if corpus_hash in _tfidf_cache:
            return _tfidf_cache[corpus_hash]
    
    try:
        if cache_file.exists():
            vectorizer, matrix = joblib.load(cache_file)
            with _cache_lock:
                _tfidf_cache[corpus_hash] = (vectorizer, matrix)
            return vectorizer, matrix
        elif cache_file_old.exists():
            # Migration depuis l'ancien format
            logging.info(f"Migration du cache TF-IDF vers format joblib sécurisé")
            vectorizer, matrix = joblib.load(cache_file_old)
            # Sauvegarder au nouveau format
            joblib.dump((vectorizer, matrix), cache_file)
            # Supprimer l'ancien fichier
            try:
                cache_file_old.unlink()
            except Exception:
                pass
            with _cache_lock:
                _tfidf_cache[corpus_hash] = (vectorizer, matrix)
            return vectorizer, matrix
    except Exception as e:
        logging.warning(f"Impossible de charger le TF-IDF cache: {e}")
    
    return None, None

def _save_tfidf_to_cache(corpus_hash: str, vectorizer, matrix):
    """Sauvegarde le TF-IDF dans le cache disque.
    
    Utilise joblib (plus sécurisé que pickle pour scikit-learn).
    """
    cache_file = _get_cache_file_path(corpus_hash, 'tfidf.joblib')
    
    with _cache_lock:
        _tfidf_cache[corpus_hash] = (vectorizer, matrix)
    
    try:
        joblib.dump((vectorizer, matrix), cache_file)
    except Exception as e:
        logging.warning(f"Impossible de sauvegarder le TF-IDF cache: {e}")


# ============================================================================
# GESTION DES QUOTAS LLM (BACKEND)
# ============================================================================

DEFAULT_MONTHLY_LIMIT = getattr(settings, 'ASSISTANT_LLM_MONTHLY_LIMIT', 30000)
QUOTA_DISABLED = str(getattr(settings, 'ASSISTANT_LLM_QUOTA_DISABLED', 'false')).lower() == 'true'


def _llm_year_month(dt: timezone.datetime) -> str:
    """Retourne une clé AAAA-MM pour le mois courant."""

    return dt.strftime('%Y-%m')


def consume_quota(utilisateur: Utilisateur, estimated_tokens: int, purpose: str, ts=None) -> dict:
    """Vérifie et décrémente le quota mensuel LLM pour un utilisateur.

    Retourne un dict {allowed, remaining, percentage} conformément au contrat
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
    """Journalise un appel LLM détaillé et met à jour le compteur mensuel.

    Cette fonction est appelée de manière asynchrone côté front, après l'appel
    LLM, pour enregistrer les tokens réellement consommés.
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
        quota.limit
    )


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Vue de connexion avec authentification JWT et gestion des sessions."""
    # Appliquer le rate limiting manuellement sur cette vue
    throttle = LoginRateThrottle()
    if not throttle.allow_request(request, None):
        wait = throttle.wait()
        return Response(
            {'erreur': f'Trop de tentatives de connexion. Réessayez dans {int(wait or 60)} secondes.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    try:
        # Vérifier les identifiants
        nom_utilisateur = request.data.get('username')
        mot_de_passe = request.data.get('password')
        
        if not nom_utilisateur or not mot_de_passe:
            return Response(
                {'erreur': 'Nom d\'utilisateur et mot de passe requis'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Authentifier l'utilisateur
        utilisateur = authenticate(username=nom_utilisateur, password=mot_de_passe)
        if utilisateur is None:
            return Response(
                {'erreur': 'Identifiants incorrects'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        # Vérifier si le compte est actif
        if not utilisateur.is_active:
            return Response(
                {'erreur': 'Ce compte est désactivé'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        # Mettre à jour la dernière connexion
        utilisateur.derniere_connexion = timezone.now()
        utilisateur.save(update_fields=['derniere_connexion'])
        
        # Générer les tokens JWT
        refresh = RefreshToken.for_user(utilisateur)
        access_token = refresh.access_token
        
        # Données de session
        session_data = {
            'id': str(utilisateur.id),
            'nomUtilisateur': utilisateur.nom_utilisateur,
            'nom': utilisateur.nom,
            'prenom': utilisateur.prenom,
            'email': utilisateur.email,
            'role': utilisateur.role,
        }
        
        # Construire la réponse JSON sans exposer les tokens côté client :
        # l'authentification repose désormais uniquement sur les cookies httpOnly.
        response = Response(
            {
                'success': True,
                'utilisateur': session_data,
            },
            status=status.HTTP_200_OK,
        )

        # Déterminer les paramètres des cookies
        # Éviter les cookies "secure" en environnement local (HTTP)
        secure_cookie = should_use_secure_cookie(request)
        access_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']
        refresh_lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
        samesite_policy = 'Lax'
        
        # Récupérer les noms des cookies depuis la configuration
        access_cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "acs_access_token")
        refresh_cookie_name = settings.SIMPLE_JWT.get("REFRESH_COOKIE", "acs_refresh_token")
        
        cookie_params = {
            'httponly': True,
            'secure': secure_cookie,
            'samesite': samesite_policy,
            'path': '/',
        }

        # delete_cookie ne supporte pas httponly/secure => utiliser kwargs dédiés
        delete_cookie_kwargs = {
            'path': '/',
        }

        # Supprimer d'abord tous les cookies existants pour éviter la duplication
        response.delete_cookie(access_cookie_name, **delete_cookie_kwargs)
        response.delete_cookie(refresh_cookie_name, **delete_cookie_kwargs)
        
        # Définir les cookies de session avec exactement les mêmes paramètres
        response.set_cookie(
            access_cookie_name,
            str(access_token),
            max_age=int(access_lifetime.total_seconds()),
            **cookie_params
        )
        response.set_cookie(
            refresh_cookie_name,
            str(refresh),
            max_age=int(refresh_lifetime.total_seconds()),
            **cookie_params
        )

        return response

    except Exception as e:
        logging.exception("Erreur lors de la tentative de connexion")
        return Response(
            {'erreur': 'Erreur serveur lors de l\'authentification'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token_view(request):
    """Endpoint de refresh token personnalisé qui lit depuis les cookies HttpOnly"""
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
    
    # Récupérer le nom du cookie depuis la configuration
    refresh_cookie_name = settings.SIMPLE_JWT.get("REFRESH_COOKIE", "acs_refresh_token")
    refresh_token = request.COOKIES.get(refresh_cookie_name)
    
    if not refresh_token:
        logging.warning(
            "Refresh token absent sur /api/auth/refresh/ (cookie=%s, cookies_present=%s)",
            refresh_cookie_name,
            list(request.COOKIES.keys()),
        )
        return Response(
            {'erreur': 'Aucun refresh token trouvé'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        # Valider et rafraîchir le token
        refresh = RefreshToken(refresh_token)
        access_token = str(refresh.access_token)
        
        # Créer la réponse avec le nouveau access token
        response = Response({
            'success': True,
            'message': 'Token rafraîchi avec succès'
        })
        
        # Déterminer les paramètres des cookies
        secure_cookie = should_use_secure_cookie(request)
        access_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']
        samesite_policy = 'Lax'
        
        # Récupérer le nom du cookie access token depuis la configuration
        access_cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "acs_access_token")
        
        # Mettre à jour le cookie access_token
        response.set_cookie(
            access_cookie_name,
            access_token,
            httponly=True,
            secure=secure_cookie,
            samesite=samesite_policy,
            max_age=int(access_lifetime.total_seconds()),
            path='/',
        )
        
        return response
        
    except (InvalidToken, TokenError) as e:
        logging.warning(
            "Refresh token invalide sur /api/auth/refresh/: %s (%s)",
            e.__class__.__name__,
            str(e),
        )
        # Nettoyer les cookies invalides pour éviter les boucles d'erreur
        response = Response(
            {'erreur': 'Le type de jeton fourni n\'est pas valide'},
            status=status.HTTP_401_UNAUTHORIZED
        )
        
        # Supprimer les cookies invalides
        secure_cookie = should_use_secure_cookie(request)
        samesite_policy = 'Lax'
        
        access_cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "access_token")
        refresh_cookie_name = settings.SIMPLE_JWT.get("REFRESH_COOKIE", "refresh_token")
        
        response.delete_cookie(access_cookie_name, path='/')
        response.delete_cookie(refresh_cookie_name, path='/')
        
        return response


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """Déconnexion : efface les cookies JWT côté client."""
    response = Response(
        {'success': True, 'message': 'Déconnecté avec succès.'},
        status=status.HTTP_200_OK,
    )
    access_cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "acs_access_token")
    refresh_cookie_name = settings.SIMPLE_JWT.get("REFRESH_COOKIE", "acs_refresh_token")
    response.delete_cookie(access_cookie_name, path='/')
    response.delete_cookie(refresh_cookie_name, path='/')
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def documents_search_view(request):
    """Recherche rapide de documents pour la barre globale.

    Permet de taper un mélange de client / exercice / risque / type de courrier /
    référence / titre, avec une normalisation robuste (suppression des accents,
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

    # Limite de sécurité pour éviter de charger tous les documents en mémoire
    # En production avec beaucoup de documents, utiliser une recherche full-text PostgreSQL
    MAX_DOCUMENTS_TO_SCAN = 5000
    documents = list(
        Document.objects.select_related('categorie', 'risque__exercice__client')
        .order_by('-cree_le')[:MAX_DOCUMENTS_TO_SCAN]
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
    """Vérifie et consomme une partie du quota LLM mensuel de l'utilisateur.

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
        return Response({'detail': 'estimated_tokens doit être > 0'}, status=status.HTTP_400_BAD_REQUEST)

    purpose = data.get('purpose') or 'answer'
    ts_str = data.get('timestamp')
    ts = parse_datetime(ts_str) if ts_str else None

    decision = consume_quota(utilisateur, estimated, purpose, ts)
    return Response(decision, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def llm_usage_log(request):
    """Journalise un appel LLM (usage réel en tokens).

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
    """Retourne l'état du quota LLM courant pour l'utilisateur.

    Réponse:
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
    """Retourne un état de santé technique de l'assistant LLM.

    Vérifie la configuration de base du provider LLM (provider, clés, URLs).

    Réponse JSON minimale:
    {
      "provider": "claude" | "mistral" | "openai" | ...,
      "llm_enabled": true/false,
      "config_ok": true/false,
      "errors": ["..."] ,
    }
    """

    utilisateur = request.user
    if utilisateur.role not in ['ADMIN']:
        return Response({'detail': 'Accès réservé aux administrateurs'}, status=status.HTTP_403_FORBIDDEN)

    provider = (getattr(settings, 'ASSISTANT_LLM_PROVIDER', 'openai') or 'openai').lower()
    llm_enabled = (str(getattr(settings, 'ASSISTANT_LLM_ENABLED', 'true')).lower() != 'false')

    errors: list[str] = []

    # Vérifier la configuration selon le provider déclaré
    if not llm_enabled:
        errors.append('LLM désactivé via ASSISTANT_LLM_ENABLED=false')
    else:
        if provider in ('openai',):
            api_key = getattr(settings, 'ASSISTANT_LLM_API_KEY', None) or getattr(settings, 'OPENAI_API_KEY', None)
            base_url = getattr(settings, 'ASSISTANT_LLM_BASE_URL', 'https://api.openai.com/v1')
            if not api_key:
                errors.append('Clé API OpenAI manquante (ASSISTANT_LLM_API_KEY ou OPENAI_API_KEY)')
            if not isinstance(base_url, str) or not base_url:
                errors.append('ASSISTANT_LLM_BASE_URL invalide ou vide')
        elif provider in ('claude', 'anthropic'):
            claude_key = getattr(settings, 'CLAUDE_API_KEY', None) or getattr(settings, 'ANTHROPIC_API_KEY', None)
            claude_url = getattr(settings, 'CLAUDE_BASE_URL', 'https://api.anthropic.com/v1')
            if not claude_key:
                errors.append('Clé API Claude/Anthropic manquante (CLAUDE_API_KEY ou ANTHROPIC_API_KEY)')
            if not isinstance(claude_url, str) or not claude_url:
                errors.append('CLAUDE_BASE_URL invalide ou vide')
        elif provider == 'mistral':
            mistral_key = getattr(settings, 'MISTRAL_API_KEY', None)
            mistral_url = getattr(settings, 'MISTRAL_BASE_URL', 'https://api.mistral.ai/v1')
            if not mistral_key:
                errors.append('Clé API Mistral manquante (MISTRAL_API_KEY)')
            if not isinstance(mistral_url, str) or not mistral_url:
                errors.append('MISTRAL_BASE_URL invalide ou vide')
        else:
            # Providers compatibles OpenAI custom ou locaux
            base_url = getattr(settings, 'ASSISTANT_LLM_BASE_URL', None)
            if not base_url:
                errors.append(f'Provider LLM "{provider}" non reconnu et ASSISTANT_LLM_BASE_URL non défini')

    config_ok = llm_enabled and not errors

    data = {
        'provider': provider,
        'llm_enabled': llm_enabled,
        'config_ok': bool(config_ok),
        'errors': errors,
    }

    logging.info(
        "ASSISTANT_HEALTH provider=%s enabled=%s config_ok=%s errors=%s",
        provider,
        llm_enabled,
        bool(config_ok),
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
        return Response({'detail': 'Accès réservé aux administrateurs'}, status=status.HTTP_403_FORBIDDEN)

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
    """Historique détaillé des requêtes LLM (admin uniquement).

    Query params:
    - utilisateur_id: filtrer par utilisateur
    - provider: filtrer par provider (mistral, openai)
    - purpose: filtrer par purpose (router, answer, summary)
    - limit: nombre de résultats (défaut 100, max 500)
    """

    utilisateur = request.user
    if utilisateur.role not in ['ADMIN']:
        return Response({'detail': 'Accès réservé aux administrateurs'}, status=status.HTTP_403_FORBIDDEN)

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

        if request.user.role != 'ADMIN':
            return Response({'erreur': "Seuls les administrateurs peuvent modifier les mots de passe."}, status=status.HTTP_403_FORBIDDEN)

        ancien_mdp = request.data.get('ancien_mot_de_passe') or request.data.get('ancienMotDePasse')
        nouveau_mdp = request.data.get('nouveau_mot_de_passe') or request.data.get('nouveauMotDePasse')

        if not nouveau_mdp:
            return Response({'erreur': 'Le nouveau mot de passe est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(nouveau_mdp) < 8:
            return Response({'erreur': 'Le nouveau mot de passe doit contenir au moins 8 caractères.'}, status=status.HTTP_400_BAD_REQUEST)

        # Si l'administrateur modifie son propre mot de passe, l'ancien est requis par sécurité
        if str(request.user.id) == str(utilisateur.id):
            if not ancien_mdp:
                return Response({'erreur': "Merci d'indiquer votre mot de passe actuel."}, status=status.HTTP_400_BAD_REQUEST)
            if not utilisateur.check_password(ancien_mdp):
                return Response({'erreur': 'Le mot de passe actuel est incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        utilisateur.set_password(nouveau_mdp)
        utilisateur.save(update_fields=['password'])

        return Response({'success': True, 'message': 'Mot de passe modifié avec succès.'}, status=status.HTTP_200_OK)


class ClientViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les clients"""
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'  # Les clients font partie de la gestion documentaire

    # Pas de pagination côté API pour permettre à l'interface de gérer sa propre pagination
    pagination_class = None

    def get_serializer_class(self):
        """Retourner une version légère si ?simple=1 est demandé pour la liste."""
        request = getattr(self, 'request', None)
        if self.action == 'list' and request is not None:
            simple = (request.query_params.get('simple') or '').lower()
            if simple in ('1', 'true', 'yes'):
                return ClientSimpleSerializer
        return ClientSerializer

    def get_queryset(self):
        queryset = Client.objects.all()

        # Recherche plein texte sur le nom (paramètre ?search=)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(Q(nom__icontains=search) | Q(numero_client__icontains=search))

        # Filtre par type de client (ENTREPRISE / PARTICULIER) via ?type=
        type_param = self.request.query_params.get('type') or None
        if type_param:
            queryset = queryset.filter(type=type_param)

        # Respecter le paramètre d'ordering si fourni, sinon trier par nom
        ALLOWED_CLIENT_ORDERINGS = {'nom', '-nom', 'numero_client', '-numero_client', 'cree_le', '-cree_le'}
        ordering = self.request.query_params.get('ordering') or None
        if ordering and ordering in ALLOWED_CLIENT_ORDERINGS:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('nom')

        return queryset


class ExerciceViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les exercices"""
    queryset = Exercice.objects.all()
    serializer_class = ExerciceSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'
    pagination_class = None

    def get_serializer_class(self):
        """Version légère pour les listes avec ?simple=1 (sans risques imbriqués)."""
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
                # Cas spécial flotte/groupe : pour une ENTREPRISE, inclure à la fois
                # ses exercices propres et ceux de ses membres (particuliers rattachés).
                if client.type == 'ENTREPRISE':
                    queryset = queryset.filter(
                        Q(client=client) | Q(client__entreprise_parente=client)
                    )
                else:
                    queryset = queryset.filter(client=client)

        # Pour les usages "simples" (recherche avancée), permettre de limiter
        # le nombre de résultats via ?page_size=...
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
    """ViewSet pour gérer les risques"""
    queryset = Risque.objects.all()
    serializer_class = RisqueSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'

    def get_serializer_class(self):
        """Version légère pour les listes avec ?simple=1 (type uniquement)."""
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
    """ViewSet pour gérer les documents"""
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    ressource = 'documents'
    
    def get_queryset(self):
        """Filtrer les documents selon les paramètres"""
        queryset = Document.objects.select_related(
            'categorie',
            'auteur',
            'risque__exercice__client',
        ).all()

        ALLOWED_ORDERINGS = {
            'cree_le', '-cree_le', 'titre', '-titre',
            'date_document', '-date_document', 'taille_fichier', '-taille_fichier',
        }
        ordering = self.request.query_params.get('ordering')
        if ordering and ordering in ALLOWED_ORDERINGS:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-cree_le')
        
        # Filtrer par risque
        risque_id = self.request.query_params.get('risque', None)
        if risque_id:
            queryset = queryset.filter(risque_id=risque_id)
        
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

        ALLOWED_MIME_TYPES = {
            'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
            'image/gif', 'image/webp', 'image/tiff',
        }
        fichier_mime = (fichier.content_type or '').split(';')[0].strip().lower()
        if fichier_mime not in ALLOWED_MIME_TYPES:
            return Response(
                {'erreur': f'Type de fichier non autorisé : {fichier_mime}. Formats acceptés : PDF, JPEG, PNG, GIF, WEBP, TIFF.'},
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
            logging.exception("Erreur lors de la création du document")
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
    """ViewSet pour gérer les conversations de l'assistant IA"""

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
    """ViewSet pour gérer les messages de l'assistant IA"""

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
            raise PermissionDenied("Vous ne pouvez pas écrire dans une conversation qui ne vous appartient pas.")

        message = serializer.save()

        # Si c'est un message utilisateur, générer une réponse avec contexte
        if message.role == 'USER':
            self.generate_assistant_response(message, conversation)

        conversation.dernier_message_le = message.cree_le
        conversation.nombre_messages = (conversation.nombre_messages or 0) + 1
        conversation.save(update_fields=['dernier_message_le', 'nombre_messages'])

    def generate_assistant_response(self, user_message, conversation):
        """Génère une réponse assistant en utilisant le contexte documentaire"""
        try:
            # Restaurer le contexte documentaire
            current_doc = conversation.memoire_etat.get('current_document')
            if current_doc:
                # Utiliser le document contextuel pour la recherche
                from .search_index import get_document_index
                index = get_document_index()
                
                # Rechercher dans le document spécifique
                search_results = index.search_tfidf(
                    user_message.contenu, 
                    top_k=3,
                    document_ids=[current_doc['document_id']]
                )
                
                # Générer la réponse avec le contexte
                response_content = f"Basé sur le document '{current_doc['document_titre']}', je peux analyser votre question.\n\n"
                if search_results:
                    response_content += "Voici ce que j'ai trouvé dans le document :\n\n"
                    for payload, score in search_results[:2]:
                        response_content += f"- {payload.get('titre', 'Section')} : {payload.get('description', '')[:200]}...\n"
                else:
                    response_content += "Je n'ai pas trouvé d'information spécifique dans ce document pour votre question."
                
                # Créer la réponse assistant
                AssistantMessage.objects.create(
                    conversation=conversation,
                    role='ASSISTANT',
                    contenu=response_content,
                    metadata={
                        'context_used': True,
                        'document_id': current_doc['document_id'],
                        'document_titre': current_doc['document_titre']
                    }
                )
            else:
                AssistantMessage.objects.create(
                    conversation=conversation,
                    role='ASSISTANT',
                    contenu="Veuillez d'abord sélectionner un document en cliquant dessus dans les résultats de recherche pour que je puisse vous répondre précisément.",
                    metadata={'context_used': False, 'hint_given': True}
                )
                
        except Exception as e:
            logging.error(f"Erreur génération réponse assistant: {e}")
            # Réponse de fallback
            AssistantMessage.objects.create(
                conversation=conversation,
                role='ASSISTANT',
                contenu="Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
                metadata={'error': str(e)}
            )


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
        return Response({'detail': 'Aucun message correspondant à cet interactionId'}, status=status.HTTP_404_NOT_FOUND)

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
    """Statistiques synthétiques pour le tableau de bord"""
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
@permission_classes([IsAuthenticated])
def assistant_valid_clients_view(request):
    """
    Retourne la liste des codes/noms de clients valides pour validation.
    Utilisé par le frontend pour éviter les faux positifs dans la détection de clients.
    Note: Endpoint Django simple (sans DRF) pour éviter les problèmes d'authentification.
    
    Retourne:
    - codes: Set de tous les identifiants valides (mots individuels) en majuscules
    - clients: Liste des noms complets de clients pour la recherche floue
    """
    clients = Client.objects.all().values_list('nom', 'numero_client')
    
    valid_codes = set()
    full_names = []
    
    for nom, numero in clients:
        if nom:
            nom_upper = nom.upper()
            full_names.append(nom_upper)
            # Ajouter le nom complet
            valid_codes.add(nom_upper)
            # Ajouter aussi les mots individuels du nom (ex: "AFRICA RICE" → "AFRICA", "RICE")
            # Nettoyer les caractères spéciaux comme - et _
            cleaned = nom_upper.replace('-', ' ').replace('_', ' ')
            for word in cleaned.split():
                if len(word) >= 2:
                    valid_codes.add(word)
        if numero:
            valid_codes.add(numero.upper())
    
    return JsonResponse({
        'codes': sorted(list(valid_codes)),
        'clients': sorted(full_names),
        'count': len(valid_codes),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def ocr_quality_report_view(request):
    """
    Génère un rapport de qualité OCR pour identifier les documents à re-scanner.
    
    Paramètres:
    - limit: Nombre max de documents à analyser (défaut: 100)
    - threshold: Seuil de score pour priorisation (défaut: 0.4)
    - client: Filtrer par client (optionnel)
    - exercice: Filtrer par année/exercice (optionnel)
    
    Retourne:
    - documents_a_rescanner: Liste des documents avec score < threshold
    - statistiques: Répartition par niveau de qualité
    """
    from .ocr import calculer_score_qualite_ocr
    
    limit = int(request.query_params.get('limit', 100))
    threshold = float(request.query_params.get('threshold', 0.4))
    client_filter = request.query_params.get('client')
    exercice_filter = request.query_params.get('exercice')
    
    # Construire la requête de base
    queryset = Document.objects.select_related(
        'risque__exercice__client'
    ).prefetch_related('chunks')
    
    # Appliquer les filtres
    if client_filter:
        queryset = queryset.filter(risque__exercice__client__nom__icontains=client_filter)
    if exercice_filter:
        queryset = queryset.filter(risque__exercice__annee=exercice_filter)
    
    # Limiter aux documents PDF (ceux qui ont potentiellement besoin d'OCR)
    queryset = queryset.filter(
        Q(type_fichier__icontains='pdf') | 
        Q(chemin_fichier__iendswith='.pdf')
    )
    
    # Analyser les documents
    documents_analyses = []
    stats = {'bon': 0, 'moyen': 0, 'faible': 0, 'sans_contenu': 0}
    
    for doc in queryset[:limit * 2]:  # Prendre plus pour avoir assez après filtrage
        # Récupérer le contenu des chunks
        chunks = doc.chunks.all().order_by('ordre')
        contenu = '\n'.join([c.texte for c in chunks if c.texte])
        
        if not contenu or len(contenu) < 50:
            stats['sans_contenu'] += 1
            if len(documents_analyses) < limit:
                documents_analyses.append({
                    'id': doc.id,
                    'titre': doc.titre,
                    'client': doc.risque.exercice.client.nom if doc.risque and doc.risque.exercice else None,
                    'exercice': doc.risque.exercice.annee if doc.risque and doc.risque.exercice else None,
                    'score': 0,
                    'niveau': 'sans_contenu',
                    'priorite_rescan': True,
                    'caracteres': 0,
                })
            continue
        
        # Calculer le score de qualité
        qualite = calculer_score_qualite_ocr(contenu)
        stats[qualite['niveau']] += 1
        
        # Ajouter si score < threshold ou si on n'a pas assez de documents
        if qualite['score'] < threshold and len(documents_analyses) < limit:
            documents_analyses.append({
                'id': doc.id,
                'titre': doc.titre,
                'client': doc.risque.exercice.client.nom if doc.risque and doc.risque.exercice else None,
                'exercice': doc.risque.exercice.annee if doc.risque and doc.risque.exercice else None,
                'score': qualite['score'],
                'niveau': qualite['niveau'],
                'priorite_rescan': qualite['priorite_rescan'],
                'caracteres': len(contenu),
                'details': qualite['details'],
            })
    
    # Trier par score croissant (les pires en premier)
    documents_analyses.sort(key=lambda x: x['score'])
    
    return Response({
        'documents_a_rescanner': documents_analyses[:limit],
        'statistiques': {
            'total_analyses': sum(stats.values()),
            'repartition': stats,
            'seuil_utilise': threshold,
        },
        'recommandations': {
            'priorite_haute': len([d for d in documents_analyses if d['score'] < 0.3]),
            'priorite_moyenne': len([d for d in documents_analyses if 0.3 <= d['score'] < 0.4]),
        }
    })


setattr(ocr_quality_report_view, 'ressource', 'documents')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_stats_view(request):
    """Statistiques agrégées optimisées pour l'assistant IA"""

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

    # Totaux de clients pour permettre à l'assistant de répondre de manière
    # fiable aux questions de type "combien de clients" sans deviner à
    # partir d'un échantillon de documents.
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

    # Construire l'URL de fichier directement depuis chemin_fichier
    fichier_url = None
    if document.chemin_fichier:
        # Toujours retourner une URL relative /media/... pour que le frontend puisse l'utiliser
        chemin = str(document.chemin_fichier)
        if chemin.startswith(('http://', 'https://')):
            parsed = urlparse(chemin)
            chemin = parsed.path or chemin

        if chemin.startswith('/media/'):
            fichier_url = chemin
        elif chemin.startswith('media/'):
            fichier_url = f'/{chemin}'
        else:
            fichier_url = f"/media/{chemin.lstrip('/')}"

    # Récupérer le contenu OCR depuis les chunks si disponible
    contenu_complet = document.description or ''
    try:
        chunks = document.chunks.all().order_by('ordre')
        if chunks.exists():
            textes_chunks = [chunk.texte for chunk in chunks if chunk.texte]
            if textes_chunks:
                contenu_complet = '\n'.join(textes_chunks)
    except Exception as e:
        logging.debug(f"Impossible de récupérer les chunks pour {document.id}: {e}")

    return {
        'id': str(document.id),
        'titre': document.titre,
        'description': contenu_complet,
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
    """Normaliser une chaîne pour les recherches plein texte (accents, casse, espaces).

    Cette fonction est utilisée pour la recherche rapide afin de rendre robustes les
    correspondances sur les noms de clients, années d'exercice, types de risques et
    types de courrier, y compris lorsque l'utilisateur tape sans accents ou avec des
    séparateurs différents.
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
        # Ne pas utiliser cree_le comme date_document : seule la date réelle (si renseignée)
        # est conservée, et l'année d'exercice sert de référence principale pour les recherches.
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
        highlights.append(f"Catégorie : {metadata['categorie']}")
    if metadata.get('type'):
        highlights.append(f"Type : {metadata['type']}")
    if metadata.get('reference'):
        highlights.append(f"Référence : {metadata['reference']}")
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
        lignes.append(f"Référence : {metadata['reference']}")
    if metadata.get('type'):
        lignes.append(f"Type de courrier : {metadata['type']}")
    if metadata.get('categorie'):
        lignes.append(f"Catégorie : {metadata['categorie']}")
    if metadata.get('date_document'):
        lignes.append(f"Date : {metadata['date_document'][:10]}")
    return '\n'.join(lignes) or 'Informations limitées sur ce document.'


def _build_assistant_result(payload: dict, score: float, *, is_fallback: bool = False) -> dict:
    metadata = _build_document_metadata(payload)
    if is_fallback:
        metadata['isFallback'] = True
    highlights = _build_document_highlights(metadata)
    content = _build_document_content(payload, metadata)
    
    # Ajouter le contexte documentaire pour l'assistant
    document_context = {
        'document_id': payload['id'],
        'document_titre': payload['titre'],
        'document_content': payload.get('description', ''),
        'chunk_page': payload.get('chunk_page'),
        'chunk_ordre': payload.get('chunk_ordre'),
        'search_score': round(float(score), 6)
    }
    
    return {
        'id': payload['id'],
        'titre': payload['titre'],
        'score': round(float(score), 6),
        'metadata': metadata,
        'highlights': highlights,
        'content': content,
        'document_context': document_context,  # 
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


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_document_search_by_reference_view(request):
    """
    Recherche exacte de documents par référence pour l'assistant IA.
    Retourne uniquement le(s) document(s) correspondant exactement à la référence demandée.

    Paramètres:
    - reference: référence exacte du document (ex: N°96, 96, N96)
    """
    reference_param = request.query_params.get('reference', '').strip()

    if not reference_param:
        return Response({'resultats': [], 'message': 'Paramètre reference requis'})

    # Normaliser la référence: extraire le numéro et chercher avec différents formats
    # Extraire le numéro de la référence (ex: "N°96" -> "96", "N96" -> "96", "96" -> "96")
    numero_match = re.search(r'(\d+)', reference_param)
    if not numero_match:
        return Response({'resultats': [], 'message': 'Aucun numéro trouvé dans la référence'})

    numero = numero_match.group(1)
    # Variante sans zéros en tête (ex: 0757 -> 757) pour matcher les deux représentations
    numero_sans_zeros = numero.lstrip('0') or '0'

    # Chercher avec différents formats de référence
    formats_reference = [
        f"N°{numero}",
        f"N° {numero}",
        f"N{numero}",
        numero,
    ]
    if numero_sans_zeros != numero:
        formats_reference.extend([
            f"N°{numero_sans_zeros}",
            f"N° {numero_sans_zeros}",
            f"N{numero_sans_zeros}",
            numero_sans_zeros,
        ])

    # Construire la requête avec OR sur tous les formats
    query = Q()
    for fmt in formats_reference:
        # Certains documents ont reference NULL mais contiennent le N° dans le titre
        query |= Q(reference__iexact=fmt)
        query |= Q(titre__icontains=fmt)
        query |= Q(chemin_fichier__icontains=fmt)

    documents = Document.objects.select_related('risque__exercice__client').filter(query)[:10]

    resultats = []
    for doc in documents:
        client_nom = doc.risque.exercice.client.nom if doc.risque and doc.risque.exercice else 'Client inconnu'
        # Construire l'URL du fichier pour la prévisualisation
        fichier_url = f"/media/{doc.chemin_fichier}" if doc.chemin_fichier else None
        resultats.append({
            'id': str(doc.id),
            'titre': doc.titre or 'Sans titre',
            'reference': doc.reference or '',
            'type_courrier': doc.type_courrier or '',
            'client': client_nom,
            'exercice': doc.risque.exercice.annee if doc.risque and doc.risque.exercice else '',
            'risque': doc.risque.type if doc.risque else '',
            'date_document': doc.date_document.isoformat() if doc.date_document else None,
            'cree_le': doc.cree_le.isoformat(),
            'chemin_fichier': doc.chemin_fichier or '',
            'fichier_url': fichier_url,
            'metadata': {}
        })

    return Response({
        'resultats': resultats,
        'reference_recherchee': reference_param,
        'formats_testes': formats_reference
    })


setattr(assistant_document_search_by_reference_view, 'ressource', 'documents')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_document_search_filtered_view(request):
    """
    Recherche de documents avec filtres multiples pour l'assistant IA.
    Supporte les filtres: client, exercice, risque, type_document, type_courrier.

    Paramètres:
    - q: requête textuelle (optionnel)
    - client: nom ou code client
    - exercice: année de l'exercice
    - risque: type de risque (ex: responsabilite civile, sante, auto)
    - type_document: type de document (ex: avenant, facture, contrat)
    - type_courrier: type de courrier (ex: ACS_VERS_CLIENT)
    - top_k: nombre de résultats (défaut: 10)
    """
    query = request.query_params.get('q', '').strip()
    client_filter = request.query_params.get('client', '').strip()
    exercice_filter = request.query_params.get('exercice', '').strip()
    risque_filter = request.query_params.get('risque', '').strip()
    type_document_filter = request.query_params.get('type_document', '').strip()
    type_courrier_filter = request.query_params.get('type_courrier', '').strip()

    try:
        top_k = int(request.query_params.get('top_k', 10))
    except ValueError:
        top_k = 10

    # Construire la requête avec filtres
    queryset = Document.objects.select_related('risque__exercice__client')

    # Filtre par client (nom ou numero_client)
    if client_filter:
        queryset = queryset.filter(
            Q(risque__exercice__client__nom__iexact=client_filter) |
            Q(risque__exercice__client__numero_client__iexact=client_filter)
        )
        logging.info(f"Filtre client: {client_filter}")

    # Filtre par exercice (année)
    if exercice_filter:
        try:
            annee = int(exercice_filter)
            queryset = queryset.filter(risque__exercice__annee=annee)
            logging.info(f"Filtre exercice: {annee}")
        except ValueError:
            pass

    # Filtre par risque (type) - robuste aux variantes (casse/accents/typos)
    if risque_filter:

        def _norm(s: str) -> str:
            s = (s or '').strip().lower().replace('_', ' ')
            s = unicodedata.normalize('NFKD', s)
            s = ''.join(ch for ch in s if not unicodedata.combining(ch))
            s = re.sub(r"[^0-9a-z]+", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            return s

        risque_norm = _norm(risque_filter)
        raw_tokens = [t for t in risque_norm.split(' ') if t]
        tokens = [t for t in raw_tokens if len(t) >= 3 and not t.isdigit()]

        # Groupes de synonymes/abréviations observés en base
        # Chaque groupe produit un OR; les groupes sélectionnés sont combinés en AND.
        synonym_groups = {
            'rc': ['rc', 'responsabilite', 'responsabilite civile', 'responsabilite  civile', 'responabilite', 'responabilite civile'],
            'auto': ['auto', 'automobile'],
            'sante': ['sante', 'sant'],  # couvre aussi des valeurs dégradées type 'Sant??'
            'mrp': ['mrp', 'professionnel', 'professionnelle', 'proffessionnelle', 'professionnelle (mrp)'],
            'mri': ['mri', 'm r i', 'immeuble', 'immeubles', 'multirisque immeuble'],
            'multirisque': ['multirisque', 'multirisques'],
            'reglement': ['reglement', 'reglements'],
            'transport_facultes': ['transport', 'facultes', 'faculte'],
        }

        def _group_q(patterns: list[str]) -> Q:
            q = Q()
            for p in patterns:
                p_norm = _norm(p)
                if p_norm:
                    q |= Q(risque__type__icontains=p_norm)
            return q

        selected_groups: list[Q] = []

        # Sélection des groupes en fonction des tokens
        token_set = set(tokens)
        if 'rc' in token_set or ('responsabilite' in token_set and 'civile' in token_set) or ('responsabilite' in token_set and 'civil' in token_set) or ('responabilite' in token_set):
            selected_groups.append(_group_q(synonym_groups['rc']))
        if 'auto' in token_set or 'automobile' in token_set:
            selected_groups.append(_group_q(synonym_groups['auto']))
        if 'sante' in token_set or 'sant' in token_set:
            selected_groups.append(_group_q(synonym_groups['sante']))

        # Multirisque: distinguer IMMEUBLE (MRI) vs PROFESSIONNELLE (MRP) quand précisé
        if 'immeuble' in token_set or 'mri' in token_set:
            # Exiger multirisque + immeuble (ou équivalents) pour éviter MRP
            selected_groups.append(_group_q(synonym_groups['mri']))
            selected_groups.append(_group_q(synonym_groups['multirisque']))
        if 'professionnelle' in token_set or 'professionnel' in token_set or 'mrp' in token_set or 'proffessionnelle' in token_set:
            selected_groups.append(_group_q(synonym_groups['mrp']))
            selected_groups.append(_group_q(synonym_groups['multirisque']))
        if 'multirisque' in token_set and ('immeuble' not in token_set and 'mri' not in token_set and 'mrp' not in token_set and 'professionnelle' not in token_set and 'professionnel' not in token_set):
            # multirisque non précisé => volontairement large
            selected_groups.append(_group_q(synonym_groups['multirisque']))

        if 'reglement' in token_set or 'reglements' in token_set:
            selected_groups.append(_group_q(synonym_groups['reglement']))

        if 'transport' in token_set or 'facultes' in token_set or 'faculte' in token_set:
            # Exiger les 2 composantes si l'une est présente
            selected_groups.append(_group_q(synonym_groups['transport_facultes']))

        # Base: tokenisation AND sur les tokens significatifs
        base_q = Q()
        for t in tokens:
            base_q &= Q(risque__type__icontains=t)

        risque_query = base_q
        for gq in selected_groups:
            risque_query &= gq

        queryset = queryset.filter(risque_query)
        logging.info(f"Filtre risque: {risque_filter}")

    # Filtre par type de document (dans le titre ou type_courrier)
    if type_document_filter:
        type_doc_lower = type_document_filter.lower()
        queryset = queryset.filter(
            Q(titre__icontains=type_doc_lower) |
            Q(type_courrier__icontains=type_doc_lower)
        )
        logging.info(f"Filtre type_document: {type_document_filter}")

    # Filtre par type de courrier
    if type_courrier_filter:
        queryset = queryset.filter(type_courrier__iexact=type_courrier_filter)
        logging.info(f"Filtre type_courrier: {type_courrier_filter}")

    # Si une requête textuelle est fournie, filtrer aussi par titre (tokenisation)
    if query:
        stopwords = {
            'de', 'du', 'des', 'd', 'la', 'le', 'les', 'un', 'une', 'et', 'ou',
            'client', 'risque', 'annee', 'année', 'exercice', 'type', 'document',
        }
        raw_tokens = re.split(r"[^0-9A-Za-zÀ-ÖØ-öø-ÿ]+", query.lower())
        tokens = [t for t in raw_tokens if t and len(t) >= 3 and t not in stopwords and not t.isdigit()]
        if tokens:
            text_q = Q()
            for t in tokens:
                text_q |= Q(titre__icontains=t)
            queryset = queryset.filter(text_q)

    # Limiter et récupérer les résultats
    documents = queryset.order_by('-cree_le')[:top_k]

    resultats = []
    for doc in documents:
        client_nom = doc.risque.exercice.client.nom if doc.risque and doc.risque.exercice else 'Client inconnu'
        fichier_url = f"/media/{doc.chemin_fichier}" if doc.chemin_fichier else None
        resultats.append({
            'id': str(doc.id),
            'titre': doc.titre or 'Sans titre',
            'reference': doc.reference or '',
            'type_courrier': doc.type_courrier or '',
            'client': client_nom,
            'exercice': doc.risque.exercice.annee if doc.risque and doc.risque.exercice else '',
            'risque': doc.risque.type if doc.risque else '',
            'date_document': doc.date_document.isoformat() if doc.date_document else None,
            'cree_le': doc.cree_le.isoformat(),
            'chemin_fichier': doc.chemin_fichier or '',
            'fichier_url': fichier_url,
        })

    return Response({
        'results': resultats,
        'filtres_appliques': {
            'client': client_filter or None,
            'exercice': exercice_filter or None,
            'risque': risque_filter or None,
            'type_document': type_document_filter or None,
            'type_courrier': type_courrier_filter or None,
            'query': query or None,
        },
        'total': len(resultats),
        'method': 'filtered'
    })


setattr(assistant_document_search_filtered_view, 'ressource', 'documents')


def assistant_semantic_search_view(request):
    """
    Recherche avancee TF-IDF pour l'assistant IA avec support des chunks PDF.
    
    Parametres de filtre optionnels :
    - client: code client (ex: 3CB)
    - exercice: annee de l'exercice (ex: 2018)
    - risque: type de risque (ex: sante)
    - top_k: nombre de resultats a retourner (defaut: 5, max: 20)
    - max_docs: nombre maximum de documents a analyser (defaut: 100, max: 500)
    """
    query = request.data.get('query', '').strip()
    if not query:
        return Response({'error': 'La requete est vide'}, status=status.HTTP_400_BAD_REQUEST)

    include_fallback = str(request.data.get('include_fallback', 'false')).lower() == 'true'

    client_filter = request.data.get('client')
    exercice_filter = request.data.get('exercice')
    risque_filter = request.data.get('risque')
    top_k = min(int(request.data.get('top_k', 5)), 20)
    max_docs = min(int(request.data.get('max_docs', 100)), 500)

    # Construire la requete avec filtres
    queryset = Document.objects.select_related('categorie', 'risque__exercice__client')
    
    if client_filter:
        queryset = queryset.filter(
            Q(risque__exercice__client__nom__iexact=client_filter) |
            Q(risque__exercice__client__numero_client__iexact=client_filter)
        )
    
    if exercice_filter:
        try:
            annee = int(exercice_filter)
            queryset = queryset.filter(risque__exercice__annee=annee)
        except ValueError:
            pass
    
    if risque_filter:
        queryset = queryset.filter(risque__type__icontains=risque_filter)
    
    documents = list(queryset.all()[:max_docs])
    
    if not documents:
        return Response({'results': [], 'method': 'none'})

    payloads = [_build_document_payload(doc, request) for doc in documents]
    corpus = [_build_document_text(payload) for payload in payloads]

    # Privilegier les chunks de documents (texte extrait des PDF) s'ils sont disponibles
    try:
        chunks_qs = DocumentChunk.objects.filter(
            document__in=documents
        ).extra(
            where=["LENGTH(texte) >= 50"]  # Ignorer les chunks trop petits (bruit)
        )
        chunks = list(
            chunks_qs.select_related(
                'document__categorie',
                'document__risque__exercice__client',
            )
        )
    except Exception:
        logging.exception("Erreur lors de la récupération des chunks pour la recherche TF-IDF")
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

    # Générer une clé de cache pour le corpus TF-IDF
    corpus_text = '|'.join(corpus[:50])  # Limiter pour éviter des clés trop longues
    corpus_hash = _get_cache_key(f"{corpus_text}:{client_filter}:{exercice_filter}:{risque_filter}")

    # Tenter de charger le TF-IDF depuis le cache
    cached_vectorizer, cached_matrix = _load_tfidf_from_cache(corpus_hash)
    
    if cached_vectorizer is not None and cached_matrix is not None:
        vectorizer = cached_vectorizer
        tfidf_matrix = cached_matrix
        logging.info("TF-IDF chargé depuis le cache")
    else:
        # Calculer et mettre en cache le TF-IDF
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(corpus)
        _save_tfidf_to_cache(corpus_hash, vectorizer, tfidf_matrix)
        logging.info("TF-IDF calculé et mis en cache")
    
    query_vector = vectorizer.transform([query])
    scores = linear_kernel(query_vector, tfidf_matrix).flatten()

    indexed_scores = list(enumerate(scores.tolist()))

    # Agréger les scores au niveau du document pour éviter de renvoyer plusieurs
    # fois le même document lorsque plusieurs chunks sont pertinents.
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
            # Conserver le meilleur chunk (score le plus élevé) pour chaque document
            doc_best[doc_id] = (score, payload)

    # Trier les documents par score décroissant (meilleur chunk en premier)
    sorted_docs = sorted(doc_best.items(), key=lambda item: item[1][0], reverse=True)

    results = []
    for _, (score, payload) in sorted_docs[: max(top_k, 1)]:
        result = _build_assistant_result(payload, score)
        result['search_method'] = 'tfidf'
        results.append(result)

    # Fallback document si aucun résultat
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
            logging.error("Erreur lors du logging des résultats TF-IDF: %s", log_error)

    return Response({'results': results, 'method': 'tfidf' if results else 'none'})


setattr(assistant_semantic_search_view, 'ressource', 'documents')


@api_view(['POST'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_set_document_context_view(request):
    """Définit le contexte documentaire courant pour l'assistant."""
    try:
        document_id = request.data.get('document_id')
        document_content = request.data.get('document_content', '')
        document_titre = request.data.get('document_titre', '')
        
        if not document_id:
            return Response({'detail': 'document_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Mettre à jour la mémoire de conversation
        conversation_id = request.data.get('conversation_id')
        if conversation_id:
            try:
                conversation = AssistantConversation.objects.get(
                    id=conversation_id, 
                    utilisateur=request.user
                )
                # Sauvegarder le contexte dans la mémoire
                conversation.memoire_etat['current_document'] = {
                    'document_id': document_id,
                    'document_titre': document_titre,
                    'document_content': document_content[:1000],  # Limiter la taille
                    'set_at': timezone.now().isoformat()
                }
                conversation.save(update_fields=['memoire_etat'])
            except AssistantConversation.DoesNotExist:
                pass
        
        return Response({
            'document_id': document_id,
            'document_titre': document_titre,
            'context_set': True
        })
        
    except Exception as e:
        logging.error(f"Erreur set document context: {e}")
        return Response(
            {'detail': 'Erreur lors de la définition du contexte'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


setattr(assistant_set_document_context_view, 'ressource', 'documents')


def call_mistral_api(prompt: str, user_id: str = None) -> dict:
    """Appelle l'API Mistral avec gestion des quotas et logging."""
    if not settings.ASSISTANT_LLM_ENABLED or settings.ASSISTANT_LLM_ENABLED.lower() == 'false':
        return {
            'success': False,
            'error': 'LLM désactivé',
            'content': None
        }
    
    if not settings.MISTRAL_API_KEY:
        return {
            'success': False,
            'error': 'API key Mistral non configurée',
            'content': None
        }
    
    # Vérifier les quotas si activés
    if not settings.ASSISTANT_LLM_QUOTA_DISABLED:
        from .models import LlmMonthlyQuota, LlmUsage
        
        quota, created = LlmMonthlyQuota.objects.get_or_create(
            utilisateur_id=user_id,
            defaults={'tokens_limit': settings.ASSISTANT_LLM_MONTHLY_LIMIT}
        )
        
        if quota.tokens_remaining <= 0:
            return {
                'success': False,
                'error': 'Quota mensuel dépassé',
                'content': None
            }
    
    # Appel à l'API Mistral
    try:
        headers = {
            'Authorization': f'Bearer {settings.MISTRAL_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': settings.MISTRAL_MODEL_DEFAULT,
            'messages': [
                {
                    'role': 'system',
                    'content': 'Tu es un assistant spécialisé dans la gestion d\'archives d\'assurance. Réponds de manière concise et professionnelle en utilisant uniquement les informations fournies.'
                },
                {
                    'role': 'user',
                    'content': prompt
                }
            ],
            'max_tokens': 1000,
            'temperature': 0.3
        }
        
        start_time = time.time()
        
        with httpx.Client(timeout=25.0) as client:
            response = client.post(
                f"{settings.MISTRAL_BASE_URL}/chat/completions",
                headers=headers,
                json=data
            )
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        if response.status_code == 200:
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            # Logging de l'utilisation
            if user_id and not settings.ASSISTANT_LLM_QUOTA_DISABLED:
                LlmUsage.objects.create(
                    utilisateur_id=user_id,
                    purpose='assistant_chat',
                    tokens_input=result['usage']['prompt_tokens'],
                    tokens_output=result['usage']['completion_tokens'],
                    tokens_total=result['usage']['total_tokens'],
                    duration_ms=duration_ms
                )
            
            return {
                'success': True,
                'content': content,
                'duration_ms': duration_ms,
                'tokens': result['usage']
            }
        else:
            logging.error(f"Erreur Mistral API: {response.status_code} - {response.text}")
            return {
                'success': False,
                'error': f'Erreur API: {response.status_code}',
                'content': None
            }
            
    except Exception as e:
        logging.error(f"Erreur lors de l'appel Mistral: {e}")
        return {
            'success': False,
            'error': str(e),
            'content': None
        }


@api_view(['POST'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def assistant_chat_view(request):
    """Endpoint de chat avec contexte documentaire"""
    try:
        question = request.data.get('question', '').strip()
        conversation_id = request.data.get('conversation_id')
        
        if not question:
            return Response({'detail': 'question requise'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not conversation_id:
            return Response({'detail': 'conversation_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Récupérer la conversation
        try:
            conversation = AssistantConversation.objects.get(
                id=conversation_id,
                utilisateur=request.user
            )
        except (AssistantConversation.DoesNotExist, ValueError):
            return Response({'detail': 'Conversation non trouvée'}, status=status.HTTP_404_NOT_FOUND)
        
        # Créer le message utilisateur
        user_message = AssistantMessage.objects.create(
            conversation=conversation,
            role='USER',
            contenu=question,
            metadata={'search_query': question}
        )
        
        # Récupérer le contexte documentaire actuel
        current_doc = conversation.memoire_etat.get('current_document')

        # Rechercher des documents pertinents
        # 1) Fallback “référence” (utile pour des requêtes courtes type "N°96")
        import re
        search_results = []
        ref_match = re.search(r"\b(?:n\s*[°o]?|no)\s*[:\-]?\s*([0-9]{1,6})\b", question, re.IGNORECASE)
        if ref_match:
            ref_raw = ref_match.group(1)
            ref_norm = ref_raw.lstrip('0') or ref_raw
            ref_candidates = []
            for v in (ref_raw, ref_norm):
                if v and v not in ref_candidates:
                    ref_candidates.append(v)

            # Éviter les faux positifs: "96" ne doit pas matcher "966" ou "0596".
            # On matche le nombre seulement quand il est bordé par des non-chiffres (ou début/fin).
            from django.db.models import Q
            query = Q()
            for v in ref_candidates:
                # Match strict sur la colonne reference: bornes numériques.
                boundary_pattern = rf"(^|[^0-9]){re.escape(v)}([^0-9]|$)"
                query |= Q(reference__regex=boundary_pattern)

                # Match sur titre: exiger un préfixe de référence (évite les montants, ex: "96 120 F").
                # Exemples acceptés: "N°96", "N 96", "No: 96", "n-96".
                titre_pattern = rf"\b(?:n\s*[°o]?|no)\s*[:\-]?\s*{re.escape(v)}\b"
                query |= Q(titre__iregex=titre_pattern)

            docs = (
                Document.objects
                .select_related('risque__exercice__client')
                .filter(query)
                .order_by('-cree_le')[:5]
            )

            for doc in docs:
                try:
                    client = doc.risque.exercice.client.code if doc.risque and doc.risque.exercice else None
                    exercice = str(doc.risque.exercice.annee) if doc.risque and doc.risque.exercice else None
                    risque_type = doc.risque.type if doc.risque else None
                except Exception:
                    client = None
                    exercice = None
                    risque_type = None

                payload = {
                    'id': str(doc.id),
                    'titre': doc.titre,
                    'description': (doc.description or ''),
                    'client': client or '',
                    'exercice': exercice or '',
                    'type': getattr(doc, 'type_courrier', '') or '',
                    'date_document': doc.date_document.isoformat() if doc.date_document else '',
                    'fichier_url': f"/media/{doc.chemin_fichier}" if doc.chemin_fichier else '',
                    'reference': doc.reference or '',
                    'risque': risque_type or '',
                }
                search_results.append((payload, 1.0))

        # 2) Fallback “critères” (année / type_courrier / risque / client) pour des requêtes structurées
        if (not search_results) and (not current_doc):
            try:
                from django.db.models import Q
                import unicodedata

                def _norm(s: str) -> str:
                    s = (s or '').strip().lower().replace('_', ' ')
                    s = unicodedata.normalize('NFKD', s)
                    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
                    s = re.sub(r"[^0-9a-z]+", " ", s)
                    s = re.sub(r"\s+", " ", s).strip()
                    return s

                q_norm = _norm(question)

                # Année: on assimile à un exercice (risque__exercice__annee)
                year = None
                year_match = re.search(r"\b(19\d{2}|20\d{2})\b", q_norm)
                if year_match:
                    try:
                        year = int(year_match.group(1))
                    except ValueError:
                        year = None

                # Type courrier: détection de phrases usuelles
                type_courrier = None
                if ('acs' in q_norm and 'compagnie' in q_norm) or 'acs compagnie' in q_norm:
                    type_courrier = 'ACS_VERS_COMPAGNIE'
                elif ('acs' in q_norm and 'client' in q_norm) or 'acs vers client' in q_norm:
                    type_courrier = 'ACS_VERS_CLIENT'

                # Risque (support minimal, on pourra enrichir ensuite)
                risque_token = None
                if 'sante' in q_norm:
                    risque_token = 'sante'
                elif 'auto' in q_norm or 'automobile' in q_norm:
                    risque_token = 'auto'
                elif 'mrp' in q_norm:
                    risque_token = 'mrp'
                elif 'mri' in q_norm:
                    risque_token = 'mri'

                # Client: pattern "client X" (un seul token ou groupe de tokens)
                client_token = None
                client_match = re.search(r"\bclient\s+([a-z0-9]{2,})\b", q_norm)
                if client_match:
                    client_token = client_match.group(1)

                # Montant: pattern pour les montants (ex: "176 914", "176914", "176.914")
                montant_token = None
                montant_match = re.search(r"(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?)", question)
                if montant_match:
                    montant_str = montant_match.group(1).replace(' ', '').replace('.', '').replace(',', '')
                    try:
                        montant_token = int(montant_str)
                    except ValueError:
                        montant_token = None

                # Construire la requête ORM
                qs = Document.objects.select_related('risque__exercice__client')
                if year is not None:
                    qs = qs.filter(risque__exercice__annee=year)
                if type_courrier:
                    qs = qs.filter(type_courrier=type_courrier)
                if risque_token:
                    qs = qs.filter(risque__type__icontains=risque_token)
                if client_token:
                    qs = qs.filter(
                        Q(risque__exercice__client__nom__icontains=client_token)
                        | Q(risque__exercice__client__numero_client__icontains=client_token)
                    )
                if montant_token is not None:
                    # Filtrer par montant dans le titre ou la description
                    # Gérer plusieurs formats : "801066", "801 066", "801.066"
                    montant_variants = [
                        str(montant_token),  # "801066"
                        f"{montant_token:,}".replace(",", " "),  # "801 066"
                        f"{montant_token:,}".replace(",", "."),  # "801.066"
                    ]
                    
                    montant_query = Q()
                    for variant in montant_variants:
                        montant_query |= Q(titre__icontains=variant)
                        montant_query |= Q(description__icontains=variant)
                    
                    qs = qs.filter(montant_query)

                # Si aucun filtre, ne pas lancer ce fallback (évite de ramener du bruit)
                if any([year is not None, type_courrier, risque_token, client_token, montant_token is not None]):
                    docs = qs.order_by('-cree_le')[:5]
                    for doc in docs:
                        try:
                            client = doc.risque.exercice.client.code if doc.risque and doc.risque.exercice else None
                            exercice = str(doc.risque.exercice.annee) if doc.risque and doc.risque.exercice else None
                            risque_type = doc.risque.type if doc.risque else None
                        except Exception:
                            client = None
                            exercice = None
                            risque_type = None

                        payload = {
                            'id': str(doc.id),
                            'titre': doc.titre,
                            'description': (doc.description or ''),
                            'client': client or '',
                            'exercice': exercice or '',
                            'type': getattr(doc, 'type_courrier', '') or '',
                            'date_document': doc.date_document.isoformat() if doc.date_document else '',
                            'fichier_url': f"/media/{doc.chemin_fichier}" if doc.chemin_fichier else '',
                            'reference': doc.reference or '',
                            'risque': risque_type or '',
                        }
                        search_results.append((payload, 0.95))
            except Exception:
                logging.exception("Erreur fallback critères assistant")

        # 3) Sinon, recherche TF-IDF (globale ou restreinte au document courant)
        if not search_results:
            from .search_index import get_document_index
            index = get_document_index()

            if current_doc:
                # Rechercher dans le document spécifique
                search_results = index.search_tfidf(question, top_k=3, document_ids=[current_doc['document_id']])
            else:
                # Recherche globale
                search_results = index.search_tfidf(question, top_k=5)
        
        # Préparer le contexte pour Mistral
        context_docs = []
        pieces = []
        
        if search_results:
            from .models import DocumentChunk
            for payload, score in search_results[:3]:  # Top 3 résultats
                doc_id = payload.get('id')
                # Récupérer le texte OCR/chunks du document (limité pour le prompt)
                chunk_text = ''
                if doc_id:
                    chunks = DocumentChunk.objects.filter(document_id=doc_id).order_by('ordre')[:3]
                    chunk_texts = [c.texte or '' for c in chunks if c.texte and c.texte.strip()]
                    chunk_text = ' '.join(chunk_texts)[:1500]  # Limiter à ~1500 caractères
                description = payload.get('description', '') or ''
                # Utiliser le chunk_text si disponible, sinon la description
                content_for_llm = chunk_text if chunk_text else (description[:500] if description else '')
                doc_context = {
                    'titre': payload.get('titre', 'Document sans titre'),
                    'client': payload.get('client', ''),
                    'exercice': payload.get('exercice', ''),
                    'type': payload.get('type', ''),
                    'date_document': payload.get('date_document', ''),
                    'description': content_for_llm,
                    'score': float(score)
                }
                context_docs.append(doc_context)
                
                pieces.append({
                    'id': payload.get('id', ''),
                    'source': payload.get('titre', ''),
                    'content': content_for_llm,
                    'metadata': {
                        'titre': payload.get('titre', ''),
                        'client': payload.get('client', ''),
                        'exercice': payload.get('exercice', ''),
                        'type': payload.get('type', ''),
                        'date_document': payload.get('date_document', ''),
                        'fichier_url': payload.get('fichier_url', '')
                    },
                    'score': float(score)
                })
        
        # Construire le prompt pour Mistral
        prompt_parts = [
            f"Question de l'utilisateur : {question}",
            "",
            "Contexte documentaire disponible :"
        ]
        
        if context_docs:
            for i, doc in enumerate(context_docs, 1):
                prompt_parts.append(f"{i}. {doc['titre']} (Client: {doc['client']}, Exercice: {doc['exercice']})")
                if doc['description']:
                    prompt_parts.append(f"   Contenu : {doc['description']}")
                prompt_parts.append("")
        else:
            prompt_parts.append("Aucun document pertinent trouvé pour cette question.")
            prompt_parts.append("")
        
        prompt_parts.extend([
            "Instructions :",
            "- Réponds de manière professionnelle et concise",
            "- Base ta réponse UNIQUEMENT sur les documents fournis dans le contexte",
            "- Si les informations sont insuffisantes, indique-le clairement",
            "- Ne jamais inventer d'informations",
            "",
            "Réponse :"
        ])
        
        prompt = "\n".join(prompt_parts)
        
        # Appeler Mistral
        mistral_result = call_mistral_api(prompt, str(request.user.id))
        
        if mistral_result['success']:
            response_content = mistral_result['content']
            metadata = {
                'context_used': True if context_docs else False,
                'search_results_count': len(context_docs),
                'llm_used': True,
                'llm_duration_ms': mistral_result['duration_ms'],
                'llm_tokens': mistral_result['tokens']
            }
        else:
            # Fallback si Mistral échoue
            if context_docs:
                response_content = f"J'ai trouvé {len(context_docs)} documents pertinents pour votre question :\n\n"
                for doc in context_docs[:2]:
                    response_content += f"• {doc['titre']} (Client: {doc['client']}, Exercice: {doc['exercice']})\n"
                    if doc['description']:
                        response_content += f"  {doc['description'][:200]}...\n"
                    response_content += "\n"
                response_content += "L'assistant IA n'est pas disponible actuellement. Voici les documents trouvés."
            else:
                response_content = "Je n'ai pas trouvé de documents pertinents pour votre question. Essayez de reformuler ou d'être plus spécifique sur le client, l'année ou le type de document."
            
            metadata = {
                'context_used': True if context_docs else False,
                'search_results_count': len(context_docs),
                'llm_used': False,
                'llm_error': mistral_result['error']
            }
        
        # Créer la réponse assistant
        assistant_message = AssistantMessage.objects.create(
            conversation=conversation,
            role='ASSISTANT',
            contenu=response_content,
            metadata=metadata
        )
        
        # Mettre à jour la conversation
        conversation.dernier_message_le = assistant_message.cree_le
        conversation.nombre_messages = (conversation.nombre_messages or 0) + 1
        conversation.save(update_fields=['dernier_message_le', 'nombre_messages'])
        
        # Retourner la réponse
        response_data = {
            'question': question,
            'resume': assistant_message.contenu,
            'pieces': pieces,
            'narration': {
                'texte': assistant_message.contenu,
                'source': 'llm' if mistral_result['success'] else 'heuristique',
                'telemetry': {
                    'provider': 'mistral',
                    'model': settings.MISTRAL_MODEL_DEFAULT,
                    'durationMs': mistral_result.get('duration_ms', 0)
                } if mistral_result['success'] else None
            },
            'trace': {
                'mode': 'recherche_document',
                'intent': 'documents',
                'documentSearch': {
                    'totalFound': len(search_results),
                    'filteredFound': len(pieces),
                    'messageNonTrouve': len(pieces) == 0
                },
                'llm': {
                    'used': mistral_result['success'],
                    'provider': 'mistral',
                    'model': settings.MISTRAL_MODEL_DEFAULT,
                    'durationMs': mistral_result.get('duration_ms', 0)
                }
            }
        }
        
        return Response(response_data)
        
    except Exception as e:
        logging.error(f"Erreur assistant chat: {e}")
        return Response(
            {'detail': 'Erreur lors du traitement de votre demande'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


setattr(assistant_chat_view, 'ressource', 'documents')


# ============================================================================
# HEALTHCHECK ENDPOINTS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_verify_view(request):
    """Endpoint de vérification d'authentification pour nginx auth_request.
    Retourne 200 si le token JWT est valide, 401 sinon (géré par DRF automatiquement).
    """
    return Response(status=status.HTTP_200_OK)


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
    from .models import AuditLog
    
    logs = AuditLog.objects.all().order_by('-timestamp')[:100]
    data = [
        {
            'id': log.id,
            'utilisateur': log.utilisateur.nom_utilisateur if log.utilisateur else log.utilisateur_nom,
            'action': log.action,
            'details': log.details,
            'date': log.timestamp.isoformat(),
        }
        for log in logs
    ]
    return Response({'logs': data, 'total': AuditLog.objects.count()})


setattr(audit_log_list, 'ressource', 'audit')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def audit_log_detail(request, log_id):
    """Détail d'un log d'audit."""
    from .models import AuditLog
    
    try:
        log = AuditLog.objects.get(id=log_id)
        return Response({
            'id': log.id,
            'utilisateur': log.utilisateur.nom_utilisateur if log.utilisateur else log.utilisateur_nom,
            'action': log.action,
            'details': log.details,
            'date': log.timestamp.isoformat(),
        })
    except AuditLog.DoesNotExist:
        return Response({'error': 'Log non trouvé'}, status=status.HTTP_404_NOT_FOUND)


setattr(audit_log_detail, 'ressource', 'audit')


@api_view(['GET'])
@permission_classes([IsAuthenticated, RoleBasedPermission])
def audit_log_stats(request):
    """Statistiques des logs d'audit."""
    from .models import AuditLog
    
    total = AuditLog.objects.count()
    return Response({
        'total_logs': total,
    })


setattr(audit_log_stats, 'ressource', 'audit')

