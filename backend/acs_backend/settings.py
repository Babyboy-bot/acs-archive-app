"""
Django settings for acs_backend project.
"""

import os
import sys
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
# - backend/.env (si présent)
# - .env à la racine du repo (fallback), utile quand on lance runserver depuis backend/
load_dotenv(BASE_DIR.parent / '.env', override=False)
load_dotenv(BASE_DIR / '.env', override=False)

# SECURITY WARNING: keep the secret key used in production secret!
# La clé ne doit jamais avoir de valeur par défaut en clair dans le code.
# Custom User Model
AUTH_USER_MODEL = 'api.Utilisateur'

# Authentication backends
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("SECRET_KEY doit être défini dans les variables d'environnement")

# SECURITY WARNING: don't run with debug turned on in production!
# Par défaut, on considère DEBUG=False si la variable n'est pas définie.
DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,acs.localhost,backend').split(',')

# Désactiver la redirection automatique des URLs sans trailing slash
# Cela évite les redirects qui cassent les requêtes preflight CORS
APPEND_SLASH = False

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',  # Révocation des refresh tokens
    'corsheaders',
    'drf_spectacular',
    
    # Local apps
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # CORS doit être avant CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'api.middleware.JWTAuthenticationMiddleware',  # AVANT AuthenticationMiddleware
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

X_FRAME_OPTIONS = 'SAMEORIGIN'

ROOT_URLCONF = 'acs_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'acs_backend.wsgi.application'

# Database
# Supporte DATABASE_URL (CI/production) ou variables séparées (développement/Docker)
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    # Parse DATABASE_URL format: postgresql://user:password@host:port/dbname
    import urllib.parse
    url = urllib.parse.urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': url.path[1:],
            'USER': url.username,
            'PASSWORD': url.password,
            'HOST': url.hostname,
            'PORT': url.port or '5432',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'acs_archive'),
            'USER': os.getenv('DB_USER', 'acs_user'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'acs_password'),
            'HOST': os.getenv('DB_HOST', 'db'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'api.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'login': '5/minute',
    },
    'DEFAULT_PAGINATION_CLASS': 'api.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 50,
    'DATETIME_FORMAT': '%Y-%m-%dT%H:%M:%S.%fZ',
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# DRF Spectacular (OpenAPI/Swagger)
SPECTACULAR_SETTINGS = {
    'TITLE': 'ACS Archive API',
    'DESCRIPTION': 'API de gestion des archives pour ACS - Application de gestion documentaire pour courtiers en assurance.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'TAGS': [
        {'name': 'Authentification', 'description': 'Endpoints de connexion/déconnexion'},
        {'name': 'Utilisateurs', 'description': 'Gestion des utilisateurs'},
        {'name': 'Clients', 'description': 'Gestion des clients'},
        {'name': 'Documents', 'description': 'Gestion des documents'},
        {'name': 'Exercices', 'description': 'Gestion des exercices comptables'},
        {'name': 'Risques', 'description': 'Gestion des risques'},
        {'name': 'Assistant IA', 'description': 'Endpoints de l\'assistant intelligent'},
        {'name': 'Audit', 'description': 'Journal d\'audit'},
        {'name': 'Statistiques', 'description': 'Statistiques et KPI'},
    ],
}

# JWT Configuration
SIMPLE_JWT = {
    # Durée de vie du token d'accès (par défaut 1 heure pour la sécurité)
    # Le refresh token permet de renouveler automatiquement sans re-login
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),  # Réduit de 30 à 7 jours
    'ROTATE_REFRESH_TOKENS': True,   # Chaque refresh génère un nouveau token
    'BLACKLIST_AFTER_ROTATION': True,  # L'ancien token est blacklisté = révocable
    'UPDATE_LAST_LOGIN': True,
    
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.getenv('JWT_SECRET_KEY', SECRET_KEY),
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    
    # Configuration des cookies pour JWT
    'AUTH_COOKIE': 'acs_access_token',  # Nom unique pour ACS Archive
    'REFRESH_COOKIE': 'acs_refresh_token',  # Nom unique pour ACS Archive
    'AUTH_COOKIE_PATH': '/',
    'REFRESH_COOKIE_PATH': '/',
}

