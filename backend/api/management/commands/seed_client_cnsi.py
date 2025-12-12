from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CNSI = {
    2005: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
    ],
    2006: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
    ],
    2007: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2008: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "SANTE",
    ],
    2009: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
    ],
    2010: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
    ],
    2012: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "SANTE",
    ],
    2013: [
        "SANTE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2005-2013 et les risques associés pour le client COMMISSION NATIONALE DE SUPERVISION DE L'IDENTIFICATION (CNSI)."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="COMMISSION NATIONALE DE SUPERVISION DE L'IDENTIFICATION (CNSI)").first()
        if not client:
            raise CommandError("Client 'COMMISSION NATIONALE DE SUPERVISION DE L'IDENTIFICATION (CNSI)' introuvable. Vérifie d'abord qu'il est importé (load_legacy_clients).")

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CNSI.items():
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
            f"Seed CNSI terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
