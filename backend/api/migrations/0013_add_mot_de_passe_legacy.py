# Generated manually to fix missing motDePasse column

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_assistantquestionpattern_assistantinteraction_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='utilisateur',
            name='mot_de_passe_legacy',
            field=models.CharField(blank=True, db_column='motDePasse', default='', max_length=255),
        ),
    ]
