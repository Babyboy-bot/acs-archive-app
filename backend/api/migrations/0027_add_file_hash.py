from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0026_soft_delete_document'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='file_hash',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
    ]
