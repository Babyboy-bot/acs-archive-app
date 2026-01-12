"""Migration: Seed des particuliers (DIALLO MAHAMADOU -> FAMILLE MONTEIRO CYNTHIA) et de leurs exercices.
Idempotent.
"""

import uuid
from django.db import migrations


PARTICULIERS_EXERCICES = {
    "DIALLO MAHAMADOU": [2023, 2025],
    "DIALLO SOULEYMANE": [2001],
    "DIALLO YACINE IDRISS": [2021, 2022, 2023, 2024, 2025],
    "DIAQUET PIERRE MARIE": [2021, 2023],
    "DIARRA ABOUBACAR KARIM": [2022],
    "DIARRASSOUBA OUSMANE": [2023, 2024],
    "DIBY HERVE LOUIS": [2023],
    "DIOMANDE ALIMA": [2017],
    "DIOMANDE BRAHIMA OULOTO": [2018, 2025],
    "DIOP CHEICK": [2001],
    "DJAHA KOUAME ROCH": [2023],
    "DJAMA ANNICET FLAUBERT": [2024],
    "DJENEBA CAMARA": [2021, 2022],
    "DJIBRE PRISCA LOUISE": [2023, 2024],
    "DJIZOE KPASSOU SERGES DANIEL": [2021],
    "DJOUKA EPSE OUATTARA EDICHIE EMILIE": [2024],
    "DOBE EPSE ASSOMA DIDOHONON F.": [2019],
    "DOFFOU PASCAL": [2010],
    "DOGNINAN K. RAOUL": [2017],
    "DOSSO MAMADOU": [2023],
    "DOSSO SOGBO": [2021],
    "DOUEU OMER MICHEL": [2015, 2021, 2022],
    "DOUKOURE MAMERY": [2023],
    "DOUMBIA IBRAHIMA": [2019, 2021, 2023],
    "DOUMBOUYA FATOUMATA": [2014, 2015, 2016, 2017],
    "ECARE EPSE SAGNON HENRIETTE ADJIRI": [2025],
    "EHUI CLAUDE ARNAUD": [2019],
    "EKUE MOCKEY PARFAIT": [2024],
    "ELLOE ELLIAMENOGBOU": [2024],
    "ELLOGNE EBA KOUTOUA": [2019, 2021],
    "ELLOH ATTE CLAUDE": [2019],
    "EMMA EPSE OUEI BAH": [2023],
    "ESKIN JEAN YVES ROLAND": [2021],
    "ESSIENNE JOSIANNE": [2017],
    "EYEBIYE AKISSI MARIE DANIELLE": [2021],
    "EZOU AKA HUBERT": [2019, 2023, 2024],
    "FADIGA AMADOU": [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    "FADIGA FALIKOU": [2021],
    "FADIGA ISSA TANOU": [2018, 2019, 2021],
    "FADIGA MAMADOU": [2022],
    "FADIGA YOUSSOUF": [2018, 2021, 2022, 2023],
    "FAMILLE ADOM": [2023],
    "FAMILLE ASSI": [2017, 2018],
    "FAMILLE BAKAYOKO": [2020],
    "FAMILLE DRELLER": [2023],
    "FAMILLE ESMEL": [2017],
    "FAMILLE FAYE": [2016, 2017],
    "FAMILLE FOUMILAYO": [2022],
    "FAMILLE KOUAKOU KOUAME FLORENT": [2021, 2022],
    "FAMILLE MONTEIRO CYNTHIA": [2023],
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

    print(f"\n[Seed 0017] Clients créés: {created_clients}, Exercices créés: {created_exercices}")


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_seed_particuliers_exercices_cam_dial'),
    ]

    operations = [
        migrations.RunPython(seed, reverse_seed),
    ]
