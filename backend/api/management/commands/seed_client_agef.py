from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_AGEF = {
    2011: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2012: [
        "AUTOMOBILE",
        "RETRAITE",
        "SANTE",
    ],
    2013: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2014: [
        "AUTOMOBILE",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2015: [
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2016: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "REGLEMENTS",
        "SANTE",
        "SINISTRE",
        "TRANSPORT FACULTES",
    ],
    2017: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2018: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2019: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2020: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2021: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2022: [
        "AUTOMOBILE",
        "DIVERS",
        "SANTE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2011-2022 et les risques associés pour le client AGEF, en ignorant les codes entre parenthèses."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="AGEF").first()
        if not client:
            raise CommandError('Client "AGEF" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_AGEF.items():
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
            f"Seed AGEF terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
