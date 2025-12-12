from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CONSEIL_REGIONAL_DU_TCHOLOGO = {
    2014: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
    ],
    2015: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
    ],
    2016: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
    ],
    2017: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
    ],
    2018: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2019: [
        "AUTOMOBILE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2014-2019 et les risques associés pour le client CONSEIL REGIONAL DU TCHOLOGO."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="CONSEIL REGIONAL DU TCHOLOGO").first()
        if not client:
            raise CommandError('Client "CONSEIL REGIONAL DU TCHOLOGO" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CONSEIL_REGIONAL_DU_TCHOLOGO.items():
            exercice, ex_created = Exercice.objects.get_or_create(
                client=client,
                annee=annee,
                defaults={"statut": "ACTIF"},
            )
            if exCreated := ex_created:
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
            f"Seed CONSEIL REGIONAL DU TCHOLOGO terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
