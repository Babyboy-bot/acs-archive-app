"""
Configuration de l'interface d'administration Django
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    Utilisateur, Client, Exercice, Risque, Document,
    LlmMonthlyQuota, LlmUsage
)


@admin.register(Utilisateur)
class UtilisateurAdmin(BaseUserAdmin):
    """Administration des utilisateurs"""
    
    list_display = ['nom_utilisateur', 'prenom', 'nom', 'email', 'role', 'est_actif', 'date_creation']
    list_filter = ['role', 'est_actif', 'date_creation']
    search_fields = ['nom_utilisateur', 'nom', 'prenom', 'email']
    ordering = ['prenom', 'nom']
    
    fieldsets = (
        (None, {'fields': ('nom_utilisateur', 'password')}),
        ('Informations personnelles', {'fields': ('nom', 'prenom', 'email')}),
        ('Permissions', {'fields': ('role', 'est_actif', 'is_staff', 'is_superuser')}),
        ('Dates importantes', {'fields': ('derniere_connexion', 'date_creation', 'date_modification')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('nom_utilisateur', 'nom', 'prenom', 'email', 'password1', 'password2', 'role', 'est_actif'),
        }),
    )
    
    readonly_fields = ['date_creation', 'date_modification', 'derniere_connexion']


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    """Administration des clients"""
    
    list_display = ['nom', 'numero_client', 'type', 'email', 'telephone', 'cree_le']
    list_filter = ['type', 'cree_le']
    search_fields = ['nom', 'numero_client', 'email']
    ordering = ['nom']
    readonly_fields = ['cree_le', 'modifie_le']


@admin.register(Exercice)
class ExerciceAdmin(admin.ModelAdmin):
    """Administration des exercices"""
    
    list_display = ['client', 'annee', 'statut', 'cree_le']
    list_filter = ['statut', 'annee', 'cree_le']
    search_fields = ['client__nom']
    ordering = ['-annee', 'client__nom']
    readonly_fields = ['cree_le', 'modifie_le']


@admin.register(Risque)
class RisqueAdmin(admin.ModelAdmin):
    """Administration des risques"""
    
    list_display = ['type', 'numero_police', 'exercice', 'cree_le']
    list_filter = ['type', 'cree_le']
    search_fields = ['numero_police', 'exercice__client__nom']
    ordering = ['type']
    readonly_fields = ['cree_le', 'modifie_le']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    """Administration des documents"""
    
    list_display = ['titre', 'type_courrier', 'risque', 'auteur', 'est_archive', 'cree_le']
    list_filter = ['type_courrier', 'est_archive', 'cree_le']
    search_fields = ['titre', 'description', 'reference']
    ordering = ['-cree_le']
    readonly_fields = ['cree_le', 'modifie_le']
    
    fieldsets = (
        ('Informations générales', {
            'fields': ('titre', 'description', 'reference', 'date_document')
        }),
        ('Fichier', {
            'fields': ('chemin_fichier', 'type_fichier', 'taille_fichier')
        }),
        ('Classification', {
            'fields': ('type_courrier', 'risque', 'auteur')
        }),
        ('Archivage', {
            'fields': ('est_archive', 'date_archivage')
        }),
        ('Dates', {
            'fields': ('cree_le', 'modifie_le')
        }),
    )


@admin.register(LlmMonthlyQuota)
class LlmMonthlyQuotaAdmin(admin.ModelAdmin):
    """Administration des quotas LLM mensuels"""
    
    list_display = ['utilisateur', 'year_month', 'tokens_used', 'limit', 'percentage_used']
    list_filter = ['year_month']
    search_fields = ['utilisateur__nom_utilisateur', 'utilisateur__nom', 'utilisateur__prenom']
    ordering = ['-year_month', 'utilisateur__nom_utilisateur']
    readonly_fields = ['percentage_used']
    
    def percentage_used(self, obj):
        """Calcule le pourcentage d'utilisation du quota"""
        if obj.limit > 0:
            return f"{(obj.tokens_used / obj.limit * 100):.1f}%"
        return "N/A"
    percentage_used.short_description = 'Utilisation'


@admin.register(LlmUsage)
class LlmUsageAdmin(admin.ModelAdmin):
    """Administration des logs d'usage LLM"""
    
    list_display = ['utilisateur', 'timestamp', 'provider', 'model', 'purpose', 'tokens_total']
    list_filter = ['provider', 'purpose', 'timestamp']
    search_fields = ['utilisateur__nom_utilisateur', 'utilisateur__nom', 'utilisateur__prenom', 'model']
    ordering = ['-timestamp']
    readonly_fields = ['timestamp', 'utilisateur', 'provider', 'model', 'purpose', 'tokens_input', 'tokens_output', 'tokens_total']
    
    def has_add_permission(self, request):
        """Empêcher la création manuelle de logs"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Empêcher la modification des logs"""
        return False
