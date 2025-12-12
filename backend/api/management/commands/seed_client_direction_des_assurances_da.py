from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_DIRECTION_ASSURANCES_DA = {
    2017: [
        "AUTOMOBILE",
    ],
    2018: [
        "AUTOMOBILE",
    ],
    2019: [
        "AUTOMOBILE",
        "REGLEMENTS",
    ],
    2020: [
        "AUTOMOBILE",
        "REGLEMENTS",
    ],
    2021: [
        "AUTOMOBILE",
        "REGLEMENTS",
    ],
    2022: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "RESPONSABILITE CIVILE",
    ],
    2023: [
        "AUTOMOBILE",
    ],
    2024: [
        "AUTOMOBILE",
        "DIVERS",
        "RESPONSABILITE CIVILE",
    ],
    2025: [
        "AUTOMOBILE",
        "RESPONSABILITE CIVILE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2017-2025 et les risques associés pour le client DIRECTION DES ASSURANCES (DA)."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="DIRECTION DES ASSURANCES (DA)").first()
        if not client:
            raise CommandError('Client "DIRECTION DES ASSURANCES (DA)" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_DIRECTION_ASSURANCES_DA.items():
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
            f"Seed DIRECTION DES ASSURANCES (DA) terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
