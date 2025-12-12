from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CNE_CI_TP_NSIKAN = {
    2015: [
        "INDIVIDUELLE ACCIDENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TOUS RISQUES CHANTIER",
    ],
}


class Command(BaseCommand):
    help = "Crée l'exercice 2015 et les risques associés pour le client CNE-CI TP N'SIKAN."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="CNE-CI TP N'SIKAN").first()
        if not client:
            raise CommandError("Client 'CNE-CI TP N'SIKAN' introuvable. Vérifie d'abord qu'il est importé (load_legacy_clients).")

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CNE_CI_TP_NSIKAN.items():
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
            f"Seed CNE-CI TP N'SIKAN terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
