import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Client, Exercice


YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")


@dataclass
class ParsedClient:
    nom: str
    annees: List[int]


def _normalize_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r"\s+", " ", name)
    return name


def parse_particuliers_exercices(raw_text: str) -> List[ParsedClient]:
    current_name: Optional[str] = None
    years_by_name: Dict[str, List[int]] = {}

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower() == "retour":
            continue

        year_matches = YEAR_RE.findall(line)
        if year_matches:
            if not current_name:
                continue
            years = [int(y) for y in year_matches]
            years_by_name.setdefault(current_name, []).extend(years)
            continue

        # Otherwise, treat as a client name line
        current_name = _normalize_name(line)
        years_by_name.setdefault(current_name, [])

    parsed: List[ParsedClient] = []
    for name, years in years_by_name.items():
        # Deduplicate + keep sorted
        uniq_years = sorted({y for y in years})
        parsed.append(ParsedClient(nom=name, annees=uniq_years))

    # Keep stable order as they appear in input (dict insertion order)
    return parsed


class Command(BaseCommand):
    help = "Importe des clients particuliers et leurs exercices (années) depuis un texte."

    def add_arguments(self, parser):
        parser.add_argument(
            "--input",
            type=str,
            default=None,
            help="Chemin vers un fichier texte contenant la liste (nom + années).",
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
            if not path.exists():
                raise CommandError(f"Fichier introuvable: {input_path}")
            raw_text = path.read_text(encoding="utf-8")
        else:
            raise CommandError("Veuillez fournir --input <chemin_fichier>")

        parsed = parse_particuliers_exercices(raw_text)
        if not parsed:
            self.stdout.write(self.style.WARNING("Aucun client détecté dans l'entrée."))
            return

        created_clients = 0
        created_exercices = 0
        updated_clients = 0

        with transaction.atomic():
            for item in parsed:
                client, created = Client.objects.get_or_create(
                    nom=item.nom,
                    defaults={"type": "PARTICULIER"},
                )
                if created:
                    created_clients += 1
                else:
                    # Force type to PARTICULIER if this import is authoritative
                    if client.type != "PARTICULIER":
                        client.type = "PARTICULIER"
                        client.save(update_fields=["type"])
                        updated_clients += 1

                for annee in item.annees:
                    _, ex_created = Exercice.objects.get_or_create(
                        client=client,
                        annee=annee,
                        defaults={"statut": "ACTIF"},
                    )
                    if ex_created:
                        created_exercices += 1

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                "Import terminé: "
                f"clients créés={created_clients}, clients mis à jour={updated_clients}, exercices créés={created_exercices}, dry_run={dry_run}"
            )
        )
