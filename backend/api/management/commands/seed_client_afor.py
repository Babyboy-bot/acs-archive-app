from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_AFOR = {
    2018: [
        "AUTOMOBILE",
        "SANTE",
    ],
    2019: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE",
        "SANTE",
    ],
    2020: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFFESSIONNELLE",
        "REGLEMENTS",
        "SANTE",
        "VOYAGE",
    ],
    2021: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE",
        "SANTE",
    ],
    2022: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "SANTE",
        "VOYAGE",
    ],
    2023: [
        "AUTOMOBILE",
        "MULTIRISQUE PROFESSIONNELLE",
        "SANTE",
        "VOYAGE",
    ],
    2024: [
        "AUTOMOBILE",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "SANTE",
        "VOYAGE",
    ],
    2025: [
        "AUTOMOBILE",
        "MULTIRISQUE PROFESSIONNELLE",
        "SANTE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2018-2025 et les risques associés pour le client AFOR, sans tenir compte des codes entre parenthèses."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="AFOR").first()
        if not client:
            raise CommandError('Client "AFOR" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_AFOR.items():
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
            f"Seed AFOR terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
