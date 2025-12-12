from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_BURIDA = {
    2011: [
        "AUTOMOBILE",
    ],
    2015: [
        "DIVERS",
    ],
    2019: [
        "DIVERS",
        "RESPONSABILITE CIVILE",
    ],
    2020: [
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2011, 2015, 2019, 2020 et les risques associés pour le client BURIDA."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="BURIDA").first()
        if not client:
            raise CommandError('Client "BURIDA" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_BURIDA.items():
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
            f"Seed BURIDA terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
