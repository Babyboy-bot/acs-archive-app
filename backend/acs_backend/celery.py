"""
Configuration Celery pour ACS Archive.
"""

import os
from celery import Celery

# Définir l'application Django par défaut
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'acs_backend.settings')

app = Celery('acs_backend')

# Charger la configuration depuis settings.py
app.config_from_object('django.conf:settings', namespace='CELERY')

# Découvrir automatiquement les tâches dans les applications installées
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    """Tâche de test pour Celery."""
    print(f'Request: {self.request!r}')
