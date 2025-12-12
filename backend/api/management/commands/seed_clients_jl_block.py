from django.core.management.base import BaseCommand

from api.models import Client, Exercice, Risque


CLIENTS_JL_DATA = {
    "JARS TECHNOLOGIES": {
        2021: [
            "SANTE",
        ],
        2022: [
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2023: [
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
        2024: [
            "RESPONSABILITE CIVILE",
            "SANTE",
        ],
    },
    "JB COCOA": {
        2022: ["SANTE"],
        2023: ["SANTE"],
        2024: ["SANTE"],
        2025: ["SANTE"],
    },
    "JLB EXPERTISE": {
        2022: [
            "DIVERS",
            "TRANSPORT FACULTES",
        ],
        2023: [
            "TRANSPORT FACULTES",
        ],
        2024: [
            "TRANSPORT FACULTES",
        ],
        2025: [
            "TRANSPORT FACULTES",
        ],
    },
    "KGMA SARL": {
        2019: [
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2020: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "TOUS RISQUES CHANTIER",
        ],
        2021: [
            "TOUS RISQUES CHANTIER",
        ],
    },
    "KH ASSURANCES CONSEILS": {
        2024: ["AUTOMOBILE"],
    },
    "KSF IMMOBILIER": {
        2023: ["DIVERS"],
    },
    "L'AMATRANS": {
        1999: ["SANTE"],
    },
    "LAND & SEA ENERGY CONSULTING": {
        2022: [
            "RESPONSABILITE CIVILE",
        ],
    },
    "LA PLANQUITA": {
        2011: ["AUTOMOBILE"],
        2012: ["DIVERS"],
        2015: [
            "INDIVIDUELLE ACCIDENTS",
        ],
        2018: [
            "AUTOMOBILE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2020: ["DIVERS"],
    },
    "LEADWAY": {
        2022: ["DIVERS"],
    },
    "LES SIRENNES D'ASSINIE": {
        2021: [
            "RESPONSABILITE CIVILE",
        ],
    },
    "LION GPL": {
        2022: [
            "RESPONSABILITE CIVILE",
            "TOUS DOMMAGES SAUF",
        ],
        2023: [
            "RESPONSABILITE CIVILE",
            "TOUS DOMMAGES SAUF",
        ],
        2024: [
            "RESPONSABILITE CIVILE",
            "TOUS DOMMAGES SAUF",
        ],
        2025: [
            "RESPONSABILITE CIVILE",
            "TOUS RISQUES SAUF",
        ],
    },
    "LONACI": {
        2012: ["AUTOMOBILE"],
        2013: ["AUTOMOBILE"],
        2014: ["AUTOMOBILE"],
        2015: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2016: [
            "AUTOMOBILE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOLS ET DETOURNEMENTS",
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
            "GLOBALE DOMMAGES",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOL ET DETOURNEMENTS",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "GLOBALE DOMMAGES",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOL ET DETOURNEMENTS",
        ],
        2020: [
            "AUTOMOBILE",
            "DIVERS",
            "GLOBALE DOMMAGES",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOLS ET DETOURNEMENTS",
        ],
        2021: [
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "TRANSPORT FACULTES",
            "VOLS ET DETOURNEMENTS",
        ],
        2022: [
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "TRANSPORT FACULTES",
            "VOLS ET DETOURNEMENTS",
        ],
        2023: [
            "AUTOMOBILE",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "RETRAITE",
            "TRANSPORT FACULTES",
            "VOLS ET DETOURNEMENTS",
        ],
        2024: [
            "AUTOMOBILE",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE HABITATION",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE",
            "TRANSPORT FACULTES",
            "VOLS ET DETOURNEMENTS",
        ],
        2025: [
            "ASSURANCE DEPART ENTREPRISE",
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "RETRAITE",
            "TRANSPORT FACULTES",
            "VOL ET DETOURNEMENT",
        ],
    },
}


class Command(BaseCommand):
    help = "Crée les exercices et risques associés pour le bloc de clients J-L (JARS TECHNOLOGIES → LONACI), à partir des données legacy."

    def handle(self, *args, **options):
        total_exercices = 0
        total_risques = 0

        for client_name, data in CLIENTS_JL_DATA.items():
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
            f"Seed bloc clients J-L terminé : {total_exercices} exercices créés, {total_risques} risques créés."
        ))
