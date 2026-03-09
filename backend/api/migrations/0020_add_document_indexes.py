from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_remove_assistant_learning_models'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='document',
            index=models.Index(fields=['type_courrier'], name='documents_type_courrier_idx'),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(fields=['est_archive'], name='documents_est_archive_idx'),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(fields=['date_document'], name='documents_date_document_idx'),
        ),
    ]
