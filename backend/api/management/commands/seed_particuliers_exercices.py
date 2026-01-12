from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from api.management.commands.import_particuliers_exercices import (
    parse_particuliers_exercices,
)
from api.models import Client, Exercice


class Command(BaseCommand):
    help = "Seed: crée les clients particuliers et leurs exercices (années) depuis un fichier texte." 

    def add_arguments(self, parser):
        parser.add_argument(
            "--input",
            type=str,
            default=None,
            help=(
                "Chemin vers le fichier texte (par défaut: backend/particuliers_exercices.txt à la racine du repo)."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche ce qui serait créé sans écrire en base.",
        )

    def handle(self, *args, **options):
        input_path = options.get("input")
        dry_run = bool(options.get("dry_run"))

        if input_path:
            path = Path(input_path)
        else:
            # backend/particuliers_exercices.txt (racine repo)
            repo_root = Path(__file__).resolve().parents[4]
            path = repo_root / "backend" / "particuliers_exercices.txt"

        if not path.exists():
            raise CommandError(
                f"Fichier introuvable: {path}. "
                "Crée le fichier, colle la liste (nom + années), puis relance la commande. "
                "Ou passe --input <chemin>."
            )

        raw_text = path.read_text(encoding="utf-8")
        parsed = parse_particuliers_exercices(raw_text)
        if not parsed:
            self.stdout.write(self.style.WARNING("Aucun client détecté dans l'entrée."))
            return

        created_clients = 0
        updated_clients = 0
        created_exercices = 0

        for item in parsed:
            client, created = Client.objects.get_or_create(
                nom=item.nom,
                defaults={"type": "PARTICULIER"},
            )
            if created:
                created_clients += 1
            else:
                if client.type != "PARTICULIER":
                    client.type = "PARTICULIER"
                    if not dry_run:
                        client.save(update_fields=["type"])
                    updated_clients += 1

            for annee in item.annees:
                if dry_run:
                    exists = Exercice.objects.filter(client=client, annee=annee).exists()
                    if not exists:
                        created_exercices += 1
                else:
                    _, ex_created = Exercice.objects.get_or_create(
                        client=client,
                        annee=annee,
                        defaults={"statut": "ACTIF"},
                    )
                    if ex_created:
                        created_exercices += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Seed terminé: "
                f"clients créés={created_clients}, clients mis à jour={updated_clients}, exercices créés={created_exercices}, dry_run={dry_run}"
            )
        )
