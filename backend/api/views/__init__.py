"""
Vues pour l'API Django REST Framework

Ce module est découpé en plusieurs fichiers pour améliorer la maintenabilité :
- auth.py : Authentification (login, logout, refresh)
- crud.py : ViewSets CRUD (Utilisateur, Client, Exercice, Risque, Document)
- assistant.py : Recherche documentaire et assistant IA
- llm.py : Gestion des quotas et usage LLM
- audit.py : Journal d'audit
- health.py : Healthcheck et monitoring
- cache.py : Gestion du cache (TF-IDF)
- stats.py : Statistiques et KPI

Pour la rétrocompatibilité, toutes les vues sont réexportées depuis ce module.
"""

# Réexporter toutes les vues depuis le fichier principal pour la rétrocompatibilité
# TODO: Migrer progressivement les vues vers leurs modules respectifs
from ..views_main import (
    # Auth
    login_view,
    logout_view,
    
    # CRUD ViewSets
    UtilisateurViewSet,
    ClientViewSet,
    ExerciceViewSet,
    RisqueViewSet,
    DocumentViewSet,
    DocumentUploadView,
    AssistantConversationViewSet,
    AssistantMessageViewSet,
    
    # Stats
    stats_view,
    assistant_stats_view,
    
    # Assistant / Recherche
    assistant_valid_clients_view,
    assistant_document_search_view,
    assistant_semantic_search_view,
    assistant_document_search_by_reference_view,
    assistant_document_search_filtered_view,
    documents_search_view,
    assistant_set_document_context_view,
    assistant_chat_view,
    assistant_health,
    assistant_feedback,
    
    # LLM Quota
    llm_quota_consume,
    llm_usage_log,
    llm_quota_status,
    llm_admin_stats,
    llm_admin_history,
    
    # Audit
    audit_log_list,
    audit_log_detail,
    audit_log_stats,
    
    # Health
    health_check,
    ready_check,
    version_info,
    
    # OCR
    ocr_quality_report_view,
)

__all__ = [
    # Auth
    'login_view',
    'logout_view',
    
    # CRUD ViewSets
    'UtilisateurViewSet',
    'ClientViewSet',
    'ExerciceViewSet',
    'RisqueViewSet',
    'DocumentViewSet',
    'DocumentUploadView',
    'AssistantConversationViewSet',
    'AssistantMessageViewSet',
    
    # Stats
    'stats_view',
    'assistant_stats_view',
    
    # Assistant / Recherche
    'assistant_valid_clients_view',
    'assistant_document_search_view',
    'assistant_semantic_search_view',
    'assistant_document_search_by_reference_view',
    'assistant_document_search_filtered_view',
    'documents_search_view',
    'assistant_set_document_context_view',
    'assistant_chat_view',
    'assistant_health',
    'assistant_feedback',
    
    # LLM Quota
    'llm_quota_consume',
    'llm_usage_log',
    'llm_quota_status',
    'llm_admin_stats',
    'llm_admin_history',
    
    # Audit
    'audit_log_list',
    'audit_log_detail',
    'audit_log_stats',
    
    # Health
    'health_check',
    'ready_check',
    'version_info',
    
    # OCR
    'ocr_quality_report_view',
]
