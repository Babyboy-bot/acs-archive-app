# tests/api/test_documents.py
"""
Tests for document management endpoints
"""
import pytest
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from api.models import Document, Risque, Exercice, Client

User = get_user_model()


@pytest.mark.api
class DocumentAPITests(APITestCase):
    """Test document API functionality"""

    def setUp(self):
        """Set up test data"""
        # Create test client, exercise, and risk
        self.client_obj = Client.objects.create(
            code='TEST',
            nom='Client Test',
            numero_client='12345'
        )

        self.exercice = Exercice.objects.create(
            annee=2024,
            client=self.client_obj
        )

        self.risque = Risque.objects.create(
            type='AUTO',
            exercice=self.exercice
        )

        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            role='USER'
        )

        # Create test document
        self.document = Document.objects.create(
            titre='Document Test',
            reference='REF001',
            risque=self.risque,
            fichier_url='/media/test.pdf',
            taille_fichier=1024
        )

    def tearDown(self):
        """Clean up test data"""
        if hasattr(self, 'document'):
            self.document.delete()
        if hasattr(self, 'user'):
            self.user.delete()
        if hasattr(self, 'risque'):
            self.risque.delete()
        if hasattr(self, 'exercice'):
            self.exercice.delete()
        if hasattr(self, 'client_obj'):
            self.client_obj.delete()

    def test_document_list_unauthenticated(self):
        """Test that unauthenticated users cannot access document list"""
        response = self.client.get('/api/documents/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_document_list_authenticated(self):
        """Test that authenticated users can access document list"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/documents/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_document_search_by_title(self):
        """Test document search by title"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/documents/?q=Document Test')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should find our test document
        self.assertGreater(len(response.data['results']), 0)

    def test_document_search_by_reference(self):
        """Test document search by reference"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/documents/?q=REF001')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data['results']), 0)

    def test_document_filter_by_risk(self):
        """Test document filtering by risk type"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/documents/?risque=AUTO')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_document_detail_view(self):
        """Test viewing document details"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/documents/{self.document.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['titre'], 'Document Test')
        self.assertEqual(response.data['reference'], 'REF001')

    def test_document_detail_not_found(self):
        """Test accessing non-existent document"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/documents/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_document_download(self):
        """Test document download functionality"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/documents/{self.document.id}/download/')
        # Should either succeed or return appropriate error
        self.assertIn(response.status_code, [
            status.HTTP_200_OK,
            status.HTTP_302_FOUND,  # Redirect to file
            status.HTTP_404_NOT_FOUND  # File not found
        ])

    def test_document_upload_unauthorized(self):
        """Test that unauthorized users cannot upload documents"""
        # Create test file
        test_file = ContentFile(b'test content', name='test.pdf')

        data = {
            'titre': 'New Document',
            'fichier': test_file,
            'risque': self.risque.id
        }

        response = self.client.post('/api/documents/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_document_pagination(self):
        """Test document list pagination"""
        self.client.force_authenticate(user=self.user)

        # Create multiple documents for pagination test
        documents = []
        for i in range(15):  # More than default page size
            doc = Document.objects.create(
                titre=f'Document {i}',
                reference=f'REF{i:03d}',
                risque=self.risque,
                fichier_url=f'/media/test{i}.pdf',
                taille_fichier=1024
            )
            documents.append(doc)

        try:
            response = self.client.get('/api/documents/?page_size=10')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Should have pagination info
            self.assertIn('count', response.data)
            self.assertIn('next', response.data)
            self.assertIn('previous', response.data)
            self.assertIn('results', response.data)

            # Should return max 10 items
            self.assertLessEqual(len(response.data['results']), 10)
        finally:
            # Clean up created documents
            for doc in documents:
                doc.delete()

    def test_document_search_no_results(self):
        """Test search with no matching results"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/documents/?q=nonexistentdocument12345')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)
