"""
Migration pour supprimer les modèles AssistantInteraction et AssistantQuestionPattern.
Ces modèles faisaient partie du système d'apprentissage qui a été supprimé.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_seed_particuliers_exercices_famille_ossie_konan'),
    ]

    operations = [
        migrations.DeleteModel(
            name='AssistantInteraction',
        ),
        migrations.DeleteModel(
            name='AssistantQuestionPattern',
        ),
    ]
