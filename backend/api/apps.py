from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    verbose_name = 'API ACS Archive'

    def ready(self):
        """Hook appelé au démarrage de l'application."""
        # DÉSACTIVÉ: Le préchargement du modèle sémantique cause des timeouts Gunicorn
        # Le modèle sera chargé à la demande si nécessaire
        pass
