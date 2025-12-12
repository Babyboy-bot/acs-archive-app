from django.utils.deprecation import MiddlewareMixin


class JWTAuthCookieMiddleware(MiddlewareMixin):
    """Ajoute un header Authorization à partir du cookie access_token si absent."""

    def process_request(self, request):
        if request.META.get("HTTP_AUTHORIZATION"):
            return
        token = request.COOKIES.get("access_token")
        if not token:
            return
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