# Paramètres de sécurité supplémentaires activés automatiquement lorsque DEBUG=False.
if not DEBUG:
    # Ne pas rediriger HTTP→HTTPS au niveau Django : Nginx gère le SSL.
    # SECURE_SSL_REDIRECT=True casse les appels serveur-à-serveur Docker (Next.js→backend).
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True

    # Protection type sniffing (X-Content-Type-Options: nosniff)
    SECURE_CONTENT_TYPE_NOSNIFF = True

    # HSTS pour forcer HTTPS côté navigateur
    SECURE_HSTS_SECONDS = 31536000  # 1 an
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Cookies marqués comme sécurisés (transmis uniquement en HTTPS)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    
    # Protection CSRF avec SameSite
    CSRF_COOKIE_SAMESITE = "Lax"  # ou "Strict" pour sécurité maximale
    SESSION_COOKIE_SAMESITE = "Lax"
    
    # Activer la protection CSRF sur toutes les requêtes POST/PUT/DELETE
    USE_TZ = True

# CORS Configuration
# En mode DEBUG, autoriser toutes les origines pour simplifier le développement
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    _cors_allowed_origins_raw = os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3010,http://127.0.0.1:3010,http://localhost:5000,http://127.0.0.1:5000,http://localhost:5001,http://127.0.0.1:5001'
    )
    CORS_ALLOWED_ORIGINS = [
        origin.strip()
        for origin in _cors_allowed_origins_raw.split(',')
        if origin.strip()
    ]

CORS_ALLOW_CREDENTIALS = True

# Chrome peut déclencher un preflight additionnel pour les requêtes vers un réseau privé
# (Access-Control-Request-Private-Network). On peut l'activer explicitement.
CORS_ALLOW_PRIVATE_NETWORK = os.getenv('CORS_ALLOW_PRIVATE_NETWORK', 'False') == 'True'

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# ============================================================================
# Assistant LLM (configuration via backend/.env)
# ============================================================================

ASSISTANT_LLM_ENABLED = os.getenv('ASSISTANT_LLM_ENABLED', 'true').lower() == 'true'
ASSISTANT_LLM_PROVIDER = os.getenv('ASSISTANT_LLM_PROVIDER', 'mistral')
ASSISTANT_LLM_API_KEY = os.getenv('ASSISTANT_LLM_API_KEY') or os.getenv('OPENAI_API_KEY')
ASSISTANT_LLM_BASE_URL = os.getenv('ASSISTANT_LLM_BASE_URL')
ASSISTANT_LLM_MODEL = os.getenv('ASSISTANT_LLM_MODEL')

ASSISTANT_LLM_MONTHLY_LIMIT = int(os.getenv('ASSISTANT_LLM_MONTHLY_LIMIT', '30000'))
# Les quotas LLM sont désactivés par défaut. Pour les réactiver explicitement,
# définir ASSISTANT_LLM_QUOTA_DISABLED=false dans backend/.env.
ASSISTANT_LLM_QUOTA_DISABLED = os.getenv('ASSISTANT_LLM_QUOTA_DISABLED', 'true').lower() == 'true'

CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
CLAUDE_BASE_URL = os.getenv('CLAUDE_BASE_URL', 'https://api.anthropic.com/v1')
CLAUDE_MODEL = os.getenv('CLAUDE_MODEL', 'claude-3-5-sonnet-20241022')

MISTRAL_API_KEY = os.getenv('MISTRAL_API_KEY')
MISTRAL_BASE_URL = os.getenv('MISTRAL_BASE_URL', 'https://api.mistral.ai/v1')
MISTRAL_MODEL_DEFAULT = os.getenv('MISTRAL_MODEL_DEFAULT', 'mistral-medium-latest')
MISTRAL_MODEL_ADVANCED = os.getenv('MISTRAL_MODEL_ADVANCED', 'mistral-large-latest')

# ============================================================================
# OCR (Tesseract)
# ============================================================================

OCR_ENABLED = os.getenv('OCR_ENABLED', 'true').lower() == 'true'
TESSERACT_CMD = os.getenv('TESSERACT_CMD')  # Chemin vers tesseract.exe si non dans PATH
TESSERACT_LANG = os.getenv('TESSERACT_LANG', 'fra')  # Langue par défaut (français)
OCR_DPI = int(os.getenv('OCR_DPI', '300'))  # Résolution pour la conversion PDF -> image

# ============================================================================
# Index de recherche
# ============================================================================

SEARCH_INDEX_DIR = BASE_DIR / 'search_indexes'
SEARCH_INDEX_TTL_SECONDS = int(os.getenv('SEARCH_INDEX_TTL_SECONDS', '3600'))  # 1 heure

# ============================================================================
# Sentry (Monitoring d'erreurs)
# ============================================================================

SENTRY_DSN = os.getenv('SENTRY_DSN')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        environment=os.getenv('SENTRY_ENVIRONMENT', 'development'),
        traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        send_default_pii=False,  # Ne pas envoyer d'infos personnelles
    )
