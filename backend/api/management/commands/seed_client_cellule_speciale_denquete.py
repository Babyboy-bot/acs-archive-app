from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CELLULE_SPECIALE_DENQUETE = {
    2011: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE BUREAU",
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2012: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE BUREAU",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2011-2012 et les risques associés pour le client CELLULE SPECIALE D'ENQUETE."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="CELLULE SPECIALE D'ENQUETE").first()
        if not client:
            raise CommandError("Client 'CELLULE SPECIALE D'ENQUETE' introuvable. Vérifie d'abord qu'il est importé (load_legacy_clients).")

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CELLULE_SPECIALE_DENQUETE.items():
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
            f"Seed CELLULE SPECIALE D'ENQUETE terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
