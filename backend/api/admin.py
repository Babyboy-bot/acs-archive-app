"""
Configuration de l'interface d'administration Django
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    Utilisateur, Client, Exercice, Risque,
    Categorie, Document
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


@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    """Administration des catégories"""
    
    list_display = ['nom', 'couleur', 'cree_le']
    search_fields = ['nom']
    ordering = ['nom']
    readonly_fields = ['cree_le', 'modifie_le']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    """Administration des documents"""
    
    list_display = ['titre', 'type_courrier', 'risque', 'auteur', 'categorie', 'est_archive', 'cree_le']
    list_filter = ['type_courrier', 'est_archive', 'categorie', 'cree_le']
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
            'fields': ('type_courrier', 'risque', 'categorie', 'auteur')
        }),
        ('Archivage', {
            'fields': ('est_archive', 'date_archivage')
        }),
        ('Dates', {
            'fields': ('cree_le', 'modifie_le')
        }),
    )
