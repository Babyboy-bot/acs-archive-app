import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from django.conf import settings
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


class JWTAuthCookieMiddleware(MiddlewareMixin):
    """Middleware qui gère l'authentification JWT et le refresh automatique."""

    _SKIP_PATH_PREFIXES = (
        "/api/auth/login/",
        "/api/auth/logout/",
        "/api/auth/refresh/",
    )

    def process_request(self, request):
        path = getattr(request, "path", "") or ""
        for prefix in self._SKIP_PATH_PREFIXES:
            if path.startswith(prefix):
                return
                
        # Si déjà un header Authorization, ne rien faire
        if request.META.get("HTTP_AUTHORIZATION"):
            return
            
        # Récupérer le access token depuis les cookies
        access_token = request.COOKIES.get("access_token")
        if not access_token:
            return
            
        # Ajouter le header Authorization
        token = access_token.strip()
        if token.lower().startswith("bearer "):
            token = token.split(" ", 1)[1]
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"

    def process_response(self, request, response):
        """Gérer le refresh automatique des tokens expirés"""
        
        path = getattr(request, "path", "") or ""
        for prefix in self._SKIP_PATH_PREFIXES:
            if path.startswith(prefix):
                return response
        
        # Si la réponse est une erreur 401, tenter de refresh le token
        if (hasattr(response, 'status_code') and 
            response.status_code == 401):
            
            refresh_token = request.COOKIES.get("refresh_token")
            if not refresh_token:
                return response
                
            try:
                # Tenter de rafraîchir le token
                refresh = RefreshToken(refresh_token)
                new_access_token = str(refresh.access_token)
                
                # Ajouter le nouveau token dans la réponse
                response.set_cookie(
                    'access_token',
                    new_access_token,
                    max_age=60 * 60 * 24 * 7,  # 7 jours
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite='Lax',
                    path='/',
                )
                
                logger.info("Token rafraîchi automatiquement avec succès")
                
            except Exception as e:
                logger.warning(f"Échec du refresh automatique: {e}")
                # Si le refresh échoue, supprimer les cookies invalides
                response.delete_cookie('access_token', path='/')
                response.delete_cookie('refresh_token', path='/')
                
        return response


class JWTAuthenticationMiddleware(MiddlewareMixin):
    """Middleware alternatif pour l'authentification JWT avec refresh intégré."""
    
    _SKIP_PATH_PREFIXES = (
        "/api/auth/login/",
        "/api/auth/logout/",
        "/api/auth/refresh/",
    )
    
    def process_request(self, request):
        """Traiter l'authentification JWT avec refresh automatique."""
        
        path = getattr(request, "path", "") or ""
        for prefix in self._SKIP_PATH_PREFIXES:
            if path.startswith(prefix):
                return None
            
        access_token = request.COOKIES.get("acs_access_token")
        refresh_token = request.COOKIES.get("acs_refresh_token")
        
        if not access_token and not refresh_token:
            return None
        
        access_token_valid = False
        
        # Si on a un access token, essayer de l'utiliser
        if access_token:
            try:
                # Valider le token
                from rest_framework_simplejwt.authentication import JWTAuthentication
                auth = JWTAuthentication()
                result = auth.authenticate(request)
                if result:
                    access_token_valid = True  # Token valide
                    logger.info("Access token valide trouvé")
                    
            except Exception as e:
                # Token invalide ou expiré
                logger.warning(f"Access token invalide: {e}")
                access_token_valid = False
        
        # Si l'access token est invalide ou manquant, essayer de rafraîchir
        if not access_token_valid and refresh_token:
            try:
                logger.info("Tentative de refresh avec refresh token")
                refresh = RefreshToken(refresh_token)
                new_access_token = str(refresh.access_token)
                
                # Mettre à jour le header Authorization pour cette requête
                request.META["HTTP_AUTHORIZATION"] = f"Bearer {new_access_token}"
                
                # Stocker le nouveau token pour l'ajouter à la réponse
                request._new_access_token = new_access_token
                
                logger.info("Token rafraîchi automatiquement avec succès")
                
            except Exception as e:
                logger.warning(f"Échec du refresh: {e}")
                # Supprimer les cookies invalides
                request._clear_tokens = True
                
        return None

    def process_response(self, request, response):
        """Ajouter les nouveaux tokens ou supprimer les invalides."""
        
        # Ajouter le nouveau token s'il a été généré
        if hasattr(request, '_new_access_token'):
            response.set_cookie(
                'acs_access_token',
                request._new_access_token,
                max_age=60 * 60 * 24 * 7,
                httponly=True,
                secure=not settings.DEBUG,
                samesite='Lax',
                path='/',
                domain='acs.localhost'  # Domaine spécifique
            )
            
        # Supprimer les tokens invalides si nécessaire
        if hasattr(request, '_clear_tokens'):
            response.delete_cookie('acs_access_token', path='/', domain='acs.localhost')
            response.delete_cookie('acs_refresh_token', path='/', domain='acs.localhost')
            
        return response
