"""Migration: Seed des particuliers (FAMILLE OSSIE -> KONAN NEE BONI KOUADIO LILIANE) et de leurs exercices.
Idempotent.

Note: FE KOMODE est ignoré (pas d'année fournie, seulement "REGLEMENTS").
"""

import uuid
from django.db import migrations


PARTICULIERS_EXERCICES = {
    "FAMILLE OSSIE": [2017],
    "FANE SALIMATOU": [2024],
    "FANNY AMARA": [2004, 2006, 2007, 2008, 2009, 2010, 2011, 2017],
    "FANNY DRAMANE": [2018, 2019, 2020],
    "FANNY EPSE KONE AISSATA": [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2016, 2017, 2020, 2021, 2022, 2023, 2024, 2025],
    "FANNY EPSE SYLLA MEHITA": [2019, 2021, 2022],
    "FANNY FOUSSENY JEAN LUC": [2023],
    "FANNY KOROTHOUMOU": [2019, 2023],
    "FANNY SIAKA": [2024],
    "FANNY ZAVA": [2004, 2006, 2007, 2008, 2009, 2010, 2011, 2017],
    "FARIA PAULETTE": [2001],
    "FATOU KEITA": [2021],
    "FAURE VINCENT SANDY": [2010, 2012],
    "FAYE AMINATA": [2018],
    "FEUE KOUADIO EPSE AOURO": [2017],
    "FEU YAPI HYPPOLITE": [2022],
    "FOFANA EPSE FANNY AISSATA": [2025],
    "FOFANA SORHI BRAHIMA": [2025],
    "FONGBE LASSANA": [2009],
    "FOUMILAYO CYNTHIA": [2022, 2023],
    "GAUDJI KOUDOU JOSEPH DESIRE": [2019],
    "GBA ATCHO FIRMIN": [2023],
    "GBAKA ANGE THIERRY": [2023],
    "GBARI ITCHY JEAN DE DIEU": [2024],
    "GNACHOU YVON CHRISTIAN": [2019, 2021],
    "GNAKADE LADJI JOACHIM": [2025],
    "GNAKO ZAGONONHON": [2022],
    "GNANDJI EPSE M'POUE _ PETROCI": [2021],
    "GUEFIE TATOU PATRICK HERMAN": [2024],
    "GUEYE FATOU HENRIETTE": [2023],
    "GUINDO AMINATA": [2019],
    "GUINDO OUMOU": [2023, 2024],
    "HAGE ALI KARIM": [2023],
    "HAMZA CHEICK ABDEL KADER": [2018, 2019, 2021],
    "HAMZA MOHAMED TAHAR": [2019, 2020, 2021],
    "HEBA EPSE KOUACOU ADJOUA": [2022],
    "HOFMANN WOLFGANG. JOSET": [2019, 2020, 2021, 2023, 2024],
    "HOUPLON GABRIEL GEORGES": [2017],
    "INAI EPSE ZREHON MONNEHORO HORTENSE": [2025],
    "KABA NIALE": [2018, 2020, 2021, 2022],
    "KADJO AKO MATHIEU": [2019],
    "KAMBIRE HENRY JOELLE": [2023],
    "KANATE NATAGALY": [2024],
    "KANGAH AHISSA EPSE ELLOH": [2018],
    "KANGAH N'DRI JEANNE": [2022],
    "KANGOU ATSE FRANCOIS": [2017, 2020],
    "KANGOUTE ABOU": [2021],
    "KASSI MAHIKY KLA ANNELIA": [2024],
    "KATCHO BAMBA SABINE EPSE ATHIAS": [2018, 2021],
    "KAUNAN ERNEST PATRICE": [2025],
    "KEITA KADY": [2021, 2022, 2025],
    "KILI EPSE SANGARE YOUENON EULALIE": [2024],
    "KIMBA IDRISSA": [2023],
    "KLA EPSE KOUAME": [2021],
    "KODO MARIE PAULE ARMANDE": [2018],
    "KOFFI ADJOUA EPSE PAPOIN": [2017, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    "KOFFI APPO MARIE CHANTAL": [2021, 2022, 2023, 2024],
    "KOFFI JEAN VINCENT STEVENS": [2025],
    "KOFFI KOUAKOU LANDRY": [2023],
    "KOFFI KOUASSI MATHIAS": [2021],
    "KOFFI KOUASSI SEBASTIEN": [2021, 2022],
    "KOFFI N'GORAN": [2023],
    "KOFFI N'GORAN GHISLAINE": [2023],
    "KOKO BROU": [2020],
    "KOMENAN BINTOUH ELOISE ADEBATH": [2019, 2020],
    "KOMOIN KOUASSI": [2019],
    "KONAN AHOU HORTENSE": [2016],
    "KONAN AHOU ODETTE": [2017],
    "KONAN KOFFI EDMOND": [2018],
    "KONAN KONAN ARMAND DIDIER": [2019, 2024],
    "KONAN KOUADIO CELESTIN": [2017, 2018, 2019, 2022, 2023, 2024, 2025],
    "KONAN LEONCE MARY DARIUS": [2018],
    "KONAN NEE BONI KOUADIO LILIANE": [2024],
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

    print(f"\n[Seed 0018] Clients créés: {created_clients}, Exercices créés: {created_exercices}")


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_seed_particuliers_exercices_diallo_famille'),
    ]

    operations = [
        migrations.RunPython(seed, reverse_seed),
    ]
