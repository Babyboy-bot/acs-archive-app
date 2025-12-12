from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_AFRICA_RICE = {
    2010: [
        "DIVERS",
        "TEMPORAIRE DECES",
    ],
    2011: [
        "PREVOYANCE DECES",
    ],
    2012: [
        "PREVOYANCE DECES",
        "SANTE",
    ],
    2013: [
        "DIVERS",
        "PREVOYANCE DECES",
        "SANTE",
    ],
    2014: [
        "DIVERS",
        "REGLEMENTS",
    ],
    2015: [
        "PREVOYANCE DECES",
    ],
    2016: [
        "PREVOYANCE DECES",
    ],
    2017: [
        "PREVOYANCE DECES",
    ],
    2018: [
        "DIVERS",
        "PREVOYANCE DECES",
        "REGLEMENTS",
    ],
    2019: [
        "DIVERS",
        "PREVOYANCE DECES",
        "REGLEMENTS",
    ],
    2020: [
        "DIVERS",
        "INDEMNITE DE FIN DE CARRIERE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
    ],
    2021: [
        "DIVERS",
        "PREVOYANCE DECES",
        "REGLEMENTS",
    ],
    2022: [
        "DIVERS",
        "PREVOYANCE DECES",
        "REGLEMENTS",
    ],
    2023: [
        "DIVERS",
        "PREVOYANCE DECES",
        "TEMPORAIRE DECES",
    ],
    2024: [
        "PREVOYANCE DECES",
        "TEMPORAIRE DECES",
    ],
    2025: [
        "PREVOYANCE DECES",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2010-2025 et les risques associés pour le client AFRICA RICE, sans tenir compte des codes entre parenthèses."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="AFRICA RICE").first()
        if not client:
            raise CommandError('Client "AFRICA RICE" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_AFRICA_RICE.items():
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
            f"Seed AFRICA RICE terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
