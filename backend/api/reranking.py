"""
Module de reranking léger pour améliorer la pertinence des résultats de recherche.
Utilise des heuristiques plutôt qu'un modèle ML lourd.
"""
import re
import unicodedata
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime


def normalize_text(text: str) -> str:
    """Normalise un texte pour la comparaison."""
    if not text:
        return ""
    # Supprimer les accents
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    # Minuscules et suppression de la ponctuation
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_query_terms(query: str) -> List[str]:
    """Extrait les termes significatifs d'une requête."""
    normalized = normalize_text(query)
    words = normalized.split()
    # Filtrer les mots trop courts et les stop words français
    stop_words = {
        'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 
        'au', 'aux', 'ce', 'ces', 'cette', 'mon', 'ma', 'mes', 'ton', 'ta',
        'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur',
        'leurs', 'qui', 'que', 'quoi', 'dont', 'ou', 'pour', 'par', 'sur',
        'sous', 'avec', 'sans', 'dans', 'en', 'est', 'sont', 'etre', 'avoir',
        'fait', 'faire', 'dit', 'dire', 'peut', 'pouvoir', 'doit', 'devoir',
        'tout', 'tous', 'toute', 'toutes', 'quel', 'quelle', 'quels', 'quelles',
        'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on',
        'me', 'te', 'se', 'lui', 'y', 'ne', 'pas', 'plus', 'moins', 'tres',
        'bien', 'mal', 'aussi', 'comme', 'mais', 'donc', 'car', 'ni', 'si',
    }
    return [w for w in words if len(w) > 2 and w not in stop_words]


def calculate_term_coverage(query_terms: List[str], document_text: str) -> float:
    """Calcule le pourcentage de termes de la requête présents dans le document."""
    if not query_terms:
        return 0.0
    
    doc_normalized = normalize_text(document_text)
    found = sum(1 for term in query_terms if term in doc_normalized)
    return found / len(query_terms)


def calculate_term_density(query_terms: List[str], document_text: str) -> float:
    """Calcule la densité des termes de la requête dans le document."""
    if not query_terms or not document_text:
        return 0.0
    
    doc_normalized = normalize_text(document_text)
    doc_words = doc_normalized.split()
    
    if not doc_words:
        return 0.0
    
    term_count = sum(doc_words.count(term) for term in query_terms)
    return min(1.0, term_count / (len(doc_words) * 0.1))  # Normaliser


def calculate_exact_match_bonus(query: str, document_text: str) -> float:
    """Bonus si la requête exacte (ou une grande partie) est dans le document."""
    query_normalized = normalize_text(query)
    doc_normalized = normalize_text(document_text)
    
    if query_normalized in doc_normalized:
        return 1.0
    
    # Vérifier les sous-phrases
    query_words = query_normalized.split()
    if len(query_words) >= 3:
        for i in range(len(query_words) - 2):
            phrase = ' '.join(query_words[i:i+3])
            if phrase in doc_normalized:
                return 0.5
    
    return 0.0


def calculate_recency_score(metadata: Dict[str, Any]) -> float:
    """Score basé sur la récence du document."""
    date_str = metadata.get('date_document') or metadata.get('cree_le')
    if not date_str:
        return 0.5  # Score neutre si pas de date
    
    try:
        if isinstance(date_str, str):
            # Parser différents formats de date
            for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%d/%m/%Y']:
                try:
                    doc_date = datetime.strptime(date_str[:10], fmt)
                    break
                except ValueError:
                    continue
            else:
                return 0.5
        else:
            doc_date = date_str
        
        # Score basé sur l'âge (documents récents = meilleur score)
        age_days = (datetime.now() - doc_date).days
        if age_days < 30:
            return 1.0
        elif age_days < 90:
            return 0.9
        elif age_days < 365:
            return 0.8
        elif age_days < 730:
            return 0.7
        else:
            return 0.6
    except Exception:
        return 0.5


def calculate_metadata_match(query: str, metadata: Dict[str, Any]) -> float:
    """Score basé sur la correspondance avec les métadonnées."""
    query_normalized = normalize_text(query)
    score = 0.0
    
    # Vérifier le client
    client = normalize_text(str(metadata.get('client', '')))
    if client and client in query_normalized:
        score += 0.3
    
    # Vérifier l'exercice/année
    exercice = str(metadata.get('exercice', ''))
    if exercice and exercice in query_normalized:
        score += 0.2
    
    # Vérifier le type de risque
    risque = normalize_text(str(metadata.get('risque', '')))
    if risque and risque in query_normalized:
        score += 0.2
    
    # Vérifier le type de courrier
    type_courrier = normalize_text(str(metadata.get('type_courrier', '') or metadata.get('type', '')))
    if type_courrier and type_courrier in query_normalized:
        score += 0.2
    
    # Vérifier la référence
    reference = normalize_text(str(metadata.get('reference', '')))
    if reference and reference in query_normalized:
        score += 0.1
    
    return min(1.0, score)


def rerank_results(
    query: str,
    results: List[Tuple[Dict[str, Any], float]],
    weights: Optional[Dict[str, float]] = None
) -> List[Tuple[Dict[str, Any], float, Dict[str, float]]]:
    """
    Rerank les résultats de recherche avec des heuristiques.
    
    Args:
        query: La requête de recherche
        results: Liste de tuples (payload, score_initial)
        weights: Poids optionnels pour chaque facteur
        
    Returns:
        Liste de tuples (payload, score_final, détails_scores)
    """
    if not results:
        return []
    
    # Poids par défaut
    default_weights = {
        'initial_score': 0.4,
        'term_coverage': 0.2,
        'term_density': 0.1,
        'exact_match': 0.1,
        'recency': 0.1,
        'metadata_match': 0.1,
    }
    weights = weights or default_weights
    
    query_terms = extract_query_terms(query)
    reranked = []
    
    for payload, initial_score in results:
        # Construire le texte du document
        doc_text = ' '.join(filter(None, [
            str(payload.get('titre', '')),
            str(payload.get('description', '')),
            str(payload.get('content', '')),
        ]))
        
        metadata = payload.get('metadata', {})
        
        # Calculer les scores individuels
        scores = {
            'initial_score': initial_score,
            'term_coverage': calculate_term_coverage(query_terms, doc_text),
            'term_density': calculate_term_density(query_terms, doc_text),
            'exact_match': calculate_exact_match_bonus(query, doc_text),
            'recency': calculate_recency_score(metadata),
            'metadata_match': calculate_metadata_match(query, metadata),
        }
        
        # Calculer le score final pondéré
        final_score = sum(
            scores.get(factor, 0) * weight 
            for factor, weight in weights.items()
        )
        
        reranked.append((payload, final_score, scores))
    
    # Trier par score final décroissant
    reranked.sort(key=lambda x: x[1], reverse=True)
    
    return reranked


def rerank_simple(
    query: str,
    results: List[Tuple[Dict[str, Any], float]]
) -> List[Tuple[Dict[str, Any], float]]:
    """
    Version simplifiée du reranking (sans détails).
    
    Returns:
        Liste de tuples (payload, score_final)
    """
    reranked = rerank_results(query, results)
    return [(payload, score) for payload, score, _ in reranked]
