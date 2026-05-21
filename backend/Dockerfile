# ============================================================================

# Dockerfile - Backend Django

# ============================================================================

FROM python:3.12-slim



# Métadonnées

LABEL maintainer="ACS Archive Team"

LABEL description="Backend API Django pour ACS Archive"



# Variables d'environnement

ENV PYTHONDONTWRITEBYTECODE=1

ENV PYTHONUNBUFFERED=1

ENV DJANGO_SETTINGS_MODULE=acs_backend.settings



# Répertoire de travail

WORKDIR /app



# Installer les dépendances système

RUN apt-get update && apt-get install -y --no-install-recommends \

    build-essential \

    libpq-dev \

    curl \

    tesseract-ocr \

    tesseract-ocr-fra \

    poppler-utils \

    ghostscript \

    libgl1 \

    libglib2.0-0 \

    libsm6 \

    libxext6 \

    libxrender-dev \

    libgomp1 \

    libgthread-2.0-0 \

    && rm -rf /var/lib/apt/lists/*



# Copier les requirements et installer les dépendances Python

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \

    && pip install --no-cache-dir -r requirements.txt



# Copier le code source

COPY . .



# Créer un utilisateur non-root pour la sécurité

RUN adduser --disabled-password --gecos '' appuser \

    && chown -R appuser:appuser /app

USER appuser



# Collecter les fichiers statiques

RUN python manage.py collectstatic --noinput --clear 2>/dev/null || true



# Port exposé

EXPOSE 8000



# Healthcheck

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \

    CMD curl -f http://localhost:8000/api/health/ || exit 1



# Commande de démarrage (gunicorn pour production)

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--threads", "2", "--timeout", "120", "acs_backend.wsgi:application"]

