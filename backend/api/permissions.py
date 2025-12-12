"""
Permissions personnalisées pour l'API
"""
from rest_framework import permissions


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission personnalisée pour autoriser uniquement les admins à modifier.
    Les autres peuvent seulement lire.
    """
    
    def has_permission(self, request, view):
        # Les requêtes de lecture sont autorisées pour tous les utilisateurs authentifiés
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        # Les requêtes d'écriture sont autorisées uniquement pour les admins
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'


class RoleBasedPermission(permissions.BasePermission):
    """
    Permission basée sur les rôles utilisateurs
    """
    
    # Matrice de permissions par rôle et ressource
    PERMISSIONS = {
        'ADMIN': {
            'documents': ['voir', 'creer', 'modifier', 'supprimer'],
            'utilisateurs': ['voir', 'creer', 'modifier', 'supprimer'],
            'stats': ['voir'],
            'assistant': ['voir', 'creer', 'modifier', 'supprimer'],
        },
        'ARCHIVISTE': {
            'documents': ['voir', 'creer', 'modifier', 'supprimer'],
            'utilisateurs': ['voir'],
            'stats': ['voir'],
            'assistant': ['voir', 'creer', 'modifier', 'supprimer'],
        },
        'CONSULTANT': {
            'documents': ['voir'],
            'utilisateurs': [],
            'stats': [],
            'assistant': ['voir', 'creer', 'modifier', 'supprimer'],
        }
    }
    
    def has_permission(self, request, view):
        """Vérifier si l'utilisateur a la permission pour cette action"""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Déterminer la ressource depuis le nom de la vue
        ressource = getattr(view, 'ressource', None)
        if not ressource:
            return True  # Pas de restriction si pas de ressource définie
        
        # Mapper les méthodes HTTP aux actions
        action_map = {
            'GET': 'voir',
            'POST': 'creer',
            'PUT': 'modifier',
            'PATCH': 'modifier',
            'DELETE': 'supprimer'
        }
        
        action = action_map.get(request.method)
        if not action:
            return False
        
        # Vérifier la permission
        role = request.user.role
        permissions = self.PERMISSIONS.get(role, {})
        ressource_permissions = permissions.get(ressource, [])

        # Autoriser un utilisateur à modifier son propre profil
        if ressource == 'utilisateurs' and action == 'modifier':
            lookup_field = getattr(view, 'lookup_field', 'pk')
            target_id = None
            if hasattr(view, 'kwargs') and view.kwargs:
                target_id = view.kwargs.get(lookup_field)
            if target_id and str(request.user.id) == str(target_id):
                return True

        return action in ressource_permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission pour autoriser uniquement le propriétaire ou un admin
    """
    
    def has_object_permission(self, request, view, obj):
        # Les admins ont tous les droits
        if request.user.role == 'ADMIN':
            return True
        
        # Vérifier si l'objet a un champ 'auteur' ou 'utilisateur'
        if hasattr(obj, 'auteur'):
            return obj.auteur == request.user
        elif hasattr(obj, 'utilisateur'):
            return obj.utilisateur == request.user
        
        return False
