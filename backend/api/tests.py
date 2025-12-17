"""
Tests pour l'API
"""
import json
from unittest import mock
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from unittest import skip

from .models import (
    Utilisateur,
    Client,
    Exercice,
    Risque,
    Categorie,
    Document,
    LlmMonthlyQuota,
    LlmUsage,
)


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


class AssistantAPITests(APITestCase):
    """Tests pour les endpoints de l'assistant IA"""

    def setUp(self):
        self.client = APIClient()

        self.user = Utilisateur.objects.create_user(
            nom_utilisateur='assistant.user',
            nom='Assistant',
            prenom='User',
            password='StrongPass123!',
            role='ADMIN',
            email='assistant@test.com'
        )

        login_response = self.client.post(reverse('login'), {
            'nom_utilisateur': 'assistant.user',
            'mot_de_passe': 'StrongPass123!'
        }, format='json')
        token = login_response.data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        self.client_obj = Client.objects.create(nom='Test Client')
        self.exercice = Exercice.objects.create(annee=2024, client=self.client_obj)
        self.categorie = Categorie.objects.create(nom='Test Catégorie')
        self.risque = Risque.objects.create(exercice=self.exercice, type='RC')

        self.document = Document.objects.create(
            titre='Contrat Responsabilité',
            description='Contrat responsabilité civile 2024',
            chemin_fichier='documents/test.pdf',
            type_fichier='application/pdf',
            taille_fichier=1024,
            type_courrier='ACS_VERS_CLIENT',
            risque=self.risque,
            auteur=self.user,
            categorie=self.categorie,
            reference='DOC-001',
            date_document=timezone.now() - timedelta(days=10)
        )

    def test_assistant_stats_endpoint(self):
        response = self.client.get(reverse('assistant-stats'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('documents_par_mois', data)
        self.assertIn('top_categories', data)
        self.assertIn('kpi', data)

    def test_assistant_tfidf_search(self):
        response = self.client.get(reverse('assistant-document-search-tfidf'), {'q': 'responsabilité'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)
        self.assertGreaterEqual(len(data['results']), 1)
        first = data['results'][0]
        self.assertIn('score', first)
        self.assertIn('metadata', first)

    @mock.patch('api.views.faiss')
    def test_assistant_faiss_search(self, mock_faiss):
        mock_faiss.IndexFlatIP.return_value = mock.Mock(
            **{'search.return_value': ([[1.0]], [[0]])}
        )
        mock_faiss.normalize_L2.side_effect = lambda x: None

        response = self.client.get(reverse('assistant-document-search-faiss'), {'q': 'responsabilité'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)

    @skip("Le rate limiting est géré côté Next.js pour /api/assistant-demo")
    def test_assistant_rate_limiting(self):
        url = reverse('assistant-demo')
        with mock.patch('api.views.collecterStatistiques', return_value={
            'documents_par_mois': {},
            'top_categories': [],
            'top_clients': [],
            'kpi': {
                'taux_conformite': 1,
                'documents_en_retard': 0,
                'alertes_peremption': 0,
            },
        }):
            for _ in range(12):
                response = self.client.post(url, {'question': 'Combien de documents ?'}, format='json')
                self.assertNotEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

            response = self.client.post(url, {'question': 'Combien de documents ?'}, format='json')
            self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class LlmQuotaTests(APITestCase):
    """Tests pour les endpoints de gestion de quota LLM."""

    def setUp(self):
        self.client = APIClient()
        self.user = Utilisateur.objects.create_user(
            nom_utilisateur='llm.user',
            nom='LLM',
            prenom='User',
            password='StrongPass123!',
            role='ADMIN',
            email='llm@test.com',
        )
        # Authentifier directement l'utilisateur pour les tests d'API
        self.client.force_authenticate(user=self.user)

    def test_llm_quota_consume_allowed(self):
        """Consommation de quota autorisée quand on est sous la limite."""

        url = reverse('assistant-llm-quota-consume')
        response = self.client.post(
            url,
            {
                'estimated_tokens': 100,
                'purpose': 'answer',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['allowed'])
        self.assertIn('remaining', data)
        self.assertIn('percentage', data)

        # Vérifier que le quota mensuel a bien été créé et incrémenté
        quotas = LlmMonthlyQuota.objects.filter(utilisateur=self.user)
        self.assertEqual(quotas.count(), 1)
        quota = quotas.first()
        self.assertIsNotNone(quota)
        self.assertEqual(quota.tokens_used, 100)

    def test_llm_quota_consume_block_when_exceeded(self):
        """Consommation de quota refusée quand la limite serait dépassée."""

        # Créer un quota existant presque plein
        now = timezone.now()
        year_month = now.strftime('%Y-%m')
        quota = LlmMonthlyQuota.objects.create(
            utilisateur=self.user,
            year_month=year_month,
            tokens_used=90,
            limit=100,
        )

        url = reverse('assistant-llm-quota-consume')
        response = self.client.post(
            url,
            {
                'estimated_tokens': 20,  # dépasserait la limite de 100
                'purpose': 'answer',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data['allowed'])
        self.assertEqual(data['remaining'], 10)

        quota.refresh_from_db()
        # La consommation estimée n'a pas été ajoutée
        self.assertEqual(quota.tokens_used, 90)

    def test_llm_usage_log_creates_usage_and_updates_quota(self):
        """Journaliser un appel LLM doit créer un LlmUsage et incrémenter le quota mensuel."""

        url = reverse('assistant-llm-usage-log')
        ts = timezone.now().isoformat()
        response = self.client.post(
            url,
            {
                'provider': 'claude',
                'model': 'claude-test',
                'purpose': 'answer',
                'tokens_input': 120,
                'tokens_output': 80,
                'timestamp': ts,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json().get('status'), 'ok')

        usages = LlmUsage.objects.filter(utilisateur=self.user)
        self.assertEqual(usages.count(), 1)
        usage = usages.first()
        self.assertIsNotNone(usage)
        self.assertEqual(usage.tokens_input, 120)
        self.assertEqual(usage.tokens_output, 80)
        self.assertEqual(usage.tokens_total, 200)

        # Vérifier que le quota mensuel a été incrémenté de 200
        now = timezone.now()
        year_month = now.strftime('%Y-%m')
        quota = LlmMonthlyQuota.objects.get(utilisateur=self.user, year_month=year_month)
        self.assertEqual(quota.tokens_used, 200)

    def test_llm_quota_status(self):
        """L'endpoint de statut de quota renvoie les informations courantes."""

        # Préparer un quota avec quelques tokens utilisés
        now = timezone.now()
        year_month = now.strftime('%Y-%m')
        LlmMonthlyQuota.objects.create(
            utilisateur=self.user,
            year_month=year_month,
            tokens_used=500,
            limit=1000,
        )

        url = reverse('assistant-llm-quota-status')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['tokens_used'], 500)
        self.assertEqual(data['limit'], 1000)
        self.assertEqual(data['remaining'], 500)
        self.assertAlmostEqual(data['percentage'], 0.5)


class AssistantHealthTests(APITestCase):
    """Tests pour l'endpoint assistant_health (état de santé LLM)."""

    def setUp(self):
        self.client = APIClient()
        self.user = Utilisateur.objects.create_user(
            nom_utilisateur='health.user',
            nom='Health',
            prenom='User',
            password='StrongPass123!',
            role='ADMIN',
            email='health@test.com',
        )
        self.client.force_authenticate(user=self.user)

    def test_assistant_health_claude_ok(self):
        """Configuration Claude valide doit retourner config_ok=True."""

        from django.test import override_settings

        with override_settings(
            ASSISTANT_LLM_PROVIDER='claude',
            ASSISTANT_LLM_ENABLED='true',
            CLAUDE_API_KEY='test-key',
            CLAUDE_BASE_URL='https://api.anthropic.com/v1',
        ):
            response = self.client.get(reverse('assistant-health'))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            data = response.json()
            self.assertEqual(data['provider'], 'claude')
            self.assertTrue(data['llm_enabled'])
            self.assertTrue(data['config_ok'])
            self.assertIsInstance(data['semantic_search_available'], bool)

    def test_assistant_health_missing_key(self):
        """Configuration incomplète doit signaler des erreurs et config_ok=False."""

        from django.test import override_settings

        with override_settings(
            ASSISTANT_LLM_PROVIDER='claude',
            ASSISTANT_LLM_ENABLED='true',
            CLAUDE_API_KEY='',  # clé manquante
        ):
            response = self.client.get(reverse('assistant-health'))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            data = response.json()
            self.assertFalse(data['config_ok'])
            self.assertGreaterEqual(len(data['errors']), 1)
