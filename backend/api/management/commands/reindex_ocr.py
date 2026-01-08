"""
Commande Django pour ré-indexer les documents avec OCR.

Scanne tous les documents dont le contenu textuel est insuffisant (< seuil)
et applique l'OCR pour extraire le texte des PDF scannés.

Usage:
    python manage.py reindex_ocr                    # Tous les documents avec < 100 caractères
    python manage.py reindex_ocr --threshold 200   # Seuil personnalisé
    python manage.py reindex_ocr --dry-run         # Simulation sans modification
    python manage.py reindex_ocr --limit 10        # Limiter à 10 documents
    python manage.py reindex_ocr --document-id UUID  # Un document spécifique
"""
import logging
import time
from typing import Optional

from django.core.management.base import BaseCommand, CommandError
from django.core.files.storage import default_storage
from django.db.models import Q, F
from django.db.models.functions import Length

from api.models import Document, DocumentChunk
from api.ocr import (
    is_pdf_ocr_available,
    extract_text_with_ocr_fallback,
    get_ocr_status,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Ré-indexe les documents avec peu de contenu en appliquant l'OCR"

    def add_arguments(self, parser):
        parser.add_argument(
            '--threshold',
            type=int,
            default=100,
            help='Seuil minimum de caractères (défaut: 100). Les documents avec moins seront ré-indexés.'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulation: affiche les documents à traiter sans les modifier.'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Nombre maximum de documents à traiter.'
        )
        parser.add_argument(
            '--document-id',
            type=str,
            default=None,
            help='ID spécifique d\'un document à ré-indexer.'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Forcer l\'OCR même si du texte existe déjà.'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Afficher les détails de chaque document traité.'
        )

    def handle(self, *args, **options):
        threshold = options['threshold']
        dry_run = options['dry_run']
        limit = options['limit']
        document_id = options['document_id']
        force_ocr = options['force']
        verbose = options['verbose']

        # Vérifier que l'OCR est disponible
        ocr_status = get_ocr_status()
        if not ocr_status['pdf_ocr_available']:
            self.stderr.write(self.style.ERROR(
                "OCR PDF non disponible. Vérifiez l'installation de Tesseract et pdf2image."
            ))
            self.stdout.write(f"Statut OCR: {ocr_status}")
            return

        self.stdout.write(self.style.SUCCESS(f"OCR disponible: {ocr_status['features']}"))
        self.stdout.write(f"Langue par défaut: {ocr_status['default_lang']}")
        self.stdout.write(f"DPI: {ocr_status['default_dpi']}")
        self.stdout.write("")

        # Trouver les documents à traiter
        if document_id:
            # Document spécifique
            try:
                documents = Document.objects.filter(id=document_id)
                if not documents.exists():
                    raise CommandError(f"Document {document_id} non trouvé.")
            except Exception as e:
                raise CommandError(f"Erreur lors de la recherche du document: {e}")
        else:
            # Tous les documents PDF avec peu de contenu
            documents = Document.objects.filter(
                Q(type_fichier__iexact='pdf') | 
                Q(type_fichier__iexact='application/pdf') |
                Q(chemin_fichier__iendswith='.pdf')
            ).exclude(
                chemin_fichier__isnull=True
            ).exclude(
                chemin_fichier=''
            )

        # Statistiques
        total_documents = documents.count()
        self.stdout.write(f"Documents PDF totaux: {total_documents}")

        # Filtrer par contenu insuffisant
        documents_to_process = []
        
        for doc in documents:
            # Récupérer les chunks du document
            chunks = DocumentChunk.objects.filter(document=doc)
            total_text_length = sum(len(chunk.texte or '') for chunk in chunks)
            
            if total_text_length < threshold or force_ocr:
                documents_to_process.append({
                    'document': doc,
                    'current_length': total_text_length,
                    'chunks_count': chunks.count(),
                })

        self.stdout.write(f"Documents avec < {threshold} caractères: {len(documents_to_process)}")

        if limit:
            documents_to_process = documents_to_process[:limit]
            self.stdout.write(f"Limité à: {limit} documents")

        if not documents_to_process:
            self.stdout.write(self.style.SUCCESS("Aucun document à ré-indexer."))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING("\n=== MODE SIMULATION (dry-run) ==="))
            for item in documents_to_process:
                doc = item['document']
                self.stdout.write(
                    f"  - {doc.titre[:60]}... | {item['current_length']} chars | {item['chunks_count']} chunks"
                )
            self.stdout.write(f"\nTotal: {len(documents_to_process)} documents seraient traités.")
            return

        # Traitement réel
        self.stdout.write(self.style.WARNING(f"\n=== TRAITEMENT DE {len(documents_to_process)} DOCUMENTS ==="))
        
        success_count = 0
        error_count = 0
        skipped_count = 0
        total_chars_added = 0

        for i, item in enumerate(documents_to_process, 1):
            doc = item['document']
            
            self.stdout.write(f"\n[{i}/{len(documents_to_process)}] {doc.titre[:50]}...")
            
            try:
                # Vérifier que le fichier existe
                if not default_storage.exists(doc.chemin_fichier):
                    self.stdout.write(self.style.WARNING(f"  ⚠ Fichier non trouvé: {doc.chemin_fichier}"))
                    skipped_count += 1
                    continue

                # Obtenir le chemin complet
                file_path = default_storage.path(doc.chemin_fichier)
                
                if verbose:
                    self.stdout.write(f"  Fichier: {file_path}")

                # Appliquer l'OCR
                start_time = time.time()
                pages = extract_text_with_ocr_fallback(
                    file_path,
                    lang='fra',
                    force_ocr=force_ocr,
                    use_preprocessing=True
                )
                elapsed = time.time() - start_time

                if not pages:
                    self.stdout.write(self.style.WARNING(f"  ⚠ Aucun texte extrait"))
                    skipped_count += 1
                    continue

                # Calculer le texte total
                full_text = '\n\n'.join([page_text for _, page_text in pages])
                new_length = len(full_text)

                if verbose:
                    self.stdout.write(f"  Pages extraites: {len(pages)}")
                    self.stdout.write(f"  Caractères: {item['current_length']} → {new_length}")
                    self.stdout.write(f"  Temps: {elapsed:.1f}s")

                # Mettre à jour les chunks
                chunks = DocumentChunk.objects.filter(document=doc)
                
                if chunks.exists():
                    # Mettre à jour le premier chunk avec tout le texte
                    first_chunk = chunks.first()
                    first_chunk.texte = full_text
                    first_chunk.save()
                    
                    # Supprimer les autres chunks (on consolide tout)
                    chunks.exclude(id=first_chunk.id).delete()
                else:
                    # Créer un nouveau chunk
                    DocumentChunk.objects.create(
                        document=doc,
                        texte=full_text,
                        page=1,
                        ordre=0,
                    )

                chars_added = new_length - item['current_length']
                total_chars_added += max(0, chars_added)
                
                self.stdout.write(self.style.SUCCESS(
                    f"  ✓ OK: {new_length} chars (+{chars_added}) en {elapsed:.1f}s"
                ))
                success_count += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ✗ Erreur: {e}"))
                error_count += 1
                logger.exception(f"Erreur OCR pour document {doc.id}")

        # Résumé final
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS(f"RÉSUMÉ:"))
        self.stdout.write(f"  ✓ Succès: {success_count}")
        self.stdout.write(f"  ⚠ Ignorés: {skipped_count}")
        self.stdout.write(f"  ✗ Erreurs: {error_count}")
        self.stdout.write(f"  📝 Caractères ajoutés: {total_chars_added:,}")
        self.stdout.write("=" * 60)
