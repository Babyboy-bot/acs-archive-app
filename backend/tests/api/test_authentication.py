# tests/api/test_authentication.py
"""
Tests for authentication endpoints
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

User = get_user_model()


@pytest.mark.api
class AuthenticationTests(APITestCase):
    """Test authentication functionality"""

    def setUp(self):
        """Set up test data"""
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123',
            'role': 'USER'
        }
        self.user = User.objects.create_user(**self.user_data)

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
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

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
