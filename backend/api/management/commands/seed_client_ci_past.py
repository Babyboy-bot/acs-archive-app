from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CI_PAST = {
    2002: [
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2003: [
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2004: [
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2005: [
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2006: [
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2008: [
        "AUTOMOBILE",
        "SANTE",
    ],
    2009: [
        "MULTIRISQUE PROFESSIONNELLE",
        "SANTE",
    ],
    2010: [
        "REGLEMENTS",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2002-2010 et les risques associés pour les clients CI-PAST / CI PAST."

    def handle(self, *args, **options):
        clients = list(Client.objects.filter(nom__in=["CI-PAST", "CI PAST"]))
        if not clients:
            raise CommandError(
                'Clients "CI-PAST" / "CI PAST" introuvables. Vérifie d\'abord qu\'ils sont importés (load_legacy_clients).'
            )

        total_exercices = 0
        total_risques = 0

        for client in clients:
            created_exercices = 0
            created_risques = 0

            for annee, risques_types in DATA_CI_PAST.items():
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

            total_exercices += created_exercices
            total_risques += created_risques

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed CI-PAST / CI PAST terminé : {total_exercices} exercices créés, {total_risques} risques créés."
            )
        )
