from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """
    La table audit_logs existe déjà en base (créée hors migrations).
    On utilise SeparateDatabaseAndState pour enregistrer l'état du modèle
    dans Django sans toucher la base de données.
    """

    dependencies = [
        ('api', '0024_add_chunking_status'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],  # rien à faire en DB, la table existe déjà
            state_operations=[
                migrations.CreateModel(
                    name='AuditLog',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('timestamp', models.DateTimeField(auto_now_add=True, db_index=True)),
                        ('utilisateur_nom', models.CharField(blank=True, max_length=255)),
                        ('action', models.CharField(
                            choices=[
                                ('CREATE', 'Création'),
                                ('READ', 'Consultation'),
                                ('UPDATE', 'Modification'),
                                ('DELETE', 'Suppression'),
                                ('DOWNLOAD', 'Téléchargement'),
                                ('PRINT', 'Impression'),
                                ('EXPORT', 'Export'),
                                ('LOGIN', 'Connexion'),
                                ('LOGOUT', 'Déconnexion'),
                                ('SEARCH', 'Recherche'),
                                ('ACCESS_DENIED', 'Accès refusé'),
                            ],
                            db_index=True,
                            max_length=20,
                        )),
                        ('resource_type', models.CharField(
                            choices=[
                                ('document', 'Document'),
                                ('client', 'Client'),
                                ('exercice', 'Exercice'),
                                ('risque', 'Risque'),
                                ('utilisateur', 'Utilisateur'),
                                ('categorie', 'Catégorie'),
                                ('session', 'Session'),
                                ('assistant', 'Assistant IA'),
                            ],
                            db_index=True,
                            max_length=50,
                        )),
                        ('resource_id', models.CharField(blank=True, max_length=100)),
                        ('resource_name', models.CharField(blank=True, max_length=500)),
                        ('details', models.JSONField(blank=True, default=dict)),
                        ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                        ('user_agent', models.TextField(blank=True)),
                        ('success', models.BooleanField(default=True)),
                        ('error_message', models.TextField(blank=True)),
                        ('utilisateur', models.ForeignKey(
                            blank=True,
                            null=True,
                            on_delete=django.db.models.deletion.SET_NULL,
                            related_name='audit_logs',
                            to=settings.AUTH_USER_MODEL,
                        )),
                    ],
                    options={
                        'verbose_name': "Journal d'audit",
                        'verbose_name_plural': "Journaux d'audit",
                        'db_table': 'audit_logs',
                        'ordering': ['-timestamp'],
                    },
                ),
            ],
        ),
    ]
