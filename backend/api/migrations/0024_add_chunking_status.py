# Generated migration for chunking_status

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_add_missing_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='chunkingStatus',
            field=models.CharField(
                choices=[('pending', 'En attente'), ('completed', 'Terminé'), ('failed', 'Échoué')],
                default='pending',
                max_length=20,
                db_column='chunkingStatus'
            ),
        ),
        migrations.AddField(
            model_name='document',
            name='chunkingError',
            field=models.TextField(blank=True, null=True, db_column='chunkingError'),
        ),
    ]
