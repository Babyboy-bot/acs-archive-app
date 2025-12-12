from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_ALBEDO = {
    2004: [
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2005: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2006: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2007: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2008: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "SANTE",
    ],
    2009: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2010: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2011: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2012: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2013: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2014: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2015: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "TRANSPORT FACULTES",
    ],
    2016: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2017: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2018: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2019: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2020: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2021: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "TRANSPORT FACULTES",
    ],
    2022: [
        "AUTOMOBILE",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "VOYAGE",
    ],
    2023: [
        "AUTOMOBILE",
        "CAUTION",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "VOYAGE",
    ],
    2024: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "VOYAGE",
    ],
    2025: [
        "AUTOMOBILE",
        "CAUTION",
        "EVACUATION SANITAIRE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
        "TRANSPORT FACULTES",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2004-2025 et les risques associés pour le client ALBEDO, en ignorant les codes entre parenthèses."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="ALBEDO").first()
        if not client:
            raise CommandError('Client "ALBEDO" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_ALBEDO.items():
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
            f"Seed ALBEDO terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
