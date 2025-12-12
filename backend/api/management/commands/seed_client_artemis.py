from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_ARTEMIS = {
    2021: [
        "TOUS RISQUES CHANTIER",
    ],
    2022: [
        "TOUS RISQUES CHANTIER",
    ],
    2023: [
        "TOUS RISQUES CHANTIER",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2021-2023 et les risques associés pour le client ARTEMIS."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="ARTEMIS").first()
        if not client:
            raise CommandError('Client "ARTEMIS" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_ARTEMIS.items():
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
            f"Seed ARTEMIS terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
