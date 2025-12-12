from django.core.management.base import BaseCommand, CommandError

from api.models import Client, Exercice, Risque


DATA_BNI = {
    2015: [
        "AUTOMOBILE",
        "AUTRES",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2016: [
        "AUTOMOBILE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "SINISTRE",
        "TRANSPORT FACULTES",
    ],
    2017: [
        "AUTOMOBILE",
        "AUTRES",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE PROFESSIONNELLE",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2018: [
        "AUTOMOBILE",
        "AUTRES",
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
        "PREVOYANCE DECES",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2020: [
        "ASSISTANCE FRAIS FUNERAILLES",
        "AUTOMOBILE",
        "DIVERS",
        "GLOBAL BANQUE",
        "INDEMNITE DE FIN DE CARRIERE",
        "INCENDIE",
        "INDIVIDUELLE ACCIDENTS",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
        "TRANSPORT FACULTES",
    ],
    2021: [
        "ASSISTANCE FRAIS FUNERAIRES",
        "AUTOMOBILE",
        "DIVERS",
        "GLOBALE BANQUE",
        "INCENDIE",
        "INDEMNITE DE FIN DE CARRIERE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CVILE",
        "SANTE",
    ],
    2022: [
        "ASSISTANCE FRAIS FUNERAILLES",
        "AUTOMOBILE",
        "DIVERS",
        "GLOBALE BANQUE",
        "GLOBALE DOMMAGE",
        "INDEMNITE DE FIN DE CARRIERE",
        "MULTIRISQUE IMMEUBLE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2023: [
        "ASSISTANCE FRAIS FUNERAIRES",
        "AUTOMOBILE",
        "CAUTION",
        "DECES EMPRUNTEUR",
        "DIVERS",
        "GLOBALE BANQUE",
        "INDEMNITE FIN DE CARRIERE",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "PREVOYANCE ENTREPRISE",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2024: [
        "AUTOMOBILE",
        "DECES EMPRUNTEUR",
        "DIVERS",
        "FRAIS FUNERAIRES",
        "GLOBALE BANQUE",
        "INDEMNITE FIN DE CARRIERE",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNELLE",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
    2025: [
        "AUTOMOBILE",
        "DECES EMPRUNTEUR",
        "DIVERS",
        "FRAIS FUNERAIRES",
        "GLOBAL BANQUE",
        "INDEMNITE DE FIN DE CARRIERE",
        "MULTIRISQUE HABITATION",
        "MULTIRISQUE PROFESSIONNEL",
        "PREVOYANCE DECES",
        "REGLEMENTS",
        "RESPONSABILITE CIVILE",
        "SANTE",
    ],
}


class Command(BaseCommand):
    help = "Crée les exercices 2015-2025 et les risques associés pour le client BANQUE NATIONALE D'INVESTISSEMENT (BNI), en ignorant les codes entre parenthèses."

    def handle(self, *args, **options):
        client = Client.objects.filter(nom="BANQUE NATIONALE D'INVESTISSEMENT (BNI)").first()
        if not client:
            raise CommandError("Client 'BANQUE NATIONALE D'INVESTISSEMENT (BNI)' introuvable. Vérifie d'abord qu'il est importé (load_legacy_clients).")

        created_exercices = 0
        created_risques = 0

        for annee, risques_types in DATA_BNI.items():
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
            f"Seed BANQUE NATIONALE D'INVESTISSEMENT (BNI) terminé : {created_exercices} exercices créés, {created_risques} risques créés."
        ))
