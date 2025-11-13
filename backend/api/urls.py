"""
URLs pour l'API
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    login_view,
    UtilisateurViewSet,
    ClientViewSet,
    ExerciceViewSet,
    RisqueViewSet,
    CategorieViewSet,
    DocumentViewSet,
    DocumentUploadView,
    stats_view,
    document_search_view
)

# Router pour les ViewSets
router = DefaultRouter()
router.register(r'utilisateurs', UtilisateurViewSet, basename='utilisateur')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'exercices', ExerciceViewSet, basename='exercice')
router.register(r'risques', RisqueViewSet, basename='risque')
router.register(r'categories', CategorieViewSet, basename='categorie')
router.register(r'documents', DocumentViewSet, basename='document')

urlpatterns = [
    # Authentification
    path('auth/login/', login_view, name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('documents/upload/', DocumentUploadView.as_view(), name='document-upload'),
    path('stats/', stats_view, name='stats'),
    path('documents/search/', document_search_view, name='document-search'),
    
    # Routes des ViewSets
    path('', include(router.urls)),
]
