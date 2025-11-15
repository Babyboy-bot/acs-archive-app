from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_alter_document_type_courrier_alter_risque_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="utilisateur",
            name="telephone",
            field=models.CharField(max_length=50, blank=True, null=True),
        ),
    ]
