"""
Migration 0029 : Relier Bordereau.compagnie vers Client (ENTREPRISE)
au lieu du modèle Compagnie supprimé.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0028_add_compagnie_bordereau'),
    ]

    operations = [
        # 1. Supprimer les index sur Bordereau.compagnie
        migrations.RemoveIndex(
            model_name='bordereau',
            name='bordereau_compagnie_idx',
        ),
        # 2. Supprimer l'ancienne FK vers Compagnie
        migrations.RemoveField(
            model_name='bordereau',
            name='compagnie',
        ),
        # 3. Ajouter la nouvelle FK vers Client
        migrations.AddField(
            model_name='bordereau',
            name='compagnie',
            field=models.ForeignKey(
                db_column='compagnieId',
                limit_choices_to={'type': 'ENTREPRISE'},
                on_delete=django.db.models.deletion.PROTECT,
                related_name='bordereaux',
                to='api.client',
            ),
            preserve_default=False,
        ),
        # 4. Supprimer le modèle Compagnie
        migrations.DeleteModel(
            name='Compagnie',
        ),
        # 5. Re-créer l'index sur compagnie
        migrations.AddIndex(
            model_name='bordereau',
            index=models.Index(fields=['compagnie'], name='bordereau_compagnie_idx'),
        ),
    ]
