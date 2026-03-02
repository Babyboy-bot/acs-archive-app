"""
Module de gestion d'index de recherche persistant.
Évite de recalculer l'index TF-IDF/FAISS à chaque requête.
"""
import os
import pickle
import logging
import hashlib
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

import numpy as np
try:
    import faiss  # type: ignore
    _FAISS_AVAILABLE = True
except ModuleNotFoundError:
    faiss = None  # type: ignore
    _FAISS_AVAILABLE = False
from sklearn.feature_extraction.text import TfidfVectorizer

from django.conf import settings
from .models import Document, DocumentChunk

logger = logging.getLogger(__name__)

# Répertoire de stockage des index
INDEX_DIR = Path(getattr(settings, 'SEARCH_INDEX_DIR', settings.BASE_DIR / 'search_indexes'))
INDEX_DIR.mkdir(parents=True, exist_ok=True)

# Durée de validité de l'index en secondes (1 heure par défaut)
INDEX_TTL_SECONDS = int(getattr(settings, 'SEARCH_INDEX_TTL_SECONDS', 3600))

# Lock pour éviter les accès concurrents
_index_lock = threading.Lock()


class SearchIndex:
    """
    Index de recherche persistant avec TF-IDF et FAISS.
    
    Fonctionnalités:
    - Stockage sur disque pour éviter le recalcul
    - Invalidation automatique basée sur le hash des documents
    - Thread-safe
    - Support TF-IDF et FAISS
    """
    
    def __init__(self, name: str = "documents"):
        self.name = name
        self.index_path = INDEX_DIR / f"{name}_index.pkl"
        self.faiss_path = INDEX_DIR / f"{name}_faiss.index"
        self.meta_path = INDEX_DIR / f"{name}_meta.pkl"
        
        self._vectorizer: Optional[TfidfVectorizer] = None
        self._tfidf_matrix: Optional[np.ndarray] = None
        # L'index FAISS est optionnel (faiss n'est pas installé en environnement standard)
        self._faiss_index = None
        self._doc_ids: List[str] = []
        self._payloads: List[Dict[str, Any]] = []
        self._corpus_hash: str = ""
        self._last_build: Optional[datetime] = None
    
    def _compute_corpus_hash(self, documents: List[Document]) -> str:
        """Calcule un hash du corpus pour détecter les changements."""
        content = ""
        for doc in sorted(documents, key=lambda d: str(d.id)):
            content += f"{doc.id}:{doc.titre}:{doc.modifie_le.isoformat() if doc.modifie_le else ''}|"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _is_valid(self, current_hash: str) -> bool:
        """Vérifie si l'index est encore valide."""
        if not self._last_build:
            return False
        
        # Vérifier le TTL
        age = (datetime.now() - self._last_build).total_seconds()
        if age > INDEX_TTL_SECONDS:
            logger.info(f"Index {self.name} expiré (âge: {age:.0f}s)")
            return False
        
        # Vérifier le hash
        if self._corpus_hash != current_hash:
            logger.info(f"Index {self.name} invalidé (documents modifiés)")
            return False
        
        return True
    
    def _load_from_disk(self) -> bool:
        """Charge l'index depuis le disque."""
        try:
            if not self.meta_path.exists():
                return False
            
            with open(self.meta_path, 'rb') as f:
                meta = pickle.load(f)
            
            self._corpus_hash = meta.get('corpus_hash', '')
            self._last_build = meta.get('last_build')
            self._doc_ids = meta.get('doc_ids', [])
            self._payloads = meta.get('payloads', [])
            
            if self.index_path.exists():
                with open(self.index_path, 'rb') as f:
                    data = pickle.load(f)
                    self._vectorizer = data.get('vectorizer')
                    self._tfidf_matrix = data.get('tfidf_matrix')
            
            if _FAISS_AVAILABLE and self.faiss_path.exists():
                self._faiss_index = faiss.read_index(str(self.faiss_path))  # type: ignore[union-attr]
            
            logger.info(f"Index {self.name} chargé depuis le disque ({len(self._doc_ids)} documents)")
            return True
            
        except Exception as e:
            logger.warning(f"Erreur chargement index {self.name}: {e}")
            return False
    
    def _save_to_disk(self) -> None:
        """Sauvegarde l'index sur le disque."""
        try:
            # Sauvegarder les métadonnées
            meta = {
                'corpus_hash': self._corpus_hash,
                'last_build': self._last_build,
                'doc_ids': self._doc_ids,
                'payloads': self._payloads,
            }
            with open(self.meta_path, 'wb') as f:
                pickle.dump(meta, f)
            
            # Sauvegarder le vectorizer et la matrice TF-IDF
            if self._vectorizer is not None:
                data = {
                    'vectorizer': self._vectorizer,
                    'tfidf_matrix': self._tfidf_matrix,
                }
                with open(self.index_path, 'wb') as f:
                    pickle.dump(data, f)
            
            # Sauvegarder l'index FAISS (si disponible)
            if _FAISS_AVAILABLE and self._faiss_index is not None:
                faiss.write_index(self._faiss_index, str(self.faiss_path))  # type: ignore[union-attr]
            
            logger.info(f"Index {self.name} sauvegardé sur le disque")
            
        except Exception as e:
            logger.error(f"Erreur sauvegarde index {self.name}: {e}")
    
    def build(
        self, 
        documents: List[Document], 
        payload_builder: callable,
        text_builder: callable,
        force: bool = False
    ) -> None:
        """
        Construit ou met à jour l'index.
        
        Args:
            documents: Liste des documents à indexer
            payload_builder: Fonction pour construire le payload d'un document
            text_builder: Fonction pour construire le texte d'un payload
            force: Forcer la reconstruction même si l'index est valide
        """
        with _index_lock:
            current_hash = self._compute_corpus_hash(documents)
            
            # Essayer de charger depuis le disque si pas en mémoire
            if not self._last_build:
                self._load_from_disk()
            
            # Vérifier si l'index est encore valide
            if not force and self._is_valid(current_hash):
                logger.debug(f"Index {self.name} valide, pas de reconstruction")
                return
            
            logger.info(f"Construction de l'index {self.name} ({len(documents)} documents)...")
            start = datetime.now()
            
            # Construire les payloads et le corpus
            self._payloads = [payload_builder(doc) for doc in documents]
            self._doc_ids = [str(p.get('id', '')) for p in self._payloads]
            corpus = [text_builder(p) for p in self._payloads]
            
            if not corpus:
                logger.warning(f"Corpus vide pour l'index {self.name}")
                return
            
            # Construire l'index TF-IDF
            self._vectorizer = TfidfVectorizer(
                max_features=10000,
                ngram_range=(1, 2),
                min_df=1,
                max_df=0.95,
            )
            tfidf_sparse = self._vectorizer.fit_transform(corpus)
            self._tfidf_matrix = tfidf_sparse.astype(np.float32).toarray()
            
            # Construire l'index FAISS (optionnel)
            if _FAISS_AVAILABLE and self._tfidf_matrix.shape[1] > 0:
                faiss.normalize_L2(self._tfidf_matrix)  # type: ignore[union-attr]
                self._faiss_index = faiss.IndexFlatIP(self._tfidf_matrix.shape[1])  # type: ignore[union-attr]
                self._faiss_index.add(self._tfidf_matrix)
            else:
                self._faiss_index = None
            
            self._corpus_hash = current_hash
            self._last_build = datetime.now()
            
            duration = (datetime.now() - start).total_seconds()
            logger.info(f"Index {self.name} construit en {duration:.2f}s")
            
            # Sauvegarder sur le disque
            self._save_to_disk()
    
    def search_tfidf(
        self, 
        query: str, 
        top_k: int = 10
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Recherche TF-IDF.
        
        Returns:
            Liste de tuples (payload, score)
        """
        if self._vectorizer is None or self._tfidf_matrix is None:
            return []
        
        with _index_lock:
            query_vector = self._vectorizer.transform([query]).astype(np.float32).toarray()
            
            if query_vector.size == 0 or not np.any(query_vector):
                return []
            
            # Calcul des scores par produit scalaire
            scores = np.dot(self._tfidf_matrix, query_vector.T).flatten()
            
            # Trier par score décroissant
            top_indices = np.argsort(scores)[::-1][:top_k]
            
            results = []
            for idx in top_indices:
                score = float(scores[idx])
                if score <= 0:
                    continue
                results.append((self._payloads[idx], score))
            
            return results
    
    def search_faiss(
        self, 
        query: str, 
        top_k: int = 10
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Recherche FAISS (plus rapide pour de gros corpus).
        
        Returns:
            Liste de tuples (payload, score)
        """
        if (not _FAISS_AVAILABLE) or self._faiss_index is None or self._vectorizer is None:
            return []
        
        with _index_lock:
            query_vector = self._vectorizer.transform([query]).astype(np.float32).toarray()
            
            if query_vector.size == 0 or not np.any(query_vector):
                return []
            
            faiss.normalize_L2(query_vector)  # type: ignore[union-attr]
            
            distances, indices = self._faiss_index.search(query_vector, min(top_k, len(self._payloads)))
            
            results = []
            for idx, score in zip(indices[0], distances[0]):
                if idx < 0 or score <= 0:
                    continue
                results.append((self._payloads[idx], float(score)))
            
            return results
    
    def invalidate(self) -> None:
        """Force l'invalidation de l'index."""
        with _index_lock:
            self._last_build = None
            self._corpus_hash = ""
            logger.info(f"Index {self.name} invalidé manuellement")
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques de l'index."""
        return {
            'name': self.name,
            'documents_count': len(self._doc_ids),
            'last_build': self._last_build.isoformat() if self._last_build else None,
            'corpus_hash': self._corpus_hash[:8] if self._corpus_hash else None,
            'has_tfidf': self._vectorizer is not None,
            'has_faiss': self._faiss_index is not None,
            'vocabulary_size': len(self._vectorizer.vocabulary_) if self._vectorizer else 0,
        }


# Instance globale de l'index des documents
_document_index: Optional[SearchIndex] = None


def get_document_index() -> SearchIndex:
    """Retourne l'instance globale de l'index des documents."""
    global _document_index
    if _document_index is None:
        _document_index = SearchIndex("documents")
    return _document_index


def rebuild_document_index(force: bool = False) -> Dict[str, Any]:
    """
    Reconstruit l'index des documents.
    Appelé automatiquement lors des recherches ou manuellement via une commande.
    """
    from .views import _build_document_payload, _build_document_text
    
    documents = list(
        Document.objects.select_related('categorie', 'risque__exercice__client').all()
    )
    
    index = get_document_index()
    index.build(
        documents=documents,
        payload_builder=lambda doc: _build_document_payload(doc, None),
        text_builder=_build_document_text,
        force=force,
    )
    
    return index.get_stats()


def invalidate_document_index() -> None:
    """Invalide l'index des documents (à appeler après modification de documents)."""
    index = get_document_index()
    index.invalidate()


def hybrid_search(
    query: str,
    top_k: int = 10,
    tfidf_weight: float = 0.4,
    semantic_weight: float = 0.6,
) -> List[Tuple[Dict[str, Any], float, str]]:
    """
    Recherche hybride combinant TF-IDF et sémantique avec Reciprocal Rank Fusion (RRF).
    
    Args:
        query: La requête de recherche
        top_k: Nombre de résultats à retourner
        tfidf_weight: Poids du score TF-IDF (0-1)
        semantic_weight: Poids du score sémantique (0-1)
        
    Returns:
        Liste de tuples (payload, score_combiné, méthode)
    """
    index = get_document_index()
    
    # Récupérer plus de résultats pour le RRF
    fetch_k = min(top_k * 3, 50)
    
    # Recherche TF-IDF
    tfidf_results = index.search_tfidf(query, top_k=fetch_k)
    
    # Recherche FAISS (si disponible)
    faiss_results = index.search_faiss(query, top_k=fetch_k) if _FAISS_AVAILABLE else []
    
    if not tfidf_results and not faiss_results:
        return []
    
    # Si une seule méthode a des résultats, l'utiliser directement
    if not faiss_results:
        return [(p, s, 'tfidf') for p, s in tfidf_results[:top_k]]
    if not tfidf_results:
        return [(p, s, 'faiss') for p, s in faiss_results[:top_k]]
    
    # Reciprocal Rank Fusion (RRF)
    # Score RRF = sum(1 / (k + rank)) pour chaque liste de résultats
    k = 60  # Constante RRF standard
    
    # Créer un dictionnaire de scores par document ID
    doc_scores: Dict[str, Dict[str, Any]] = {}
    
    # Ajouter les scores TF-IDF
    for rank, (payload, score) in enumerate(tfidf_results):
        doc_id = str(payload.get('id', ''))
        if not doc_id:
            continue
        
        rrf_score = tfidf_weight / (k + rank + 1)
        
        if doc_id not in doc_scores:
            doc_scores[doc_id] = {
                'payload': payload,
                'rrf_score': 0,
                'tfidf_score': score,
                'faiss_score': 0,
                'tfidf_rank': rank + 1,
                'faiss_rank': None,
            }
        doc_scores[doc_id]['rrf_score'] += rrf_score
        doc_scores[doc_id]['tfidf_score'] = score
        doc_scores[doc_id]['tfidf_rank'] = rank + 1
    
    # Ajouter les scores FAISS
    for rank, (payload, score) in enumerate(faiss_results):
        doc_id = str(payload.get('id', ''))
        if not doc_id:
            continue
        
        rrf_score = semantic_weight / (k + rank + 1)
        
        if doc_id not in doc_scores:
            doc_scores[doc_id] = {
                'payload': payload,
                'rrf_score': 0,
                'tfidf_score': 0,
                'faiss_score': score,
                'tfidf_rank': None,
                'faiss_rank': rank + 1,
            }
        doc_scores[doc_id]['rrf_score'] += rrf_score
        doc_scores[doc_id]['faiss_score'] = score
        doc_scores[doc_id]['faiss_rank'] = rank + 1
    
    # Trier par score RRF décroissant
    sorted_docs = sorted(
        doc_scores.values(),
        key=lambda x: x['rrf_score'],
        reverse=True
    )
    
    # Retourner les top_k résultats
    results = []
    for doc in sorted_docs[:top_k]:
        # Déterminer la méthode principale
        if doc['tfidf_rank'] and doc['faiss_rank']:
            method = 'hybrid'
        elif doc['tfidf_rank']:
            method = 'tfidf'
        else:
            method = 'faiss'
        
        results.append((doc['payload'], doc['rrf_score'], method))
    
    return results
