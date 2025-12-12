"""
URLs pour l'API
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    login_view, logout_view,
    UtilisateurViewSet,
    ClientViewSet,
    ExerciceViewSet,
    RisqueViewSet,
    DocumentViewSet,
    DocumentUploadView,
    stats_view,
    assistant_stats_view,
    assistant_document_search_view,
    assistant_document_search_faiss_view,
    assistant_semantic_search_view,
    documents_search_view,
    AssistantConversationViewSet,
    AssistantMessageViewSet,
)

# Router pour les ViewSets
router = DefaultRouter()
router.register(r'utilisateurs', UtilisateurViewSet, basename='utilisateur')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'exercices', ExerciceViewSet, basename='exercice')
router.register(r'risques', RisqueViewSet, basename='risque')
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'assistant/conversations', AssistantConversationViewSet, basename='assistant-conversation')
router.register(r'assistant/messages', AssistantMessageViewSet, basename='assistant-message')

urlpatterns = [
    # Authentification
    path('auth/login/', login_view, name='login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('documents/upload/', DocumentUploadView.as_view(), name='document-upload'),
    path('documents/search/', documents_search_view, name='documents-search'),
    path('stats/', stats_view, name='stats'),
    path('assistant/stats/', assistant_stats_view, name='assistant-stats'),
    path('assistant/documents/search/tfidf/', assistant_document_search_view, name='assistant-document-search-tfidf'),
    path('assistant/documents/search/faiss/', assistant_document_search_faiss_view, name='assistant-document-search-faiss'),
    path('assistant/documents/search/semantic/', assistant_semantic_search_view, name='assistant-document-search-semantic'),
    
    # Routes des ViewSets
    path('', include(router.urls)),
]
