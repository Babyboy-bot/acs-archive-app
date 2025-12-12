from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CABINET_PEUMONT_KONAN_SIMEON = {
    2021: [
        "RESPONABILITE CIVILE",
    ],
}


class Command(BaseCommand):
    help = "Crée l'exercice 2021 et les risques associés pour le client CABINET PEUMONT KONAN SIMEON."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="CABINET PEUMONT KONAN SIMEON").first()
        if not client:
            raise CommandError('Client "CABINET PEUMONT KONAN SIMEON" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CABINET_PEUMONT_KONAN_SIMEON.items():
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
            f"Seed CABINET PEUMONT KONAN SIMEON terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
