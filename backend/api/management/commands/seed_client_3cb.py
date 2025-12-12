from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_3CB = {
    2016: [
        "SANTE",
    ],
    2017: [
        "SANTE",
    ],
    2018: [
        "SANTE",
    ],
    2019: [
        "DIVERS",
        "SANTE",
    ],
    2020: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "MULTIRISQUES PROFESSIONNEL(MRP)",
        "SANTE",
    ],
    2021: [
        "AUTOMOBILE",
        "CAUTION",
        "DIVERS",
        "MULTIRISQUE IMMEUBLE (M.R.I)",
        "MULTIRISQUE PROFESSIONNELLE (M R P)",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE ( R C)",
        "SANTE",
    ],
    2022: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE (MRP)",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE (RC)",
        "SANTE",
    ],
    2023: [
        "MULTIRISQUE PROFESSIONNELLE (MRP)",
        "RESPONABILITE CIVILE (RC)",
        "SANTE",
        "TOUS RISQUES CHANTIER",
    ],
    2024: [
        "MULTIRISQUE PROFESSIONNELLE (MRP)",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE (RC)",
        "SANTE",
    ],
    2025: [
        "RESPONSABILITE CIVILE (RC)",
        "SANTE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2016-2025 et les risques associés pour le client 3CB."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="3CB").first()
        if not client:
            raise CommandError('Client "3CB" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_3CB.items():
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
            f"Seed 3CB terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
