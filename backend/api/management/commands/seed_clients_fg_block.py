from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


CLIENTS_FG_DATA = {
    "FAN ARCHI": {
        2017: [
            "DIVERS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2018: [
            "DIVERS",
            "SANTE",
        ],
        2019: [
            "DIVERS",
            "REGLEMENTS",
            "SANTE",
        ],
        2020: [
            "AUTOMOBILE",
            "DIVERS",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2021: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2022: [
            "INDIVIDUELLE ACCIDENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2023: [
            "CAUTION",
            "INDIVIDUELLE ACCIDENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2024: [
            "CAUTION",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2025: [
            "INDIVIDUELLE ACCIDENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
    },
    "FARAH POLYCLINIQUE": {
        2022: [
            "DIVERS",
        ],
    },
    "FEDERATION IVOIRIENNE DE FOOTBALL (FIF)": {
        2011: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2012: [
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2013: [
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TOUS RISQUES INFORMATIQUES",
            "TRANSPORT FACULTES",
        ],
        2014: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2015: [
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2016: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOYAGE",
        ],
        2017: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOYAGE",
        ],
        2018: [
            "AUTOMOBILE",
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOYAGE",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOYAGE",
        ],
        2020: [
            "DIVERS",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2021: [
            "DIVERS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "VOYAGE",
        ],
        2022: [
            "DIVERS",
            "SANTE",
        ],
    },
    "FFA TRANSPORT SARL": {
        2024: [
            "RESPONSABILITE CIVILE",
        ],
    },
    "FIDRA": {
        2022: [
            "AUTOMOBILE",
            "DIVERS",
            "REGLEMENTS",
        ],
        2023: [
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "DIVERS",
            "EVACUATION SANITAIRE",
            "GLOBALE BANQUE",
            "GLOBALE DOMMAGES",
            "PREVOYANCE DECES",
            "PREVOYANCE ENTREPRISE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2024: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "GLOBAL BANQUE",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE",
            "SANTE",
        ],
        2025: [
            "AUTOMOBILE",
            "GLOBALE BANQUE",
            "GLOBALE DOMMAGES",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
    },
    "FLEURIVOIRE": {
        1999: ["TRANSPORT FACULTES"],
        2000: [
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2001: ["TRANSPORT FACULTES"],
        2002: ["TRANSPORT FACULTES"],
        2003: ["TRANSPORT FACULTES"],
        2004: ["TRANSPORT FACULTES"],
        2005: ["TRANSPORT FACULTES"],
        2006: ["TRANSPORT FACULTES"],
        2007: ["TRANSPORT FACULTES"],
        2008: ["TRANSPORT FACULTES"],
        2009: ["TRANSPORT FACULTES"],
        2011: ["DIVERS"],
        2015: ["DIVERS"],
        2016: ["DIVERS"],
    },
    "FONDS D' ENTRETIEN ROUTIER (FER)": {
        2018: ["MULTIRISQUE PROFESSIONNELLE"],
        2019: ["MULTIRISQUE PROFESSIONNELLE"],
        2020: [
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
        ],
        2021: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
        ],
        2022: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2023: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "AUTOMOBILE",
            "DECES",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RENTE EDUCATION",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2024: [
            "AUTOMOBILE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2025: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
    },
    "FORTEX": {
        2022: ["SANTE"],
        2023: ["SANTE"],
        2024: ["SANTE"],
    },
    "FPPN": {
        2022: ["DIVERS"],
        2023: ["DIVERS"],
    },
    "FRED- POPPEE": {
        2022: ["SANTE"],
    },
    "GALERIES PEYRISSAC": {
        2022: ["REGLEMENTS"],
    },
    "GEBATEC": {
        2022: ["CAUTION"],
        2023: [
            "CAUTION",
            "TOUS RISQUES CHANTIER",
        ],
        2024: [
            "CAUTION",
            "TOUS RISQUES CHANTIER",
        ],
        2025: ["CAUTION"],
    },
    "GECO TP": {
        2020: [
            "CAUTION",
            "TOUS RISQUES CHANTIER",
        ],
        2021: [
            "CAUTION",
            "TOUS RISQUES CHANTIER",
        ],
        2022: ["TOUS RISQUES CHANTIER"],
    },
    "GESTOCI": {
        2016: [
            "FRAIS FUNERAIRES",
            "REGLEMENTS",
        ],
        2017: [
            "DIVERS",
            "FRAIS FUNERAIRES",
            "INDEMNITE DE FIN DE CARRIERE",
            "PREVOYANCE DECES",
            "PREVOYANCE ENTREPRISE",
            "REGLEMENTS",
            "RENTE EDUCATION",
        ],
        2018: [
            "AUTOMOBILE",
            "DECES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RENTE EDUCATION",
            "YDJEH",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "REGLEMENTS",
        ],
        2020: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DIVERS",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RENTE EDUCATION",
            "TOUS RISQUES CHANTIER",
        ],
        2021: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "AUTOMOBILE",
            "AUTRES",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE COLLECTIVE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RENTE EDUCATION",
        ],
        2022: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "PREVOYANCE ENTREPRISE",
            "REGLEMENTS",
            "RENTE EDUCATION",
            "SANTE",
        ],
        2023: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "AUTOMOBILE",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "RENTE EDUCATION",
            "RETRAITE COMPLEMENTAIRE",
        ],
        2024: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RENTE EDUCATION",
        ],
        2025: [
            "AUTOMOBILE",
            "FRAIS FUNERAIRES",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "RENTE SCOLAIRE",
            "RETRAITE",
        ],
    },
    "GEX ENTREPRISE": {
        2012: ["TOUS RISQUES CHANTIER"],
        2014: ["TOUS RISQUES CHANTIER"],
    },
    "GIE GEPPA": {
        2020: [
            "AUTOMOBILE",
            "DIVERS",
        ],
        2021: [
            "AUTOMOBILE",
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
        ],
        2022: [
            "AUTOMOBILE",
            "TRANSPORT FACULTES",
        ],
    },
    "GLOBAL CORPORATION": {
        2012: ["TOUS RISQUES CHANTIER"],
        2013: ["TOUS RISQUES CHANTIER"],
        2014: ["TOUS RISQUES CHANTIER"],
    },
    "GLOBAL EXPERTISE": {
        2012: ["TOUS RISQUES CHANTIER"],
    },
    "GOODWILL AUDIT & CONSULTING": {
        2022: [
            "DIVERS",
            "REGLEMENTS",
        ],
    },
    "GROUPE ASER": {
        2024: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "GROUPE ELITE": {
        1996: ["SANTE"],
        1997: ["SANTE"],
        1998: ["DIVERS"],
        1999: [
            "DIVERS",
            "SANTE",
        ],
        2000: [
            "DIVERS",
            "SANTE",
        ],
    },
    "GROUPEMENT ARTEMIS CONSTRUCTION ET TRAVAUX-ADS-MCT-SIPEL": {
        2023: ["TOUS RISQUES CHANTIER"],
    },
}


class Command(BaseCommand):
    help = "Crée les exercices et risques associés pour le bloc de clients F-G (FAN ARCHI → GROUPEMENT ARTEMIS), à partir des données legacy."

    def handle(self, *args, **options):
        total_exercices = 0
        total_risques = 0

        for client_name, data in CLIENTS_FG_DATA.items():
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
            f"Seed bloc clients F-G terminé : {total_exercices} exercices créés, {total_risques} risques créés."
        ))
