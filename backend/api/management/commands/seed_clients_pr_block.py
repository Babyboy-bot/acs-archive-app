from django.core.management.base import BaseCommand

from api.models import Client, Exercice, Risque


CLIENTS_PR_DATA = {
    "PARMSJP": {
        2019: ["AUTOMOBILE"],
        2020: ["AUTOMOBILE"],
    },
    "PETROCI": {
        2014: [
            "AUTOMOBILE",
            "AUTRES",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2016: [
            "AUTOMOBILE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "SINISTRE",
            "TRANSPORT FACULTES",
        ],
        2017: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
        ],
        2018: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "BLOC CI 11",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
        ],
        2019: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "BLOC CI 11",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
            "VOYAGE",
        ],
        2020: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "BLOC CI 11",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
            "VOYAGE",
        ],
        2021: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "BLOC CI 11",
            "DIVERS",
            "GLOBALE DOMMAGES",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
            "VOYAGE",
        ],
        2022: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "BLOC CI 11",
            "DECES",
            "DIVERS",
            "HORIZON RETRAITE",
            "INCENDIE",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
            "VOYAGE",
        ],
        2023: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "BLOC CI 11",
            "DECES EMPRUNTEUR",
            "DIVERS",
            "INCENDIE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "PREVOYANCE ENTREPRISE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
            "VOL",
            "VOYAGE",
        ],
        2024: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "BLOC CI 11",
            "DIVERS",
            "INDEMNITES FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TOUS DOMMAGES SAUF",
            "TRANSPORT FACULTES",
            "VOL",
            "VOYAGE",
        ],
        2025: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "CORPS ET MOTEUR",
            "DECES EMPRUNTEUR",
            "DIVERS",
            "INDEMNITES FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "PIPELINES",
            "PREVOYANCE DECES",
            "RACHAT CAPITAL RETRAITE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TOUS DOMMAGES SAUF",
            "TOUS RISQUES SAUF",
            "TRANSPORT FACULTES",
            "VOYAGE",
        ],
    },
    "PEWE EURL": {
        2023: ["CAUTION"],
        2024: ["CAUTION"],
    },
    "PHARMACIE KAHIRA": {
        2021: ["SANTE"],
    },
    "PHARMACIE MALIKA": {
        2025: ["SANTE"],
    },
    "PNUD": {
        2010: ["AUTOMOBILE"],
    },
    "POSTE DE COTE D'IVOIRE": {
        2021: ["FACTURES"],
    },
    "PREMOTO": {
        1998: [
            "AUTOMOBILE",
            "SANTE",
        ],
        1999: [
            "DIVERS",
            "SANTE",
        ],
        2000: [
            "AUTOMOBILE",
            "DIVERS",
            "GLOBALE DOMMAGES",
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2001: [
            "AUTOMOBILE",
            "DIVERS",
            "SANTE",
        ],
        2002: [
            "AUTOMOBILE",
            "INDIVIDUELLE ACCIDENTS",
        ],
    },
    "PRESTIMEX": {
        2016: ["DIVERS"],
    },
    "PRICE WATER HOUSE COOPERS COTE D'IVOIRE": {
        2022: ["DIVERS"],
    },
    "RADIO NOSTALGIE": {
        1998: ["AUTOMOBILE"],
        1999: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RETRAITE",
            "SANTE",
        ],
        2000: ["SANTE"],
        2008: ["DIVERS"],
        2016: ["DIVERS"],
    },
    "RADIO TELEVISION IVOIRIENNE (RTI)": {
        1996: ["VOL"],
        1997: [
            "AUTOMOBILE",
            "VOL",
        ],
        1998: ["AUTOMOBILE"],
        1999: ["AUTOMOBILE"],
    },
    "RESIAM": {
        2015: [
            "INDIVIDUELLE ACCIDENTS",
            "TOUS RISQUES CHANTIER",
        ],
        2016: [
            "INDIVIDUELLE ACCIDENTS",
            "SANTE",
        ],
        2017: ["DIVERS"],
        2018: ["TOUS RISQUES CHANTIER"],
        2019: ["RESPONSABILITE CIVILE"],
        2020: ["RESPONSABILITE CIVILE"],
    },
    "RESTO PLUS": {
        2011: ["SANTE"],
        2012: [
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
        ],
        2014: ["RESPONSABILITE CIVILE"],
        2015: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2016: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2017: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2019: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2020: ["DIVERS"],
        2021: [
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
        ],
        2022: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2023: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2024: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2025: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
    },
}


class Command(BaseCommand):
    help = "Crée les exercices et risques associés pour le bloc de clients P-R (PARMSJP → RESTO PLUS), à partir des données legacy."

    def handle(self, *args, **options):
        total_exercices = 0
        total_risques = 0

        for client_name, data in CLIENTS_PR_DATA.items():
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
            f"Seed bloc clients P-R terminé : {total_exercices} exercices créés, {total_risques} risques créés."
        ))
