"""
Tests pour l'API
"""
import json
from unittest import mock
from django.test import TestCase, override_settings
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


class BaseAPITestCase(APITestCase):
    """
    Classe de base pour les tests API qui gère les redirections.
    Utilise follow=True pour suivre automatiquement les redirections 301/302.
    """
    
    def _make_request(self, method, url, data=None, format='json', **kwargs):
        """Helper pour faire des requêtes en suivant les redirections."""
        kwargs.setdefault('follow', True)
        request_method = getattr(self.client, method)
        if data is not None:
            return request_method(url, data, format=format, **kwargs)
        return request_method(url, **kwargs)
    
    def get(self, url, **kwargs):
        return self._make_request('get', url, **kwargs)
    
    def post(self, url, data=None, **kwargs):
        return self._make_request('post', url, data, **kwargs)
    
    def put(self, url, data=None, **kwargs):
        return self._make_request('put', url, data, **kwargs)
    
    def patch(self, url, data=None, **kwargs):
        return self._make_request('patch', url, data, **kwargs)
    
    def delete(self, url, **kwargs):
        return self._make_request('delete', url, **kwargs)


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
        # Utiliser force_authenticate au lieu du login
        self.client.force_authenticate(user=self.admin)
        url = reverse('utilisateur-list')
        response = self.client.get(url, follow=True)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_list_utilisateurs_unauthenticated(self):
        """Test de liste des utilisateurs (non authentifié)"""
        url = reverse('utilisateur-list')
        response = self.client.get(url, follow=True)
        
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

        # Utiliser force_authenticate pour éviter les problèmes de redirection
        self.client.force_authenticate(user=self.user)

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
        response = self.client.get(reverse('assistant-stats'), follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('documents_par_mois', data)
        self.assertIn('top_clients', data)
        self.assertIn('kpi', data)

    def test_assistant_tfidf_search(self):
        response = self.client.get(reverse('assistant-document-search-tfidf'), {'q': 'responsabilité'}, follow=True)
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

        response = self.client.get(reverse('assistant-document-search-faiss'), {'q': 'responsabilité'}, follow=True)
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
            format='json')

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
            format='json')

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
            format='json')

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
        response = self.client.get(url, follow=True)
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
            response = self.client.get(reverse('assistant-health'), follow=True)
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
            response = self.client.get(reverse('assistant-health'), follow=True)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            data = response.json()
            self.assertFalse(data['config_ok'])
            self.assertGreaterEqual(len(data['errors']), 1)


class AuditLogTests(APITestCase):
    """Tests pour le journal d'audit."""

    def setUp(self):
        self.client = APIClient()
        
        # Admin pour accéder aux logs
        self.admin = Utilisateur.objects.create_user(
            nom_utilisateur='audit.admin',
            nom='Audit',
            prenom='Admin',
            password='StrongPass123!',
            role='ADMIN',
            email='audit.admin@test.com',
        )
        
        # Utilisateur non-admin
        self.user = Utilisateur.objects.create_user(
            nom_utilisateur='audit.user',
            nom='Audit',
            prenom='User',
            password='StrongPass123!',
            role='CONSULTANT',
            email='audit.user@test.com',
        )

    def test_audit_log_model_creation(self):
        """Test de création d'une entrée d'audit via le modèle."""
        from .models import AuditLog
        
        log = AuditLog.log(
            action='CREATE',
            resource_type='document',
            resource_id='123',
            resource_name='Test Document',
            utilisateur=self.admin,
            details={'field': 'value'},
            ip_address='127.0.0.1',
            success=True,
        )
        
        self.assertIsNotNone(log.id)
        self.assertEqual(log.action, 'CREATE')
        self.assertEqual(log.resource_type, 'document')
        self.assertEqual(log.utilisateur_nom, str(self.admin))
        self.assertEqual(log.details, {'field': 'value'})

    def test_audit_log_list_admin_only(self):
        """Seuls les admins peuvent voir les logs d'audit."""
        from .models import AuditLog
        
        # Créer quelques logs
        AuditLog.log(action='LOGIN', resource_type='session', utilisateur=self.user)
        AuditLog.log(action='READ', resource_type='document', resource_id='1', utilisateur=self.admin)
        
        # Test avec admin
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('audit-log-list'), follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['total'], 2)
        self.assertEqual(len(data['logs']), 2)
        
        # Test avec non-admin
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse('audit-log-list'), follow=True)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_log_list_filters(self):
        """Test des filtres sur la liste des logs."""
        from .models import AuditLog
        
        AuditLog.log(action='CREATE', resource_type='document', utilisateur=self.admin)
        AuditLog.log(action='READ', resource_type='document', utilisateur=self.admin)
        AuditLog.log(action='LOGIN', resource_type='session', utilisateur=self.user)
        
        self.client.force_authenticate(user=self.admin)
        
        # Vérifier que les logs sont retournés
        response = self.client.get(reverse('audit-log-list'), follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['total'], 3)

    def test_audit_log_detail(self):
        """Test de récupération du détail d'un log."""
        from .models import AuditLog
        
        log = AuditLog.log(
            action='UPDATE',
            resource_type='client',
            resource_id='42',
            resource_name='Client Test',
            utilisateur=self.admin,
            details={'before': {'nom': 'Old'}, 'after': {'nom': 'New'}},
        )
        
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('audit-log-detail', args=[log.id]), follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['action'], 'UPDATE')
        self.assertEqual(data['details']['before']['nom'], 'Old')

    def test_audit_log_stats(self):
        """Test des statistiques d'audit."""
        from .models import AuditLog
        
        AuditLog.log(action='CREATE', resource_type='document', utilisateur=self.admin)
        AuditLog.log(action='CREATE', resource_type='document', utilisateur=self.admin)
        AuditLog.log(action='READ', resource_type='client', utilisateur=self.user)
        
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('audit-log-stats'), follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['total_logs'], 3)


