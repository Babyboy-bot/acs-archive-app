from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


CLIENTS_E_DATA = {
    "ECAM COOP- CA": {
        2022: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "PREVOYANCE DECES",
        ],
        2023: [
            "ASSISTANCE FRAIS FUNERAILLES",
        ],
    },
    "ECBM": {
        2015: [
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
        ],
        2016: [
            "RESPONSABILITE CIVILE",
        ],
    },
    "EEGCI": {
        2011: ["RESPONSABILITE CIVILE"],
        2012: ["RESPONSABILITE CIVILE"],
    },
    "EGBCI": {
        2019: [
            "CAUTION",
            "MULTIRISQUE IMMEUBLE",
        ],
        2020: [
            "CAUTION",
        ],
    },
    "EGC CI": {
        2024: [
            "CAUTION",
            "INDIVIDUELLE ACCIDENTS",
            "RESPONSABILITE CIVILE",
        ],
    },
    "EIBMA": {
        2010: ["AUTOMOBILE"],
        2011: ["DIVERS"],
        2017: ["MULTIRISQUE PROFESSIONNELLE"],
    },
    "EITD SERVICES": {
        2017: ["CAUTION"],
        2018: ["CAUTION"],
    },
    "EKDS": {
        2022: [
            "CAUTION",
            "DIVERS",
            "TOUS RISQUES CHANTIER",
        ],
        2023: [
            "CAUTION",
            "TOUS RISQUES CHANTIER",
        ],
        2024: [
            "CAUTION",
            "REGLEMENTS",
            "TOUS RISQUES CHANTIER",
        ],
        2025: [
            "CAUTION",
            "TOUS RISQUES CHANTIER",
        ],
    },
    "EKOUN SARL": {
        2011: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2012: [
            "MULTIRISQUE PROFESSIONNELLE",
        ],
    },
    "ELEC SERVICES": {
        2011: ["AUTOMOBILE"],
        2012: ["AUTOMOBILE"],
        2013: ["AUTOMOBILE"],
        2014: ["AUTOMOBILE"],
        2016: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
        ],
        2017: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "SANTE",
        ],
        2018: [
            "AUTOMOBILE",
            "ASSISTANCE FRAIS FUNERAILLES",
            "MULTIRISQUE PROFESSIONNELLE",
            "SANTE",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "ASSISTANCE FRAIS FUNERAILLES",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2020: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2021: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
        ],
        2022: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2023: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2024: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DECES",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2025: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DECES",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
    },
    "ELITE CI CONSULTING SARL": {
        2018: ["RESPONSABILITE CIVILE"],
        2019: [
            "DIVERS",
            "RESPONSABILITE CIVILE",
        ],
    },
    "EMAUCI": {
        2008: [
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2009: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2010: [
            "AUTOMOBILE",
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "EMITEL- CI": {
        2012: ["TOUS RISQUES CHANTIER"],
        2013: [
            "REGLEMENTS",
            "TOUS RISQUES CHANTIER",
        ],
        2014: ["TOUS RISQUES CHANTIER"],
    },
    "ENSBTP": {
        2013: ["TOUS RISQUES CHANTIER"],
        2014: ["TOUS RISQUES CHANTIER"],
        2015: [
            "INDIVIDUELLE ACCIDENTS",
            "TOUS RISQUES CHANTIER",
        ],
        2016: [
            "INDIVIDUELLE ACCIDENTS",
            "TOUS RISQUES CHANTIER",
        ],
    },
    "ENTREPRISE BATIMENT EDAGNE (EBE)": {
        2013: [
            "INDIVIDUELLE ACCIDENTS",
            "TOUS RISQUES CHANTIER",
        ],
        2014: [
            "INDIVIDUELLE ACCIDENTS",
            "TOUS RISQUES CHANTIER",
        ],
    },
    "ENTREPRISE D'ETUDE ET DE CONSTRUCTION DE BATIMENTS (EECB)": {
        2013: [
            "AUTOMOBILE",
            "REGLEMENTS",
            "SANTE",
        ],
        2014: [
            "COURRIERS ACS - CLIENT",
        ],
    },
    "ENTREPRISE MOUROUFIE": {
        2012: ["TOUS RISQUES CHANTIER"],
        2014: ["TOUS RISQUES CHANTIER"],
        2015: [
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "TOUS RISQUES CHANTIER",
        ],
        2016: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2017: [
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2018: [
            "AUTOMOBILE",
            "DIVERS",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
        ],
        2019: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DIVERS",
            "RESPONSABILITE CIVILE",
        ],
        2020: [
            "AUTOMOBILE",
            "REGLEMENTS",
        ],
        2021: ["AUTOMOBILE"],
        2022: ["AUTOMOBILE"],
    },
    "ENTRETIEN DEPANNAGE DISTRIBUTION (EDD)": {
        2018: ["AUTOMOBILE"],
        2019: ["AUTOMOBILE"],
        2020: ["AUTOMOBILE"],
        2021: [
            "AUTOMOBILE",
            "REGLEMENTS",
        ],
        2022: ["AUTOMOBILE"],
        2023: ["AUTOMOBILE"],
        2024: [
            "AUTOMOBILE",
            "REGLEMENTS",
        ],
        2025: ["AUTOMOBILE"],
    },
    "ENTRPRISE ENCB": {
        2012: ["TOUS RISQUES CHANTIER"],
        2014: ["TOUS RISQUES CHANTIER"],
    },
    "EPTTB": {
        2021: ["TOUS RISQUES CHANTIER"],
    },
    "ERNST ET YOUNG COTE D'IVOIRE": {
        2022: ["DIVERS"],
    },
    "ESPACYL CI": {
        2023: ["AUTOMOBILE"],
    },
    "ETS FJ": {
        2023: ["AUTOMOBILE"],
    },
    "ETS MAKO": {
        2012: ["RESPONSABILITE CIVILE"],
        2013: ["RESPONSABILITE CIVILE"],
        2014: ["RESPONSABILITE CIVILE"],
    },
    "ETS NOURA": {
        2024: [
            "CAUTION",
            "TOUS RISQUES CHANTIER",
        ],
    },
    "ETS SOUTRA": {
        2017: ["GLOBAL DOMMAGES"],
        2018: ["MULTIRISQUE COMMERCANT"],
        2020: ["MULTIRISQUE PROFESSIONNELLE"],
        2021: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "EVECHE DE YAMOUSSOUKRO": {
        2002: ["AUTOMOBILE"],
    },
    "EVIPTP": {
        2024: ["CAUTION"],
    },
}


class Command(BaseCommand):
    help = "Crée les exercices et risques associés pour le bloc de clients E (ECAM COOP-CA → EVIPTP), à partir des données legacy."

    def handle(self, *args, **options):
        total_exercices = 0
        total_risques = 0

        for client_name, data in CLIENTS_E_DATA.items():
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
            f"Seed bloc clients E terminé : {total_exercices} exercices créés, {total_risques} risques créés."
        ))
