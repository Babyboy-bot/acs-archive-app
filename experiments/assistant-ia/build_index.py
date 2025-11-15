"""Pipeline de pré-indexation (POC).

Ce script charge les données factices (métadonnées, procédures) et
construit un corpus JSON simple pouvant être exploité par un prototype
RAG ou moteur de recherche.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
INDEX_DIR = ROOT / "indexes"


@dataclass
class DocumentChunk:
    id: str
    source: str
    content: str
    metadata: dict


def load_metadata() -> dict:
    metadata_path = DATA_DIR / "sample_metadata.json"
    with metadata_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_procedures() -> list[DocumentChunk]:
    procedures_path = DATA_DIR / "procedures.md"
    raw = procedures_path.read_text(encoding="utf-8")

    chunks: list[DocumentChunk] = []
    current_title: str | None = None
    buffer: list[str] = []

    for line in raw.splitlines():
        if line.startswith("## "):
            if current_title and buffer:
                chunks.append(
                    DocumentChunk(
                        id=f"procedure::{current_title.lower().replace(' ', '-')}",
                        source="procedures.md",
                        content="\n".join(buffer).strip(),
                        metadata={"titre": current_title},
                    )
                )
            current_title = line[3:].strip()
            buffer = []
        else:
            buffer.append(line)

    if current_title and buffer:
        chunks.append(
            DocumentChunk(
                id=f"procedure::{current_title.lower().replace(' ', '-')}",
                source="procedures.md",
                content="\n".join(buffer).strip(),
                metadata={"titre": current_title},
            )
        )

    return chunks


def build_corpus() -> list[DocumentChunk]:
    data = load_metadata()
    corpus: list[DocumentChunk] = []

    for doc in data.get("documents", []):
        corpus.append(
            DocumentChunk(
                id=f"doc::{doc['id']}",
                source="sample_metadata.json",
                content=dedent(
                    f"""
                    Document {doc['id']} pour le client {doc['client_id']}.
                    Type: {doc['type']}. Catégorie: {doc['categorie']}.
                    Risque: {doc['risque']}.
                    Exercice: {doc['exercice']}.
                    Résumé: {doc['resume']}.
                    Statut légal: {doc['statut_legal']}.
                    """
                ).strip(),
                metadata={
                    "client_id": doc["client_id"],
                    "type": doc["type"],
                    "categorie": doc["categorie"],
                    "risque": doc["risque"],
                    "exercice": doc["exercice"],
                },
            )
        )

    corpus.extend(load_procedures())
    return corpus


def main() -> None:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    corpus = build_corpus()

    output_path = INDEX_DIR / "corpus.json"
    with output_path.open("w", encoding="utf-8") as f:
        json.dump([asdict(chunk) for chunk in corpus], f, ensure_ascii=False, indent=2)

    print(f"Corpus généré: {output_path} ({len(corpus)} documents)")


if __name__ == "__main__":
    main()