@skip("Endpoints d'apprentissage sont des placeholders - fonctionnalité en développement")
class AssistantLearningTests(APITestCase):
    """Tests pour les endpoints d'apprentissage de l'assistant."""

    def setUp(self):
        self.client = APIClient()
        self.user = Utilisateur.objects.create_user(
            nom_utilisateur='learning.user',
            nom='Learning',
            prenom='User',
            password='StrongPass123!',
            role='ADMIN',
            email='learning@test.com',
        )
        self.client.force_authenticate(user=self.user)

    def test_learning_record_interaction(self):
        """Test d'enregistrement d'une interaction."""
        url = reverse('assistant-learning-record')
        response = self.client.post(url, {
            'id': 'int_test_123',
            'question': 'Quels sont les documents du client ABC ?',
            'question_normalized': 'documents client abc',
            'response': 'Voici les documents trouvés...',
            'intent': 'documents',
            'type_message': 'document',
            'response_time_ms': 150,
            'llm_used': False,
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['id'], 'int_test_123')

    def test_learning_record_duplicate_id(self):
        """Test qu'un ID dupliqué met à jour l'interaction existante."""
        from .models import AssistantInteraction
        
        # Créer une interaction
        AssistantInteraction.objects.create(
            id='int_dup_123',
            question='Question originale',
            question_normalized='question originale',
            response='Réponse originale',
            intent='documents',
        )
        
        url = reverse('assistant-learning-record')
        response = self.client.post(url, {
            'id': 'int_dup_123',
            'question': 'Question mise à jour',
            'question_normalized': 'question mise a jour',
            'response': 'Réponse mise à jour',
            'intent': 'statistiques',
            'type_message': 'statistiques',
            'response_time_ms': 200,
            'llm_used': True,
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Vérifier la mise à jour
        interaction = AssistantInteraction.objects.get(id='int_dup_123')
        self.assertEqual(interaction.question, 'Question mise à jour')
        self.assertEqual(interaction.intent, 'statistiques')

    def test_learning_similar_search(self):
        """Test de recherche d'interactions similaires."""
        from .models import AssistantInteraction
        
        # Créer des interactions
        AssistantInteraction.objects.create(
            id='int_sim_1',
            question='Documents du client ACME',
            question_normalized='documents client acme',
            response='Voici les documents ACME',
            intent='documents',
            feedback='positive',
        )
        AssistantInteraction.objects.create(
            id='int_sim_2',
            question='Statistiques mensuelles',
            question_normalized='statistiques mensuelles',
            response='Voici les stats',
            intent='statistiques',
        )
        
        url = reverse('assistant-learning-similar')
        response = self.client.get(url, {'q': 'documents client'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)
        # Devrait trouver l'interaction avec "documents client"
        self.assertGreaterEqual(len(data['results']), 1)

    def test_learning_stats(self):
        """Test des statistiques d'apprentissage."""
        from .models import AssistantInteraction
        
        AssistantInteraction.objects.create(
            id='int_stat_1', question='Q1', question_normalized='q1',
            response='R1', intent='documents', feedback='positive',
        )
        AssistantInteraction.objects.create(
            id='int_stat_2', question='Q2', question_normalized='q2',
            response='R2', intent='documents', feedback='negative',
        )
        AssistantInteraction.objects.create(
            id='int_stat_3', question='Q3', question_normalized='q3',
            response='R3', intent='statistiques', feedback='positive',
        )
        
        url = reverse('assistant-learning-stats')
        response = self.client.get(url, follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['total_interactions'], 3)
        self.assertEqual(data['feedback_positive'], 2)
        self.assertEqual(data['feedback_negative'], 1)

    def test_learning_pattern_update(self):
        """Test de mise à jour des patterns de questions."""
        url = reverse('assistant-learning-patterns')
        response = self.client.post(url, {
            'pattern': 'documents client',
            'example': 'quels sont les documents du client xyz',
            'response': 'Voici les documents trouvés pour XYZ',
            'feedback_score': 1,
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['pattern'], 'documents client')
        self.assertEqual(data['frequency'], 1)

    def test_learning_pattern_increment_frequency(self):
        """Test que les patterns existants voient leur fréquence incrémentée."""
        from .models import AssistantQuestionPattern
        
        # Créer un pattern existant
        AssistantQuestionPattern.objects.create(
            pattern='stats mensuelles',
            frequency=5,
            avg_feedback_score=0.8,
        )
        
        url = reverse('assistant-learning-patterns')
        response = self.client.post(url, {
            'pattern': 'stats mensuelles',
            'example': 'montre moi les stats du mois',
            'response': 'Voici les statistiques',
            'feedback_score': 1,
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        pattern = AssistantQuestionPattern.objects.get(pattern='stats mensuelles')
        self.assertEqual(pattern.frequency, 6)


class DocumentModelTests(TestCase):
    """Tests pour le modèle Document."""

    def setUp(self):
        self.user = Utilisateur.objects.create_user(
            nom_utilisateur='doc.user',
            nom='Doc',
            prenom='User',
            password='StrongPass123!',
            role='ARCHIVISTE',
            email='doc@test.com',
        )
        self.client_obj = Client.objects.create(nom='Client Test')
        self.exercice = Exercice.objects.create(annee=2024, client=self.client_obj)
        self.categorie = Categorie.objects.create(nom='Catégorie Test')
        self.risque = Risque.objects.create(exercice=self.exercice, type='RC')

    def test_document_creation(self):
        """Test de création d'un document."""
        doc = Document.objects.create(
            titre='Document Test',
            description='Description test',
            chemin_fichier='documents/test.pdf',
            type_fichier='application/pdf',
            taille_fichier=2048,
            type_courrier='ACS_VERS_CLIENT',
            risque=self.risque,
            auteur=self.user,
            categorie=self.categorie,
            reference='DOC-TEST-001',
        )
        
        self.assertIsNotNone(doc.id)
        self.assertEqual(doc.titre, 'Document Test')
        self.assertEqual(doc.risque.exercice.client.nom, 'Client Test')

    def test_document_str(self):
        """Test de la représentation string d'un document."""
        doc = Document.objects.create(
            titre='Mon Document',
            chemin_fichier='documents/mon_doc.pdf',
            type_fichier='application/pdf',
            taille_fichier=1024,
            type_courrier='CLIENT_VERS_ACS',
            risque=self.risque,
            auteur=self.user,
            categorie=self.categorie,
        )
        
        self.assertIn('Mon Document', str(doc))


class ClientModelTests(TestCase):
    """Tests pour le modèle Client."""

    def test_client_creation(self):
        """Test de création d'un client."""
        client = Client.objects.create(
            nom='Entreprise ABC',
            numero_client='ABC001',
            adresse='123 Rue Test',
            email='contact@abc.com',
        )
        
        self.assertIsNotNone(client.id)
        self.assertEqual(client.nom, 'Entreprise ABC')
        self.assertEqual(client.numero_client, 'ABC001')

    def test_client_str(self):
        """Test de la représentation string d'un client."""
        client = Client.objects.create(nom='Client XYZ')
        self.assertEqual(str(client), 'Client XYZ')


class RolePermissionTests(APITestCase):
    """Tests pour les permissions basées sur les rôles."""

    def setUp(self):
        self.client_api = APIClient()
        
        self.admin = Utilisateur.objects.create_user(
            nom_utilisateur='perm.admin',
            nom='Perm', prenom='Admin',
            password='StrongPass123!',
            role='ADMIN',
            email='perm.admin@test.com',
        )
        
        self.archiviste = Utilisateur.objects.create_user(
            nom_utilisateur='perm.archiviste',
            nom='Perm', prenom='Archiviste',
            password='StrongPass123!',
            role='ARCHIVISTE',
            email='perm.archiviste@test.com',
        )
        
        self.consultant = Utilisateur.objects.create_user(
            nom_utilisateur='perm.consultant',
            nom='Perm', prenom='Consultant',
            password='StrongPass123!',
            role='CONSULTANT',
            email='perm.consultant@test.com',
        )

    def test_admin_can_create_user(self):
        """Un admin peut créer un utilisateur."""
        self.client_api.force_authenticate(user=self.admin)
        response = self.client_api.post(reverse('utilisateur-list'), {
            'nom_utilisateur': 'new.user',
            'nom': 'New',
            'prenom': 'User',
            'password': 'NewPass123!',
            'role': 'CONSULTANT',
            'email': 'new@test.com',
        }, format='json')
        
        self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_200_OK])

    def test_consultant_cannot_create_user(self):
        """Un consultant ne peut pas créer un utilisateur."""
        self.client_api.force_authenticate(user=self.consultant)
        response = self.client_api.post(reverse('utilisateur-list'), {
            'nom_utilisateur': 'blocked.user',
            'nom': 'Blocked',
            'prenom': 'User',
            'password': 'BlockedPass123!',
            'role': 'CONSULTANT',
            'email': 'blocked@test.com',
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_consultant_can_read_documents(self):
        """Un consultant peut lire les documents."""
        self.client_api.force_authenticate(user=self.consultant)
        response = self.client_api.get(reverse('document-list'), follow=True)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)





