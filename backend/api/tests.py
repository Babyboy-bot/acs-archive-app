"""
Tests pour l'API
"""
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.urls import reverse
from .models import Utilisateur


class UtilisateurTests(APITestCase):
    """Tests pour le modèle et l'API Utilisateur"""
    
    def setUp(self):
        """Configuration initiale pour les tests"""
        self.client = APIClient()
        
        # Créer un utilisateur admin pour les tests
        self.admin = Utilisateur.objects.create_user(
            nom_utilisateur='admin.test',
            nom='Admin',
            prenom='Test',
            password='TestPassword123!',
            role='ADMIN',
            email='admin@test.com'
        )
        
        # Créer un utilisateur archiviste pour les tests
        self.archiviste = Utilisateur.objects.create_user(
            nom_utilisateur='archiviste.test',
            nom='Archiviste',
            prenom='Test',
            password='TestPassword123!',
            role='ARCHIVISTE',
            email='archiviste@test.com'
        )
    
    def test_create_utilisateur(self):
        """Test de création d'un utilisateur"""
        self.assertEqual(Utilisateur.objects.count(), 2)
        self.assertEqual(self.admin.nom_utilisateur, 'admin.test')
        self.assertTrue(self.admin.check_password('TestPassword123!'))
    
    def test_login_success(self):
        """Test de connexion réussie"""
        url = reverse('login')
        data = {
            'nom_utilisateur': 'admin.test',
            'mot_de_passe': 'TestPassword123!'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue('token' in response.data)
        self.assertTrue('utilisateur' in response.data)
        self.assertEqual(response.data['utilisateur']['nomUtilisateur'], 'admin.test')
    
    def test_login_invalid_credentials(self):
        """Test de connexion avec identifiants invalides"""
        url = reverse('login')
        data = {
            'nom_utilisateur': 'admin.test',
            'mot_de_passe': 'WrongPassword'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue('erreur' in response.data)
    
    def test_login_inactive_user(self):
        """Test de connexion avec un utilisateur inactif"""
        self.admin.est_actif = False
        self.admin.save()
        
        url = reverse('login')
        data = {
            'nom_utilisateur': 'admin.test',
            'mot_de_passe': 'TestPassword123!'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_list_utilisateurs_authenticated(self):
        """Test de liste des utilisateurs (authentifié)"""
        # Se connecter d'abord
        login_url = reverse('login')
        login_data = {
            'nom_utilisateur': 'admin.test',
            'mot_de_passe': 'TestPassword123!'
        }
        login_response = self.client.post(login_url, login_data, format='json')
        token = login_response.data['token']
        
        # Lister les utilisateurs
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        url = reverse('utilisateur-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_list_utilisateurs_unauthenticated(self):
        """Test de liste des utilisateurs (non authentifié)"""
        url = reverse('utilisateur-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AuthenticationTests(APITestCase):
    """Tests pour l'authentification"""
    
    def test_login_missing_fields(self):
        """Test de connexion avec champs manquants"""
        url = reverse('login')
        data = {'nom_utilisateur': 'test'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
