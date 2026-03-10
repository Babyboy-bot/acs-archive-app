# tests/api/test_authentication.py
"""
Tests for authentication endpoints
"""
import pytest
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status


@pytest.mark.api
@pytest.mark.django_db
@override_settings(SECURE_SSL_REDIRECT=False)
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
            'role': 'CONSULTANT'
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
        """Test successful token refresh via cookie"""
        # First login - sets acs_refresh_token HttpOnly cookie
        login_response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        # Cookie must be present after login
        self.assertIn('acs_refresh_token', login_response.cookies)

        # Refresh reads the cookie set by login (Django test client tracks cookies)
        response = self.client.post('/api/auth/refresh/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('acs_access_token', response.cookies)

    def test_refresh_token_invalid(self):
        """Test refresh with invalid token"""
        response = self.client.post('/api/auth/refresh/', {
            'refresh': 'invalid_token'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_auth_verify_authenticated(self):
        """Test auth/verify returns 200 pour un utilisateur connecté"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/verify/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_auth_verify_unauthenticated(self):
        """Test auth/verify returns 401 sans authentification"""
        response = self.client.get('/api/auth/verify/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_consultant_cannot_access_admin_stats(self):
        """Test RBAC : un CONSULTANT ne peut pas accéder aux stats LLM admin"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/assistant/llm/admin/stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
