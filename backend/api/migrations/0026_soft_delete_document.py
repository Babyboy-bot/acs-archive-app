from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0025_add_audit_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='is_deleted',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='document',
            name='deleted_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='document',
            name='deleted_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='documents_supprimes',
                to='api.utilisateur',
            ),
        ),
    ]
