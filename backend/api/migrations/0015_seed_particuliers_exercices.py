"""
Migration: Seed des clients particuliers et leurs exercices (années).
Idempotent - peut être relancée sans créer de doublons.
"""
import uuid
from django.db import migrations


PARTICULIERS_EXERCICES = {
    "BAKAYOKO ABOU": [2021, 2022, 2023],
    "BAKAYOKO DAOUDA": [2021, 2023],
    "BAMBA AGODIO GEDEON": [2025],
    "BAMBA AHMED KARAMOKO": [1998, 2006, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    "BAMBA ASTOU": [2019],
    "BAMBA CENTER": [2023, 2025],
    "BAMBA CHEICK DANIEL": [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2024],
    "BAMBA GEDEON": [2021, 2025],
    "BAMBA KADOKO DJOMO ZAKARYIA": [2023],
    "BAMBA MABADI": [2020, 2021],
    "BAMBA MAIMOUNA MANA": [2018, 2019],
    "BAMBA MAKISSIA": [2020],
    "BAMBA MAMADI": [2015, 2016, 2017, 2018, 2019, 2020],
    "BAMBA MAMADOU": [2019, 2021, 2023],
    "BAMBA MARIAME NAMAMAN": [2020, 2021],
    "BAMBA MARIAM EPSE TOURE": [2019],
    "BAMBA MASSIAMI": [2020, 2021],
    "BAMBA MOHAMED": [2019, 2024],
    "BAMBA N'GAGNETI": [2019],
    "BAMBA RAMATOU": [2023],
    "BAMBA SARAH ANITA JIHANE": [2024],
    "BAMBA SINZE": [2020, 2021, 2022, 2023],
    "BAMBA SIRIKI": [2023],
    "BAMBA SOULEYMANE": [2021],
    "BANA ISMAEL": [2018],
    "BANA PAULE MYRIAM CHARLOTTE": [2021],
    "BARTHE LASME": [2021],
    "BARTHE MARC PHILIPPE LORNG": [2018, 2019],
    "BEHOU N'TAMON EDOUARD": [2023],
    "BEKOU GATIEN": [2018, 2019, 2020, 2021, 2022, 2023],
    "BELEM BEN YOUSSEF": [2024],
    "BENIE EPSE YAPI N'KONOND AUGUSTE ROGER": [2019],
    "BESSE SONOU LANDRY P_C BIH DESCAR": [2024],
    "BIATCHON EPSE DIALLO MARIE RAPHAELLE": [2025],
    "BINATE EPSE BOBY NOZENE": [2023],
    "BLEDI BERANGER ARMAND": [2022],
    "BOBY GBAZA": [2022],
    "BOIQUI KOUADJO": [2021, 2023],
    "BONI ALFRED SEKA": [2017],
    "BONI OUATTARA DAVID ETHAN NIELBIEN": [2024],
    "BONY INNOCENT": [2022],
    "BORTEY SANDRINE": [2018],
    "BRAIMA COULIBALY": [2021],
    "BROU ADJO NOHRANE HIND": [2022],
    "BROU EKIEN DANIEL": [2022, 2023],
    "BROU EKPALE SYLVAIN": [2019],
    "BROU KOUAO NARCISSE": [2021, 2022],
    "BRUNO VAN EECKHOUT": [2015, 2017, 2019, 2021, 2022, 2024],
}


def seed_particuliers_exercices(apps, schema_editor):
    """Crée les clients particuliers et leurs exercices."""
    Client = apps.get_model('api', 'Client')
    Exercice = apps.get_model('api', 'Exercice')
    
    created_clients = 0
    created_exercices = 0
    
    for nom, annees in PARTICULIERS_EXERCICES.items():
        # Chercher ou créer le client
        client = Client.objects.filter(nom=nom).first()
        if not client:
            client = Client.objects.create(
                id=str(uuid.uuid4()),
                nom=nom,
                type='PARTICULIER',
            )
            created_clients += 1
        
        # Créer les exercices pour chaque année
        for annee in annees:
            exists = Exercice.objects.filter(client=client, annee=annee).exists()
            if not exists:
                Exercice.objects.create(
                    id=str(uuid.uuid4()),
                    client=client,
                    annee=annee,
                    statut='ACTIF',
                )
                created_exercices += 1
    
    print(f"\n[Seed] Clients créés: {created_clients}, Exercices créés: {created_exercices}")


def reverse_seed(apps, schema_editor):
    """Ne fait rien - on ne supprime pas les données créées."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_add_new_clients'),
    ]

    operations = [
        migrations.RunPython(seed_particuliers_exercices, reverse_seed),
    ]
