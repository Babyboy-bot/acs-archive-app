from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


CLIENTS_HI_DATA = {
    "HOTEL KORIET BETTY": {
        2023: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2024: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "HOTEL MONT BLANC": {
        2009: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "IB COTE D'IVOIRE": {
        2018: [
            "SANTE",
        ],
        2019: [
            "DIVERS",
            "SANTE",
        ],
    },
    "ICCO": {
        2019: ["AUTOMOBILE"],
        2020: [
            "AUTOMOBILE",
            "DIVERS",
        ],
        2021: ["AUTOMOBILE"],
        2022: ["AUTOMOBILE"],
        2023: ["AUTOMOBILE"],
        2024: ["AUTOMOBILE"],
        2025: [
            "AUTOMOBILE",
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "IMEX PHARMA": {
        2014: ["AUTOMOBILE"],
        2018: [
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2020: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
        ],
        2021: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
        ],
        2022: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2025: [
            "AUTOMOBILE",
            "GLOBALE DOMMAGES",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
    },
    "IMMEUBLE SIMON": {
        2005: [
            "MULTIRISQUE PROFESSIONNELLE",
        ],
        2006: [
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2007: [
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2008: [
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2009: [
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2010: [
            "DIVERS",
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2011: [
            "DIVERS",
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2012: [
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE IMMEUBLE",
        ],
        2013: [
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2014: [
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2016: [
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
        2017: [
            "MULTIRISQUE IMMEUBLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "INAD-CI": {
        2019: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2020: [
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2021: [
            "AUTRES",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2022: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2023: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2024: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2025: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOYAGE",
        ],
    },
    "INDUSTRIE DE TRANSFORMATION DE BOIS (IDTB)": {
        2006: ["AUTOMOBILE"],
        2007: ["AUTOMOBILE"],
        2008: ["AUTOMOBILE"],
        2009: ["AUTOMOBILE"],
    },
    "INSTAFRIC ELEC": {
        2019: [
            "DIVERS",
            "SANTE",
        ],
        2020: [
            "DIVERS",
            "SANTE",
        ],
        2021: [
            "DIVERS",
            "REGLEMENTS",
            "SANTE",
        ],
        2022: [
            "DIVERS",
            "REGLEMENTS",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2023: [
            "SANTE",
        ],
        2024: [
            "DIVERS",
        ],
    },
    "INSTITUT DE FORMATION PROFESSIONELLE AGRICOLE D'ADIAKE": {
        2025: [
            "INDIVIDUELLE ACCIDENT",
        ],
    },
    "INTER TRANSIT SERVICES (ITS)": {
        2014: [
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2015: [
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2016: [
            "TRANSPORT FACULTES",
        ],
        2017: [
            "DIVERS",
            "TRANSPORT FACULTES",
        ],
        2018: [
            "DIVERS",
            "TRANSPORT FACULTES",
        ],
        2020: [
            "TRANSPORT FACULTES",
        ],
    },
    "IPS-CGRAE": {
        2000: ["SANTE"],
        2001: ["SANTE"],
        2002: [
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
        ],
        2003: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2004: [
            "AUTOMOBILE",
            "DIVERS",
            "VOL ET DETOURNEMENTS",
        ],
        2005: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
        ],
        2006: [
            "AUTOMOBILE",
            "INDIVIDUELLE ACCIDENTS",
        ],
        2007: [
            "AUTOMOBILE",
            "INDIVIDUELLE ACCIDENTS",
            "PREVOYANCE DECES",
            "SANTE",
        ],
        2008: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2009: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2010: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "PREVOYANCE DECES",
            "SANTE",
        ],
        2011: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2012: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOL ET DETOURNEMENTS",
        ],
        2013: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "SANTE",
        ],
        2014: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE IMMEUBLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOLS ET DETOURNEMENTS",
        ],
        2015: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE IMMEUBLE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2016: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE IMMEUBLE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOL ET DETOURNEMENTS",
        ],
        2017: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE IMMEUBLE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2018: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE ENTREPRISE",
            "MULTIRISQUE IMMEUBLE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOL ET DETOURNEMENTS",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE IMMEUBLE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOL ET DETOURNEMENTS",
        ],
        2020: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE IMMEUBLE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOL ET DETOURNEMENTS",
        ],
        2021: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TOUS DOMMAGES SAUF",
            "VOL ET DETOURNEMENTS",
        ],
        2022: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOL ET DETOURNEMENT",
        ],
        2023: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DECES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE",
            "SANTE",
            "VOL ET DETOURNEMENT",
        ],
        2024: [
            "AUTOMOBILE",
            "DECES TOUTES CAUSES",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "VOL ET DETOURNEMENT",
        ],
        2025: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE COLLECTIVES",
            "PREVOYANCE DECES",
            "RESPONSABILITE CIVILE",
            "RETRAITE",
            "SANTE",
            "VOL ET DETOURNEMENT",
        ],
    },
    "IPS CNAM": {
        2024: ["DIVERS"],
    },
    "ITAL CONSTRUZIONI": {
        2016: [
            "DIVERS",
            "SANTE",
        ],
        2017: [
            "DIVERS",
            "SANTE",
        ],
        2018: ["SANTE"],
        2019: ["SANTE"],
    },
    "I TELECOM": {
        2003: ["SANTE"],
    },
    "IVENTRAD": {
        2024: [
            "AUTOMOBILE",
            "CAUTION",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2025: [
            "AUTOMOBILE",
            "CAUTION",
            "INDIVIDUELLE ACCIDENT",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENT",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
    },
    "IVOIR CAPITAL": {
        2021: [
            "AUTRES",
            "REGLEMENTS",
        ],
    },
    "IVOSEP": {
        1994: ["SANTE"],
        2001: [
            "DIVERS",
            "REGLEMENTS",
            "SANTE",
        ],
        2002: ["SANTE"],
        2013: [
            "AUTOMOBILE",
            "REGLEMENT",
        ],
        2016: [
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2017: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2018: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2020: ["DIVERS"],
    },
}


class Command(BaseCommand):
    help = "Crée les exercices et risques associés pour le bloc de clients H-I (HOTEL KORIET BETTY → IMMEUBLE SIMON), à partir des données legacy."

    def handle(self, *args, **options):
        total_exercices = 0
        total_risques = 0

        for client_name, data in CLIENTS_HI_DATA.items():
            client = Client.objects.filter(nom=client_name).first()
            if not client:
                self.stderr.write(self.style.WARNING(
                    f'Client "{client_name}" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).'
                ))
                continue

            created_exercices = 0
            created_risques = 0

            for annee, risques_types in data.items():
                exercice, ex_created = Exercice.objects.get_or_create(
                    client=client,
                    annee=annee,
                    defaults={"statut": "ACTIF"},
                )
                if ex_created:
                    created_exercices += 1
                    total_exercices += 1

                for risque_type in risques_types:
                    _, risque_created = Risque.objects.get_or_create(
                        exercice=exercice,
                        type=risque_type,
                        defaults={"numero_police": None},
                    )
                    if risque_created:
                        created_risques += 1
                        total_risques += 1

            self.stdout.write(self.style.SUCCESS(
                f'Seed {client_name} terminé : {created_exercices} exercices créés, {created_risques} risques créés.'
            ))

        self.stdout.write(self.style.SUCCESS(
            f"Seed bloc clients H-I terminé : {total_exercices} exercices créés, {total_risques} risques créés."
        ))
