from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CENTRADIS = {
    1994: [
        "INDIVIDUELLE ACCIDENTS",
    ],
    1995: [
        "INDIVIDUELLE ACCIDENTS",
    ],
    1996: [
        "INDIVIDUELLE ACCIDENTS",
    ],
    1997: [
        "INDIVIDUELLE ACCIDENTS",
        "SANTE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 1994-1997 et les risques associés pour le client CENTRADIS."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="CENTRADIS").first()
        if not client:
            raise CommandError('Client "CENTRADIS" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CENTRADIS.items():
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
            f"Seed CENTRADIS terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
