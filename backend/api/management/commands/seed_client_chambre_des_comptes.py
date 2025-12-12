from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_CHAMBRE_DES_COMPTES = {
    2012: [
        "DIVERS",
    ],
}


class Command(BaseCommand):
    help = "Crée l'exercice 2012 et les risques associés pour le client CHAMBRE DES COMPTES."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="CHAMBRE DES COMPTES").first()
        if not client:
            raise CommandError('Client "CHAMBRE DES COMPTES" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_CHAMBRE_DES_COMPTES.items():
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
            f"Seed CHAMBRE DES COMPTES terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
