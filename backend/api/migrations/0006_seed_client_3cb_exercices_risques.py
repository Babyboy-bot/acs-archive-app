from django.db import migrations


def seed_client_3cb(apps, schema_editor):
    Client = apps.get_model("api", "Client")
    Exercice = apps.get_model("api", "Exercice")
    Risque = apps.get_model("api", "Risque")

    client = Client.objects.filter(nom="3CB").first()
    if not client:
        # Si le client n'existe pas, on ne fait rien pour éviter de créer des données inattendues
        return

    # Définition des exercices et risques attendus
    data = {
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

    for annee, risques_types in data.items():
        # On évite de dupliquer les exercices : un exercice par client + année
        exercice, _ = Exercice.objects.get_or_create(
            client=client,
            annee=annee,
            defaults={"statut": "ACTIF"},
        )

        # Pour chaque type de risque, on crée l'entrée si elle n'existe pas déjà pour cet exercice
        for risque_type in risques_types:
            Risque.objects.get_or_create(
                exercice=exercice,
                type=risque_type,
                defaults={"numero_police": None},
            )


def unseed_client_3cb(apps, schema_editor):
    Client = apps.get_model("api", "Client")
    Exercice = apps.get_model("api", "Exercice")
    Risque = apps.get_model("api", "Risque")

    client = Client.objects.filter(nom="3CB").first()
    if not client:
        return

    # On supprime les risques et exercices créés pour ce client entre 2016 et 2025
    exercices = Exercice.objects.filter(client=client, annee__gte=2016, annee__lte=2025)
    Risque.objects.filter(exercice__in=exercices).delete()
    exercices.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_convert_document_type_courrier_to_text"),
    ]

    # Migration de données initialement prévue pour créer les exercices/risques de 3CB.
    # Elle est désormais neutralisée pour éviter les problèmes de compatibilité
    # entre les anciens types (UUID) et les nouveaux (texte) dans la base.
    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
