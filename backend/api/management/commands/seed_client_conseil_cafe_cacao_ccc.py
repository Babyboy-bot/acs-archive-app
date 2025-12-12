from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CCC = {
    2017: [
        "AUTOMOBILE",
        "DIVERS GENERAL",
        "EVACUATION SANITAIRE",
        "GLOBALE DOMMAGES",
        "INDEMNITE DE FIN DE CARRIERE",
        "INDIVIDUELLE ACCIDENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
        "VOL ET DETOURNEMENTS",
    ],
    2018: [
        "AUTOMOBILE",
        "DIVERS GENERAL",
        "EVACUATION SANITAIRE",
        "GLOBAL DOMMAGE",
        "INDEMNITE DE FIN DE CARRIERE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
        "VOYAGE",
    ],
    2019: [
        "AUTOMOBILE",
        "DIVERS GENERAL",
        "GLOBALE DOMMAGES",
        "INDEMNITE DE FIN DE CARRIERE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
        "VOL ET DETOURNEMENTS",
        "VOYAGE",
    ],
    2020: [
        "AUTOMOBILE",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "RETRAITE COMPLEMENTAIRE",
        "SANTE",
        "TRANSPORT FACULTES",
        "VOYAGE",
    ],
    2021: [
        "AUTOMOBILE",
        "DEGATS DES EAUX",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "TRANSPORT FACULTES",
        "VOYAGE",
    ],
    2022: [
        "AUTOMOBILE",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
        "VOYAGE",
    ],
    2023: [
        "AUTOMOBILE",
        "BRIS DE MACHINE",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "TRANSPORT FACULTES",
        "VOYAGE",
    ],
    2024: [
        "AUTOMOBILE",
        "BRIS DE MACHINE",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "GLOBALE DOMMAGES",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
        "VOYAGE",
    ],
    2025: [
        "ASSISTANCE FRAIS FUNERAILLES",
        "AUTOMOBILE",
        "BRIS DE MACHINE",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TEMPORAIRE DECES",
        "TRANSPORT FACULTES",
        "VOYAGE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2017-2025 et les risques associés pour le client CONSEIL CAFE CACAO (CCC)."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="CONSEIL CAFE CACAO (CCC)").first()
        if not client:
            raise CommandError('Client "CONSEIL CAFE CACAO (CCC)" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CCC.items():
            exercice, ex_created = Exercice.objects.get_or_create(
                client=client,
                annee=annee,
                defaults={"statut": "ACTIF"},
            )
            if ex_created:
                created_exercices += 1

            for risque_type in risques_types:
                _, risque_created = Risque.objects.get_or_create(
                    exercice=exercice,
                    type=risque_type,
                    defaults={"numero_police": None},
                )
                if risque_created:
                    created_risques += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seed CONSEIL CAFE CACAO (CCC) terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
