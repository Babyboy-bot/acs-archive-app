"""
Module de chunking intelligent pour les documents.
Découpe les textes de manière sémantique (paragraphes, phrases) plutôt que par caractères.
"""
import re
import logging
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

# Configuration du chunking
DEFAULT_CHUNK_SIZE = 1500  # Taille cible en caractères
DEFAULT_CHUNK_OVERLAP = 200  # Overlap entre chunks
MIN_CHUNK_SIZE = 100  # Taille minimum d'un chunk
MAX_CHUNK_SIZE = 3000  # Taille maximum d'un chunk


class TextChunker:
    """
    Chunker intelligent qui respecte les frontières sémantiques.
    
    Priorité de découpe:
    1. Paragraphes (double saut de ligne)
    2. Phrases (points, points d'exclamation, points d'interrogation)
    3. Clauses (virgules, points-virgules)
    4. Mots (espaces)
    5. Caractères (dernier recours)
    """
    
    def __init__(
        self, 
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
        min_chunk_size: int = MIN_CHUNK_SIZE,
        max_chunk_size: int = MAX_CHUNK_SIZE
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size
        
        # Patterns de séparation (du plus fort au plus faible)
        self.separators = [
            r'\n\n+',  # Paragraphes
            r'\n',  # Lignes
            r'(?<=[.!?])\s+',  # Fins de phrases
            r'(?<=[;:])\s+',  # Clauses
            r'(?<=[,])\s+',  # Virgules
            r'\s+',  # Espaces
        ]
    
    def _split_by_separator(self, text: str, separator: str) -> List[str]:
        """Découpe le texte par un séparateur regex."""
        parts = re.split(separator, text)
        return [p for p in parts if p.strip()]
    
    def _merge_small_chunks(self, chunks: List[str]) -> List[str]:
        """Fusionne les chunks trop petits avec leurs voisins."""
        if not chunks:
            return []
        
        merged = []
        current = ""
        
        for chunk in chunks:
            if len(current) + len(chunk) <= self.chunk_size:
                current = (current + " " + chunk).strip() if current else chunk
            else:
                if current:
                    merged.append(current)
                current = chunk
        
        if current:
            merged.append(current)
        
        return merged
    
    def _split_large_chunk(self, text: str, separator_idx: int = 0) -> List[str]:
        """Découpe récursivement un chunk trop grand."""
        if len(text) <= self.max_chunk_size:
            return [text]
        
        if separator_idx >= len(self.separators):
            # Dernier recours: découpe par caractères
            chunks = []
            start = 0
            while start < len(text):
                end = min(start + self.chunk_size, len(text))
                chunks.append(text[start:end])
                start = end - self.chunk_overlap if end < len(text) else end
            return chunks
        
        separator = self.separators[separator_idx]
        parts = self._split_by_separator(text, separator)
        
        if len(parts) <= 1:
            # Ce séparateur n'a pas fonctionné, essayer le suivant
            return self._split_large_chunk(text, separator_idx + 1)
        
        # Recombiner les parties en chunks de taille appropriée
        chunks = []
        current = ""
        
        for part in parts:
            if len(part) > self.max_chunk_size:
                # Cette partie est encore trop grande, la découper récursivement
                if current:
                    chunks.append(current)
                    current = ""
                chunks.extend(self._split_large_chunk(part, separator_idx + 1))
            elif len(current) + len(part) + 1 <= self.chunk_size:
                current = (current + " " + part).strip() if current else part
            else:
                if current:
                    chunks.append(current)
                current = part
        
        if current:
            chunks.append(current)
        
        return chunks
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Découpe un texte en chunks sémantiques.
        
        Args:
            text: Le texte à découper
            
        Returns:
            Liste de chunks
        """
        if not text or not text.strip():
            return []
        
        # Normaliser le texte
        text = text.strip()
        text = re.sub(r'\r\n', '\n', text)
        text = re.sub(r'\r', '\n', text)
        
        # Si le texte est assez court, le retourner tel quel
        if len(text) <= self.chunk_size:
            return [text]
        
        # Découper par paragraphes d'abord
        paragraphs = self._split_by_separator(text, r'\n\n+')
        
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # Si le paragraphe est trop grand, le découper
            if len(para) > self.max_chunk_size:
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""
                chunks.extend(self._split_large_chunk(para))
            elif len(current_chunk) + len(para) + 2 <= self.chunk_size:
                current_chunk = (current_chunk + "\n\n" + para).strip() if current_chunk else para
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = para
        
        if current_chunk:
            chunks.append(current_chunk)
        
        # Ajouter l'overlap entre chunks
        if self.chunk_overlap > 0 and len(chunks) > 1:
            chunks = self._add_overlap(chunks)
        
        # Filtrer les chunks trop petits
        chunks = [c for c in chunks if len(c) >= self.min_chunk_size]
        
        return chunks
    
    def _add_overlap(self, chunks: List[str]) -> List[str]:
        """Ajoute un overlap entre les chunks consécutifs."""
        if len(chunks) <= 1:
            return chunks
        
        overlapped = [chunks[0]]
        
        for i in range(1, len(chunks)):
            prev_chunk = chunks[i - 1]
            curr_chunk = chunks[i]
            
            # Prendre la fin du chunk précédent comme contexte
            overlap_text = prev_chunk[-self.chunk_overlap:] if len(prev_chunk) > self.chunk_overlap else prev_chunk
            
            # Essayer de couper à une frontière de mot
            space_idx = overlap_text.find(' ')
            if space_idx > 0:
                overlap_text = overlap_text[space_idx + 1:]
            
            # Ajouter le contexte au début du chunk courant
            if overlap_text and not curr_chunk.startswith(overlap_text):
                overlapped.append(overlap_text + " " + curr_chunk)
            else:
                overlapped.append(curr_chunk)
        
        return overlapped
    
    def chunk_pages(self, pages: List[Tuple[int, str]]) -> List[Tuple[int, str, int]]:
        """
        Découpe une liste de pages en chunks.
        
        Args:
            pages: Liste de tuples (numéro_page, texte)
            
        Returns:
            Liste de tuples (numéro_page, texte_chunk, ordre_chunk)
        """
        all_chunks = []
        ordre = 0
        
        for page_num, page_text in pages:
            if not page_text or not page_text.strip():
                continue
            
            page_chunks = self.chunk_text(page_text)
            
            for chunk_text in page_chunks:
                all_chunks.append((page_num, chunk_text, ordre))
                ordre += 1
        
        return all_chunks


# Instance globale du chunker
_chunker: Optional[TextChunker] = None


def get_chunker() -> TextChunker:
    """Retourne l'instance globale du chunker."""
    global _chunker
    if _chunker is None:
        _chunker = TextChunker()
    return _chunker


def chunk_document_text(text: str) -> List[str]:
    """Découpe un texte de document en chunks."""
    return get_chunker().chunk_text(text)


def chunk_document_pages(pages: List[Tuple[int, str]]) -> List[Tuple[int, str, int]]:
    """Découpe des pages de document en chunks."""
    return get_chunker().chunk_pages(pages)
