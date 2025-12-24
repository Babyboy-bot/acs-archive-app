from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    verbose_name = 'API ACS Archive'

    def ready(self):
        """Hook appelé au démarrage de l'application pour précharger le modèle sémantique."""
        # Importer ici pour éviter les imports circulaires
        from .views import get_semantic_model, SEMANTIC_SEARCH_AVAILABLE
        
        if SEMANTIC_SEARCH_AVAILABLE:
            try:
                # Précharger le modèle sémantique pour réduire la latence de la première requête
                get_semantic_model()
            except Exception as exc:
                # Le modèle sera chargé à la première utilisation si le préchargement échoue
                pass
