from django.core.management.base import BaseCommand

from api.models import Client, Exercice, Risque


CLIENTS_MO_DATA = {
    "MA BNI": {
        2021: ["AUTOMOBILE"],
        2022: [
            "AUTOMOBILE",
            "SANTE",
        ],
        2023: [
            "AUTOMOBILE",
            "REGLEMENTS",
            "SANTE",
        ],
        2024: [
            "AUTOMOBILE",
            "REGLEMENTS",
            "SANTE",
        ],
        2025: [
            "AUTOMOBILE",
            "SANTE",
        ],
    },
    "MADGT": {
        2004: ["SANTE"],
    },
    "MAGIST ASSUR": {
        2025: ["RETRAITE ET PROVOYANCE"],
    },
    "MAIRIE DE BOOKO": {
        2024: ["CAUTION"],
    },
    "MATIS": {
        2013: ["INDIVIDUELLE ACCIDENTS"],
        2014: ["INDIVIDUELLE ACCIDENTS"],
        2015: ["INDIVIDUELLE ACCIDENTS"],
        2016: ["INDIVIDUELLE ACCIDENTS"],
        2017: [
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
        ],
        2020: ["INDIVIDUELLE ACCIDENTS"],
    },
    "MAYAMA EDITION": {
        2002: ["AUTOMOBILE"],
    },
    "MCT CARRIER": {
        2012: [
            "AUTOMOBILE",
            "TOUS RISQUES CHANTIER",
        ],
        2013: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TOUS RISQUES CHANTIER",
            "TRANSPORT FACULTES",
        ],
        2014: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "TOUS RISQUES CHANTIER",
            "TRANSPORT FACULTES",
        ],
        2015: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TOUS RISQUES CHANTIER",
            "TRANSPORT FACULTES",
        ],
        2016: [
            "AUTOMOBILE",
            "DECES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2017: [
            "AUTOMOBILE",
            "CAUTION",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2018: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "REGLEMENTS",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2019: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2020: [
            "AUTOMOBILE",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
            "REGLEMENTS",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2021: [
            "AUTOMOBILE",
            "DIVERS",
            "TRANSPORT FACULTES",
        ],
        2022: [
            "AUTOMOBILE",
            "DIVERS",
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2023: [
            "AUTOMOBILE",
            "REGLEMENT",
            "TRANSPORT FACULTES",
        ],
    },
    "MEDIAREA": {
        2010: ["MULTIRISQUE PROFESSIONNELLE"],
        2011: ["MULTIRISQUE PROFESSIONNELLE"],
    },
    "MELIS COM": {
        2018: ["SANTE"],
    },
    "MHAD SECURITE": {
        2008: [
            "AUTOMOBILE",
            "INDIVIDUELLE ACCIDENTS",
            "MULTIRISQUE PROFESSIONNELLE",
            "SANTE",
        ],
        2009: [
            "AUTOMOBILE",
        ],
    },
    "MINISTERE DE L'ECONOMIE ET DES FINANCES": {
        2019: ["RESPONSABILITE CIVILE"],
        2021: ["AUTOMOBILE"],
        2022: ["RESPONSABILITE CIVILE"],
        2023: ["AUTOMOBILE"],
    },
    "MINISTERE DES SPORTS ET LOISIRS": {
        2025: ["AUTOMOBILE"],
    },
    "MLK": {
        2024: ["SANTE"],
    },
    "MONDIAL EXPERTISE": {
        2021: ["SANTE"],
        2022: ["SANTE"],
    },
    "MP ENGINEERING": {
        2022: ["SANTE"],
        2023: ["SANTE"],
        2024: ["SANTE"],
        2025: ["SANTE"],
    },
    "MUSACI": {
        2024: ["SANTE"],
    },
    "MUTIPS": {
        2010: ["DIVERS"],
    },
    "MYKA SA": {
        2021: ["TOUS RISQUES CHANTIER"],
        2023: ["TOUS RISQUES CHANTIER"],
        2024: ["TOUS RISQUES CHANTIER"],
    },
    "NEDEX SA": {
        2021: ["TRANSPORT FACULTES"],
    },
    "NESTLE - CI": {
        2016: ["DIVERS"],
    },
    "NIBS INDUSTRIES ET SERVICES (N I S)": {
        2005: ["MULTIRISQUE ENTREPRISE"],
    },
    "NOUVELLE PHARMACIE DE LA SANTE PUBLIQUE (NPSP)": {
        2007: ["INDIVIDUELLE ACCIDENTS"],
        2008: [
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
        ],
        2009: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "SANTE",
        ],
        2010: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "PREVOYANCE DECES",
            "PROTECTION SOCIALE FUNERAILLES",
        ],
        2011: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "PREVOYANCE DECES",
        ],
        2012: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
        ],
        2013: [
            "DIVERS",
            "INDIVIDUELLE ACCIDENTS",
            "REGLEMENTS",
            "TRANSPORT FACULTES",
        ],
        2015: [
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
        2016: [
            "AUTOMOBILE",
            "DIVERS",
            "MULTIRISQUE PROFESSIONNELLE",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
        ],
        2017: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2018: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "PREVOYANCE DECES ET ASSISTANCE FRAIS FUNERAILLES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2019: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DIVERS",
            "GLOBALE DOMMAGES",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
            "VOYAGE",
        ],
        2020: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2021: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "AUTOMOBILE",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2022: [
            "ASSISTANCE FRAIS FUNERAILLES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2023: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2024: [
            "DIVERS",
            "FRAIS FUNERAIRES",
            "INCENDIE",
            "INDEMNITE DE FIN DE CARRIERE",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
        2025: [
            "ASSISTANCE FRAIS FUNERAIRES",
            "DIVERS",
            "INDEMNITE DE FIN DE CARRIERE",
            "INDEMNITES FUNERAILLES",
            "MULTIRISQUE PROFESSIONNELLE",
            "PREVOYANCE DECES",
            "RESPONSABILITE CIVILE",
            "RETRAITE COMPLEMENTAIRE",
            "SANTE",
            "TRANSPORT FACULTES",
        ],
    },
    "NUTRIVOIRE": {
        2011: ["RESPONSABILITE CIVILE"],
        2012: [
            "REGLEMENTS",
            "RESPONSABILITE CIVILE",
        ],
        2013: ["RESPONSABILITE CIVILE"],
        2014: ["RESPONSABILITE CIVILE"],
        2015: [
            "DIVERS",
            "RESPONSABILITE CIVILE",
        ],
        2016: ["RESPONSABILITE CIVILE"],
        2017: [
            "DIVERS",
            "RESPONSABILITE CIVILE",
        ],
        2019: ["DIVERS"],
        2021: [
            "MULTIRISQUE PROFESSIONNELLE",
            "RESPONSABILITE CIVILE",
        ],
    },
    "OLERC": {
        2021: ["AUTOMOBILE"],
    },
    "ONECI": {
        2020: ["AUTOMOBILE"],
    },
    "ONEP": {
        2022: ["SANTE"],
        2025: ["SANTE"],
    },
    "ONG ENTREPRENEURS DU MONDE CI": {
        2025: ["SANTE"],
    },
    "ONG OIEBES-H": {
        2009: ["AUTOMOBILE"],
        2010: ["AUTOMOBILE"],
        2011: ["AUTOMOBILE"],
        2012: ["DIVERS"],
    },
    "ONI": {
        2019: ["AUTOMOBILE"],
    },
    # OPTIMUM SECURITE SARL : années non précisées dans la source, à compléter ultérieurement.
    "OSI SARL": {
        2025: ["CAUTION"],
    },
    "OT SERVICES": {
        2021: ["TOUS RISQUES CHANTIER"],
    },
}


