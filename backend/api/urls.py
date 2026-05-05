"""
URLs pour l'API
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views_main import (
    DocumentRetryChunkingView,
    DocumentLogViewView,
    login_view,
    logout_view,
    refresh_token_view,
    stats_view,
    assistant_stats_view,
    assistant_valid_clients_view,
    assistant_document_search_view,
    assistant_semantic_search_view,
    assistant_document_search_by_reference_view,
    assistant_document_search_filtered_view,
    documents_search_view,
    llm_quota_consume,
    llm_usage_log,
    llm_quota_status,
    llm_admin_stats,
    llm_admin_history,
    assistant_health,
    assistant_feedback,
    audit_log_list,
    audit_log_detail,
    audit_log_stats,
    audit_log_export,
    auth_verify_view,
    health_check,
    ready_check,
    version_info,
    assistant_set_document_context_view,
    assistant_chat_view,
    assistant_chat_stream_view,
    ocr_quality_report_view,
)

from .views import (
    UtilisateurViewSet,
    ClientViewSet,
    ExerciceViewSet,
    RisqueViewSet,
    DocumentViewSet,
    DocumentUploadView,
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
    path('auth/refresh/', refresh_token_view, name='token_refresh'),
    path('documents/upload/', DocumentUploadView.as_view(), name='document-upload'),
    path('documents/<str:document_id>/retry-chunking/', DocumentRetryChunkingView.as_view(), name='document-retry-chunking'),
    path('documents/<str:document_id>/log-view/', DocumentLogViewView.as_view(), name='document-log-view'),
    path('documents/search/', documents_search_view, name='documents-search'),
    path('stats/', stats_view, name='stats'),
    path('assistant/stats/', assistant_stats_view, name='assistant-stats'),
    path('assistant/valid-clients/', assistant_valid_clients_view, name='assistant-valid-clients'),
    path('assistant/feedback/', assistant_feedback, name='assistant-feedback'),
    path('assistant/health/', assistant_health, name='assistant-health'),
    path('assistant/documents/search/tfidf/', assistant_document_search_view, name='assistant-document-search-tfidf'),
    path('assistant/documents/search/semantic/', assistant_semantic_search_view, name='assistant-document-search-semantic'),
    path('assistant/documents/search/by-reference/', assistant_document_search_by_reference_view, name='assistant-document-search-by-reference'),
    path('assistant/documents/search/filtered/', assistant_document_search_filtered_view, name='assistant-document-search-filtered'),
    path('assistant/documents/context/', assistant_set_document_context_view, name='assistant-set-document-context'),
    path('assistant/chat/', assistant_chat_view, name='assistant-chat'),
    path('assistant/chat/stream/', assistant_chat_stream_view, name='assistant-chat-stream'),
    path('assistant/llm/quota/consume/', llm_quota_consume, name='assistant-llm-quota-consume'),
    path('assistant/llm/usage/', llm_usage_log, name='assistant-llm-usage-log'),
    path('assistant/llm/quota/', llm_quota_status, name='assistant-llm-quota-status'),
    path('assistant/llm/admin/stats/', llm_admin_stats, name='assistant-llm-admin-stats'),
    path('assistant/llm/admin/history/', llm_admin_history, name='assistant-llm-admin-history'),
    
    # Rapport qualité OCR (priorisation re-scan)
    path('ocr/quality-report/', ocr_quality_report_view, name='ocr-quality-report'),
    
    # Journal d'audit
    path('audit/logs/', audit_log_list, name='audit-log-list'),
    path('audit/logs/<int:log_id>/', audit_log_detail, name='audit-log-detail'),
    path('audit/stats/', audit_log_stats, name='audit-log-stats'),
    path('audit/log-export/', audit_log_export, name='audit-log-export'),
    
    # Healthcheck (monitoring/Kubernetes)
    path('auth/verify/', auth_verify_view, name='auth-verify'),
    path('health/', health_check, name='health-check'),
    path('ready/', ready_check, name='ready-check'),
    path('version/', version_info, name='version-info'),
        
    # Routes des ViewSets
    path('', include(router.urls)),
]
