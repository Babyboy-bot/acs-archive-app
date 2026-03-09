# tests/api/test_assistant.py
"""
Tests for assistant API endpoints
"""
import pytest
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status


@pytest.mark.api
@pytest.mark.api
@pytest.mark.django_db
@override_settings(SECURE_SSL_REDIRECT=False)
class AssistantAPITests(APITestCase):
    """Test assistant API functionality"""

    def setUp(self):
        """Set up test data"""
        from api.models import Utilisateur
        self.user = Utilisateur.objects.create_user(
            nom_utilisateur='testuser',
            nom='Test',
            prenom='User',
            password='testpass123',
            email='test@example.com',
            role='CONSULTANT'
        )

    def tearDown(self):
        """Clean up test data"""
        if hasattr(self, 'user'):
            self.user.delete()

    def test_assistant_chat_unauthenticated(self):
        """Test that unauthenticated users cannot access assistant"""
        response = self.client.post('/api/assistant/chat/', {
            'question': 'Test question',
            'conversation_id': 'test-conversation-id'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_assistant_chat_missing_data(self):
        """Test assistant chat with missing required data"""
        self.client.force_authenticate(user=self.user)

        # Missing question
        response = self.client.post('/api/assistant/chat/', {
            'conversation_id': 'test-conversation-id'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing conversation_id
        response = self.client.post('/api/assistant/chat/', {
            'question': 'Test question'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assistant_chat_invalid_conversation(self):
        """Test assistant chat with invalid conversation ID"""
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/assistant/chat/', {
            'question': 'Test question',
            'conversation_id': 'invalid-conversation-id'
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_assistant_chat_success(self):
        """Test successful assistant chat interaction"""
        self.client.force_authenticate(user=self.user)

        # First create a conversation
        conversation_response = self.client.post('/api/assistant/conversations/', {
            'titre': 'Test Conversation'
        })
        self.assertEqual(conversation_response.status_code, status.HTTP_201_CREATED)
        conversation_id = conversation_response.data['id']

        # Then send a chat message
        response = self.client.post('/api/assistant/chat/', {
            'question': 'Bonjour, pouvez-vous m\'aider ?',
            'conversation_id': conversation_id
        })

        # Should succeed (even if LLM is not available, fallback should work)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('resume', response.data)
        self.assertIn('narration', response.data)
        self.assertIn('pieces', response.data)

    def test_assistant_conversations_list(self):
        """Test listing user conversations"""
        self.client.force_authenticate(user=self.user)

        # Create a few conversations
        conversations = []
        for i in range(3):
            response = self.client.post('/api/assistant/conversations/', {
                'titre': f'Conversation Test {i}'
            })
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            conversations.append(response.data)

        # List conversations
        response = self.client.get('/api/assistant/conversations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 3)

        # Verify conversation data structure
        for conv in response.data[:3]:  # Check first 3
            self.assertIn('id', conv)
            self.assertIn('titre', conv)
            self.assertIn('cree_le', conv)

    def test_assistant_conversations_create(self):
        """Test creating new conversations"""
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/assistant/conversations/', {
            'titre': 'Nouvelle Conversation Test'
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['titre'], 'Nouvelle Conversation Test')

    def test_assistant_conversations_create_empty_title(self):
        """Test creating conversation with empty title"""
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/assistant/conversations/', {})

        # Should either succeed with default title or fail with validation
        self.assertIn(response.status_code, [
            status.HTTP_201_CREATED,  # If default title is set
            status.HTTP_400_BAD_REQUEST  # If title is required
        ])

    def test_assistant_conversation_detail(self):
        """Test viewing conversation details and messages"""
        self.client.force_authenticate(user=self.user)

        # Create conversation
        create_response = self.client.post('/api/assistant/conversations/', {
            'titre': 'Conversation Detail Test'
        })
        conversation_id = create_response.data['id']

        # Send a message
        self.client.post('/api/assistant/chat/', {
            'question': 'Test message',
            'conversation_id': conversation_id
        })

        # Get conversation details
        response = self.client.get(f'/api/assistant/conversations/{conversation_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('messages', response.data)
        self.assertGreater(len(response.data['messages']), 0)

    def test_assistant_conversation_other_user(self):
        """Test that users cannot access other users' conversations"""
        from api.models import Utilisateur
        # Create another user
        other_user = Utilisateur.objects.create_user(
            nom_utilisateur='otheruser',
            nom='Other',
            prenom='User',
            email='other@example.com',
            password='other123',
            role='CONSULTANT'
        )

        try:
            # Create conversation as other user
            self.client.force_authenticate(user=other_user)
            create_response = self.client.post('/api/assistant/conversations/', {
                'titre': 'Other User Conversation'
            })
            other_conversation_id = create_response.data['id']

            # Try to access as our test user
            self.client.force_authenticate(user=self.user)
            response = self.client.get(f'/api/assistant/conversations/{other_conversation_id}/')
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        finally:
            other_user.delete()

    def test_assistant_health_check(self):
        """Test assistant health check endpoint"""
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/assistant/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Health check should return some status information
        self.assertIsInstance(response.data, dict)