class Command(BaseCommand):
    help = "Crée les exercices et risques associés pour le bloc de clients M-O (MA BNI → OT SERVICES), à partir des données legacy."

    def handle(self, *args, **options):
        total_exercices = 0
        total_risques = 0

        for client_name, data in CLIENTS_MO_DATA.items():
            client = Client.objects.filter(nom=client_name).first()
            if not client:
                self.stderr.write(self.style.WARNING(
                    f'Client "{client_name}" introuvable. Vérifie d\'abord qu\'il est importé (load_legacy_clients).'
                ))
                continue

            created_exercices = 0
            created_risques = 0

            for annee, risques_types in data.items():
                exercice, ex_created = Exercice.objects.get_or_create(
                    client=client,
                    annee=annee,
                    defaults={"statut": "ACTIF"},
                )
                if ex_created:
                    created_exercices += 1
                    total_exercices += 1

                for risque_type in risques_types:
                    _, risque_created = Risque.objects.get_or_create(
                        exercice=exercice,
                        type=risque_type,
                        defaults={"numero_police": None},
                    )
                    if risque_created:
                        created_risques += 1
                        total_risques += 1

            self.stdout.write(self.style.SUCCESS(
                f'Seed {client_name} terminé : {created_exercices} exercices créés, {created_risques} risques créés.'
            ))

        self.stdout.write(self.style.SUCCESS(
            f"Seed bloc clients M-O terminé : {total_exercices} exercices créés, {total_risques} risques créés."
        ))
