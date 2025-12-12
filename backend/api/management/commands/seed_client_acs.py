from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_ACS = {
    1998: [
        "SANTE",
    ],
    1999: [
        "INDIVIDUELLE ACCIDENTS",
        "SANTE",
    ],
    2000: [
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2001: [
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNEL",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2002: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2003: [
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
    ],
    2004: [
        "INDIVIDUELLE ACCIDENT",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2005: [
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2006: [
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2007: [
        "INDIVIDUELLE ACCIDENTS",
        "REGLEMENTS",
        "SANTE",
    ],
    2008: [
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2009: [
        "AUTOMOBILE",
        "DIVERS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2010: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2011: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2012: [
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2013: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2014: [
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2015: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2016: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2017: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENT",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2018: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2019: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2020: [
        "AUTOMOBILE",
        "DIVERS",
        "INDEMNITE DE FIN DE CARRIERE",
        "INDIVIDUEL ACCIDENT",
        "MULTIRISQUE PROFESSIONNEL",
        "REGLEMENT",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2021: [
        "AUTOMOBILE",
        "DIVERS GENERAL",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNEL",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "RETRAITE",
        "SANTE",
    ],
    2022: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFFESSIONNELLE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2023: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONABILITE CIVILE",
        "RETRAITE COMPLEMENTAIRE",
        "SANTE",
    ],
    2024: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "RETRAITE COMPLEMENTAIRE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2025: [
        "AUTOMOBILE",
        "DIVERS",
        "INDIVIDUELLE ACCIDENTS",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 1998-2025 et les risques associés pour le client ACS, sans tenir compte des codes entre parenthèses."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="ACS").first()
        if not client:
            raise CommandError('Client "ACS" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).')

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_ACS.items():
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
            f"Seed ACS terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
