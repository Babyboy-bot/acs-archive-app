# tests/conftest.py
"""
Pytest configuration and fixtures for ACS Archive App tests
"""
import pytest
import os
from django.conf import settings
from django.test.utils import get_runner

# Override Django settings for testing
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'acs_backend.settings')

# Configure Django
import django
django.setup()


@pytest.fixture(scope='session')
def django_db_setup():
    """Setup Django database for testing"""
    from django.core.management import execute_from_command_line
    from django.db import connection

    # Create test database tables
    with connection.schema_editor() as schema_editor:
        # This will create all tables
        pass

    yield

    # Cleanup after all tests
    pass


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
        username='testuser',
        email='test@example.com',
        password='testpass123',
        role='USER'
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
        username='admin',
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
        username='testuser',
        email='test@example.com',
        password='testpass123',
        role='USER'
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
        username='testadmin',
        email='admin@example.com',
        password='admin123',
        role='ADMIN'
    )

    yield admin

    # Cleanup
    admin.delete()
