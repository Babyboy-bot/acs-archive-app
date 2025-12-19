"""
URLs pour l'API
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    login_view,
    logout_view,
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
    llm_quota_consume,
    llm_usage_log,
    llm_quota_status,
    llm_admin_stats,
    llm_admin_history,
    assistant_health,
    assistant_feedback,
    assistant_learning_record,
    assistant_learning_similar,
    assistant_learning_stats,
    assistant_learning_pattern_update,
    audit_log_list,
    audit_log_detail,
    audit_log_stats,
    health_check,
    ready_check,
    version_info,
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
    path('assistant/feedback/', assistant_feedback, name='assistant-feedback'),
    path('assistant/health/', assistant_health, name='assistant-health'),
    path('assistant/documents/search/tfidf/', assistant_document_search_view, name='assistant-document-search-tfidf'),
    path('assistant/documents/search/faiss/', assistant_document_search_faiss_view, name='assistant-document-search-faiss'),
    path('assistant/documents/search/semantic/', assistant_semantic_search_view, name='assistant-document-search-semantic'),
    path('assistant/llm/quota/consume/', llm_quota_consume, name='assistant-llm-quota-consume'),
    path('assistant/llm/usage/', llm_usage_log, name='assistant-llm-usage-log'),
    path('assistant/llm/quota/', llm_quota_status, name='assistant-llm-quota-status'),
    path('assistant/llm/admin/stats/', llm_admin_stats, name='assistant-llm-admin-stats'),
    path('assistant/llm/admin/history/', llm_admin_history, name='assistant-llm-admin-history'),
    
    # Apprentissage assistant
    path('assistant/learning/record/', assistant_learning_record, name='assistant-learning-record'),
    path('assistant/learning/similar/', assistant_learning_similar, name='assistant-learning-similar'),
    path('assistant/learning/stats/', assistant_learning_stats, name='assistant-learning-stats'),
    path('assistant/learning/patterns/', assistant_learning_pattern_update, name='assistant-learning-patterns'),
    
    # Journal d'audit
    path('audit/logs/', audit_log_list, name='audit-log-list'),
    path('audit/logs/<int:log_id>/', audit_log_detail, name='audit-log-detail'),
    path('audit/stats/', audit_log_stats, name='audit-log-stats'),
    
    # Healthcheck (monitoring/Kubernetes)
    path('health/', health_check, name='health-check'),
    path('ready/', ready_check, name='ready-check'),
    path('version/', version_info, name='version-info'),
        
    # Routes des ViewSets
    path('', include(router.urls)),
]
