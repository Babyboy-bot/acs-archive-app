# tests/conftest.py
"""
Pytest configuration and fixtures for ACS Archive App tests
"""
import os

# Set Django settings module before any Django imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'acs_backend.settings')

# Import pytest fixtures from pytest-django
import pytest
from pytest_django.fixtures import django_db_setup

# Override Django settings for testing
from django.conf import settings
from django.test.utils import get_runner


@pytest.fixture(autouse=True)
def disable_ssl_redirect(settings):
    """Disable HTTPS redirect so test client HTTP requests are not 301-redirected"""
    settings.SECURE_SSL_REDIRECT = False


@pytest.fixture
def api_client():
    """Django REST Framework API client fixture"""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def authenticated_client(api_client):
    """API client with authenticated user"""
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import RefreshToken

    User = get_user_model()

    # Create a test user
    user = User.objects.create_user(
        nom_utilisateur='testuser',
        nom='Test',
        prenom='User',
        email='test@example.com',
        password='testpass123',
        role='CONSULTANT'
    )

    # Generate tokens
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)

    # Set authorization header
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

    yield api_client

    # Cleanup
    user.delete()


@pytest.fixture
def admin_client(api_client):
    """API client with admin user"""
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import RefreshToken

    User = get_user_model()

    # Create a test admin user
    admin = User.objects.create_user(
        nom_utilisateur='admin',
        nom='Admin',
        prenom='User',
        email='admin@example.com',
        password='admin123',
        role='ADMIN'
    )

    # Generate tokens
    refresh = RefreshToken.for_user(admin)
    access_token = str(refresh.access_token)

    # Set authorization header
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

    yield api_client

    # Cleanup
    admin.delete()


@pytest.fixture
def test_user():
    """Create a test user"""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(
        nom_utilisateur='testuser',
        nom='Test',
        prenom='User',
        email='test@example.com',
        password='testpass123',
        role='CONSULTANT'
    )

    yield user

    # Cleanup
    user.delete()


@pytest.fixture
def test_admin():
    """Create a test admin user"""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    admin = User.objects.create_user(
        nom_utilisateur='testadmin',
        nom='Admin',
        prenom='Test',
        email='admin@example.com',
        password='admin123',
        role='ADMIN'
    )

    yield admin

    # Cleanup
    admin.delete()
