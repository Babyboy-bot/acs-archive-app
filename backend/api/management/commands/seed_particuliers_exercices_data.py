"""
Seed: Crée les clients particuliers et leurs exercices (années) directement en base.
Données intégrées en dur dans le code - idempotent (relançable sans doublons).
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Client, Exercice


# Format: { "NOM CLIENT": [année1, année2, ...], ... }
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


class Command(BaseCommand):
    help = "Seed: crée les clients particuliers et leurs exercices (années) - données en dur."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche ce qui serait créé sans écrire en base.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)

        created_clients = 0
        updated_clients = 0
        created_exercices = 0

        with transaction.atomic():
            for nom, annees in PARTICULIERS_EXERCICES.items():
                # Créer ou récupérer le client
                client, created = Client.objects.get_or_create(
                    nom=nom,
                    defaults={"type": "PARTICULIER"},
                )
                if created:
                    created_clients += 1
                    self.stdout.write(f"  [+] Client créé: {nom}")
                else:
                    # Forcer type PARTICULIER si différent
                    if client.type != "PARTICULIER":
                        client.type = "PARTICULIER"
                        client.save(update_fields=["type"])
                        updated_clients += 1
                        self.stdout.write(f"  [~] Client mis à jour (type -> PARTICULIER): {nom}")

                # Créer les exercices pour chaque année
                for annee in annees:
                    _, ex_created = Exercice.objects.get_or_create(
                        client=client,
                        annee=annee,
                        defaults={"statut": "ACTIF"},
                    )
                    if ex_created:
                        created_exercices += 1

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("\n[DRY-RUN] Aucune modification enregistrée."))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSeed terminé: "
                f"clients créés={created_clients}, "
                f"clients mis à jour={updated_clients}, "
                f"exercices créés={created_exercices}"
            )
        )
