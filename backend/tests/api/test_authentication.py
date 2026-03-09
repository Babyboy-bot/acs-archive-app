# tests/api/test_authentication.py
"""
Tests for authentication endpoints
"""
import pytest
from rest_framework.test import APITestCase
from rest_framework import status


@pytest.mark.api
@pytest.mark.api
@pytest.mark.django_db
class AuthenticationTests(APITestCase):
    """Test authentication functionality"""

    def setUp(self):
        """Set up test data"""
        from api.models import Utilisateur
        self.user_data = {
            'nom_utilisateur': 'testuser',
            'nom': 'Test',
            'prenom': 'User',
            'email': 'test@example.com',
            'password': 'testpass123',
            'role': 'USER'
        }
        self.user = Utilisateur.objects.create_user(
            nom_utilisateur=self.user_data['nom_utilisateur'],
            nom=self.user_data['nom'],
            prenom=self.user_data['prenom'],
            password=self.user_data['password'],
            email=self.user_data['email'],
            role=self.user_data['role']
        )

    def tearDown(self):
        """Clean up test data"""
        self.user.delete()

    def test_login_success(self):
        """Test successful login"""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('success', response.data)
        self.assertIn('utilisateur', response.data)

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'wrongpassword'
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('erreur', response.data)

    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser'
            # Missing password
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_refresh_token_success(self):
        """Test successful token refresh"""
        # First login to get tokens
        login_response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        refresh_token = login_response.data['refresh']

        # Then refresh
        response = self.client.post('/api/auth/refresh/', {
            'refresh': refresh_token
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_refresh_token_invalid(self):
        """Test refresh with invalid token"""
        response = self.client.post('/api/auth/refresh/', {
            'refresh': 'invalid_token'
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
