"""
Authentication personnalisée pour lire les JWT depuis les cookies HttpOnly
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from django.conf import settings


class CookieJWTAuthentication(JWTAuthentication):
    """
    Authentication qui lit les JWT depuis les cookies HttpOnly
    """

    def authenticate(self, request):
        """
        Authentification via cookies avec fallback sur header Authorization
        """
        # Récupérer le nom du cookie depuis la configuration
        cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "access_token")
        access_token = request.COOKIES.get(cookie_name)

        if access_token:
            try:
                validated_token = self.get_validated_token(access_token)
                return self.get_user(validated_token), validated_token
            except InvalidToken:
                # Token invalide, on retourne None pour laisser DRF gérer
                return None

        # Fallback: essayer l'authentification par défaut (header Authorization)
        return super().authenticate(request)
