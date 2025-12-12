from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_COUR_DE_CASSATION = {
    2021: [
        "AUTOMOBILE",
        "DIVERS",
        "SANTE",
    ],
    2022: [
        "AUTOMOBILE",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "SANTE",
    ],
    2023: [
        "AUTOMOBILE",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "SANTE",
    ],
    2024: [
        "AUTOMOBILE",
        "SANTE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2021-2024 et les risques associés pour le client COUR DE CASSATION."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="COUR DE CASSATION").first()
        if not client:
            raise CommandError('Client "COUR DE CASSATION" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_COUR_DE_CASSATION.items():
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
            f"Seed COUR DE CASSATION terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
