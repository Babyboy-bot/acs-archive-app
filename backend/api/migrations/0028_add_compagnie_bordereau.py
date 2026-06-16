from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0027_add_file_hash'),
    ]

    operations = [
        migrations.CreateModel(
            name='Compagnie',
            fields=[
                ('id', models.TextField(default=uuid.uuid4, primary_key=True, serialize=False)),
                ('nom', models.CharField(max_length=255)),
                ('code', models.CharField(max_length=50, unique=True)),
                ('actif', models.BooleanField(default=True)),
                ('cree_le', models.DateTimeField(auto_now_add=True, db_column='creeLe')),
                ('modifie_le', models.DateTimeField(auto_now=True, db_column='modifieLe')),
            ],
            options={
                'verbose_name': 'Compagnie',
                'verbose_name_plural': 'Compagnies',
                'db_table': 'compagnies',
                'ordering': ['nom'],
            },
        ),
        migrations.CreateModel(
            name='Bordereau',
            fields=[
                ('id', models.TextField(default=uuid.uuid4, primary_key=True, serialize=False)),
                ('titre', models.CharField(max_length=255)),
                ('reference', models.CharField(blank=True, max_length=100, null=True)),
                ('annee', models.IntegerField()),
                ('chemin_fichier', models.CharField(db_column='cheminFichier', max_length=500)),
                ('type_fichier', models.CharField(db_column='typeFichier', max_length=50)),
                ('taille_fichier', models.IntegerField(db_column='tailleFichier')),
                ('file_hash', models.CharField(blank=True, db_index=True, max_length=64, null=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('cree_le', models.DateTimeField(auto_now_add=True, db_column='creeLe')),
                ('modifie_le', models.DateTimeField(auto_now=True, db_column='modifieLe')),
                ('compagnie', models.ForeignKey(
                    db_column='compagnieId',
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='bordereaux',
                    to='api.compagnie',
                )),
                ('auteur', models.ForeignKey(
                    db_column='auteurId',
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='bordereaux',
                    to='api.utilisateur',
                )),
                ('deleted_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='bordereaux_supprimes',
                    to='api.utilisateur',
                )),
            ],
            options={
                'verbose_name': 'Bordereau',
                'verbose_name_plural': 'Bordereaux',
                'db_table': 'bordereaux',
                'ordering': ['-annee', '-cree_le'],
            },
        ),
        migrations.AddIndex(
            model_name='bordereau',
            index=models.Index(fields=['compagnie'], name='bordereau_compagnie_idx'),
        ),
        migrations.AddIndex(
            model_name='bordereau',
            index=models.Index(fields=['annee'], name='bordereau_annee_idx'),
        ),
        migrations.AddIndex(
            model_name='bordereau',
            index=models.Index(fields=['auteur'], name='bordereau_auteur_idx'),
        ),
        migrations.AddIndex(
            model_name='bordereau',
            index=models.Index(fields=['cree_le'], name='bordereau_cree_le_idx'),
        ),
    ]
