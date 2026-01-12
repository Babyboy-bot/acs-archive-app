"""Migration: Seed des particuliers (CAMARA... DIALLO IRENE SOPHIE) et de leurs exercices.
Idempotent.
"""

import uuid
from django.db import migrations


PARTICULIERS_EXERCICES = {
    "CAMARA KATIA IGNACE": [2022],
    "CAMARA LANSACOH": [2017],
    "CAMARA SIAKA": [2024],
    "CAMARA SIAKA P_C YAYA MUTIU": [2021, 2022],
    "CANANZOE MOUSSA": [2021],
    "CHAUDRON MAURICE": [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    "CHEICK DIOP": [2021],
    "CHERIF MAMADOU": [2019],
    "CISSE MASSAHO": [2022, 2023],
    "CISSE MOYABI": [2024],
    "CODO MICHEL CLAUDE LEOPOLD": [2024],
    "CORINE RIQUET VALENTINE": [2015, 2017, 2018, 2019, 2021, 2022, 2023, 2025],
    "COULIBALY ABIBATA": [2020],
    "COULIBALY AMENAN OLGA": [2013, 2015, 2018, 2022, 2023],
    "COULIBALY CONSTANT": [2017, 2019, 2020],
    "COULIBALY EPSE OUATARRA MASSENEBA": [2025],
    "COULIBALY EPSE TIACOH FOUSSEINA": [2022, 2023],
    "COULIBALY FAIGNAN NEHOUELE PIERRE": [2022],
    "COULIBALY GNENEMA MAMADOU": [2015, 2017, 2019, 2020, 2021, 2022, 2023, 2024],
    "COULIBALY IDRISSA": [2022],
    "COULIBALY KATHY LAUREEN MAMINAN": [2025],
    "COULIBALY KONAN THEODORE": [2021, 2023],
    "COULIBALY KOUNANDY MORIBA": [2023],
    "COULIBALY NAGNENE SINALY": [2022],
    "COULIBALY NAKHOUBANH WILFRIED KEVIN": [2024],
    "COULIBALY SAMIGA": [2025],
    "COULIBALY SIAKA MINAYAHA": [2023],
    "DABO DIOULO AXEL-AIME": [2023],
    "DAH SIE": [2025],
    "DA PIERRE": [2017, 2018, 2019, 2020, 2021],
    "DEDOH DACOURY": [2020, 2023],
    "DEDOKOTON DEGLA YVES JOEL": [2023],
    "DEHOULOU TIENDJIKE NADINE": [2021],
    "DEMEL EDJEM JEANNE": [2020],
    "DEM EPSE NIACADE": [2019],
    "DETHIE EPSE DIAGNE M'BENGUE": [2024],
    "DIABY KAMOUROU": [2025],
    "DIAKITE BAKARI": [2017],
    "DIAKITE FADIMA": [2002],
    "DIAKITE FATOUMATA": [2015, 2021, 2023, 2024, 2025],
    "DIALLO EPSE COULIBALY OUMOU": [2020],
    "DIALLO IRENE SOPHIE": [2001],
}


def seed(apps, schema_editor):
    Client = apps.get_model('api', 'Client')
    Exercice = apps.get_model('api', 'Exercice')

    created_clients = 0
    created_exercices = 0

    for nom, annees in PARTICULIERS_EXERCICES.items():
        client = Client.objects.filter(nom=nom).first()
        if not client:
            client = Client.objects.create(
                id=str(uuid.uuid4()),
                nom=nom,
                type='PARTICULIER',
            )
            created_clients += 1

        for annee in annees:
            if not Exercice.objects.filter(client=client, annee=annee).exists():
                Exercice.objects.create(
                    id=str(uuid.uuid4()),
                    client=client,
                    annee=annee,
                    statut='ACTIF',
                )
                created_exercices += 1

    print(f"\n[Seed 0016] Clients créés: {created_clients}, Exercices créés: {created_exercices}")


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_seed_particuliers_exercices'),
    ]

    operations = [
        migrations.RunPython(seed, reverse_seed),
    ]
