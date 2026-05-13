import hashlib
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from api.models import Document


class Command(BaseCommand):
    help = 'Calcule le hash SHA256 pour tous les documents existants sans hash'

    def handle(self, *args, **options):
        docs = Document.objects.filter(file_hash__isnull=True)
        total = docs.count()
        self.stdout.write(f'{total} document(s) sans hash à traiter...')

        ok = 0
        ko = 0

        for doc in docs.iterator():
            try:
                with default_storage.open(doc.chemin_fichier, 'rb') as f:
                    sha256 = hashlib.sha256()
                    while chunk := f.read(65536):
                        sha256.update(chunk)
                    doc.file_hash = sha256.hexdigest()
                    doc.save(update_fields=['file_hash'])
                    ok += 1
            except Exception as e:
                self.stderr.write(f'  ERREUR {doc.id} ({doc.chemin_fichier}): {e}')
                ko += 1

        self.stdout.write(self.style.SUCCESS(f'Terminé : {ok} hash calculés, {ko} erreur(s).'))
