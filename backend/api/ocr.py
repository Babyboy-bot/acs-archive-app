"""
Module OCR pour l'extraction de texte des documents scannés.
Utilise Tesseract OCR via pytesseract.
"""
import os
import io
import logging
import tempfile
from pathlib import Path
from typing import List, Tuple, Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# Configuration Tesseract
TESSERACT_CMD = getattr(settings, 'TESSERACT_CMD', None)
TESSERACT_LANG = getattr(settings, 'TESSERACT_LANG', 'fra')  # Français par défaut
OCR_DPI = int(getattr(settings, 'OCR_DPI', 300))
OCR_ENABLED = getattr(settings, 'OCR_ENABLED', True)

# Vérifier si les dépendances sont disponibles
try:
    import pytesseract
    from PIL import Image
    
    # Configurer le chemin Tesseract si spécifié
    if TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    
    # Vérifier que Tesseract est accessible
    try:
        pytesseract.get_tesseract_version()
        TESSERACT_AVAILABLE = True
        logger.info("Tesseract OCR disponible")
    except Exception as e:
        logger.warning(f"Tesseract OCR non accessible: {e}")
        TESSERACT_AVAILABLE = False
        
except ImportError as e:
    logger.warning(f"pytesseract ou PIL non disponible: {e}")
    pytesseract = None
    Image = None
    TESSERACT_AVAILABLE = False

# Vérifier si pdf2image est disponible pour convertir les PDF en images
try:
    from pdf2image import convert_from_path, convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
    logger.info("pdf2image disponible pour la conversion PDF -> images")
except ImportError:
    logger.warning("pdf2image non disponible, OCR des PDF scannés désactivé")
    convert_from_path = None
    convert_from_bytes = None
    PDF2IMAGE_AVAILABLE = False


def is_ocr_available() -> bool:
    """Vérifie si l'OCR est disponible et activé."""
    return OCR_ENABLED and TESSERACT_AVAILABLE


def is_pdf_ocr_available() -> bool:
    """Vérifie si l'OCR des PDF est disponible."""
    return is_ocr_available() and PDF2IMAGE_AVAILABLE


def ocr_image(image_path: str, lang: str = None) -> str:
    """
    Extrait le texte d'une image avec Tesseract OCR.
    
    Args:
        image_path: Chemin vers l'image
        lang: Code langue Tesseract (fra, eng, etc.)
        
    Returns:
        Texte extrait
    """
    if not is_ocr_available():
        logger.warning("OCR non disponible")
        return ""
    
    lang = lang or TESSERACT_LANG
    
    try:
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image, lang=lang)
        return text.strip()
    except Exception as e:
        logger.error(f"Erreur OCR sur {image_path}: {e}")
        return ""


def ocr_image_bytes(image_bytes: bytes, lang: str = None) -> str:
    """
    Extrait le texte d'une image en bytes avec Tesseract OCR.
    
    Args:
        image_bytes: Contenu de l'image en bytes
        lang: Code langue Tesseract
        
    Returns:
        Texte extrait
    """
    if not is_ocr_available():
        return ""
    
    lang = lang or TESSERACT_LANG
    
    try:
        image = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(image, lang=lang)
        return text.strip()
    except Exception as e:
        logger.error(f"Erreur OCR sur image bytes: {e}")
        return ""


def ocr_pdf_pages(pdf_path: str, lang: str = None, dpi: int = None) -> List[Tuple[int, str]]:
    """
    Extrait le texte de chaque page d'un PDF scanné avec OCR.
    
    Args:
        pdf_path: Chemin vers le fichier PDF
        lang: Code langue Tesseract
        dpi: Résolution pour la conversion (défaut: 300)
        
    Returns:
        Liste de tuples (numéro_page, texte)
    """
    if not is_pdf_ocr_available():
        logger.warning("OCR PDF non disponible")
        return []
    
    lang = lang or TESSERACT_LANG
    dpi = dpi or OCR_DPI
    
    pages_text = []
    
    try:
        # Convertir le PDF en images
        images = convert_from_path(pdf_path, dpi=dpi)
        
        for page_num, image in enumerate(images, start=1):
            try:
                # Appliquer l'OCR sur chaque page
                text = pytesseract.image_to_string(image, lang=lang)
                text = text.strip()
                
                if text:
                    pages_text.append((page_num, text))
                    logger.debug(f"OCR page {page_num}: {len(text)} caractères extraits")
                    
            except Exception as e:
                logger.error(f"Erreur OCR page {page_num}: {e}")
                continue
        
        logger.info(f"OCR PDF terminé: {len(pages_text)} pages avec texte sur {len(images)} pages totales")
        
    except Exception as e:
        logger.error(f"Erreur conversion PDF pour OCR: {e}")
    
    return pages_text


def ocr_pdf_bytes(pdf_bytes: bytes, lang: str = None, dpi: int = None) -> List[Tuple[int, str]]:
    """
    Extrait le texte d'un PDF en bytes avec OCR.
    
    Args:
        pdf_bytes: Contenu du PDF en bytes
        lang: Code langue Tesseract
        dpi: Résolution pour la conversion
        
    Returns:
        Liste de tuples (numéro_page, texte)
    """
    if not is_pdf_ocr_available():
        return []
    
    lang = lang or TESSERACT_LANG
    dpi = dpi or OCR_DPI
    
    pages_text = []
    
    try:
        images = convert_from_bytes(pdf_bytes, dpi=dpi)
        
        for page_num, image in enumerate(images, start=1):
            try:
                text = pytesseract.image_to_string(image, lang=lang)
                text = text.strip()
                
                if text:
                    pages_text.append((page_num, text))
                    
            except Exception as e:
                logger.error(f"Erreur OCR page {page_num}: {e}")
                continue
                
    except Exception as e:
        logger.error(f"Erreur conversion PDF bytes pour OCR: {e}")
    
    return pages_text


def is_scanned_pdf(pdf_path: str, sample_pages: int = 3) -> bool:
    """
    Détecte si un PDF est scanné (images) ou natif (texte).
    
    Args:
        pdf_path: Chemin vers le PDF
        sample_pages: Nombre de pages à échantillonner
        
    Returns:
        True si le PDF semble être scanné
    """
    try:
        import PyPDF2
        
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            total_pages = len(reader.pages)
            pages_to_check = min(sample_pages, total_pages)
            
            total_text = 0
            for i in range(pages_to_check):
                page = reader.pages[i]
                text = page.extract_text() or ""
                total_text += len(text.strip())
            
            # Si très peu de texte extrait, c'est probablement un PDF scanné
            avg_text_per_page = total_text / pages_to_check if pages_to_check > 0 else 0
            
            # Seuil: moins de 100 caractères par page = probablement scanné
            return avg_text_per_page < 100
            
    except Exception as e:
        logger.warning(f"Erreur détection PDF scanné: {e}")
        return False


def extract_text_with_ocr_fallback(
    pdf_path: str,
    lang: str = None
) -> List[Tuple[int, str]]:
    """
    Extrait le texte d'un PDF avec fallback OCR si nécessaire.
    
    1. Essaie d'abord l'extraction native (PyPDF2)
    2. Si peu de texte, utilise l'OCR
    
    Args:
        pdf_path: Chemin vers le PDF
        lang: Langue pour l'OCR
        
    Returns:
        Liste de tuples (numéro_page, texte)
    """
    pages_text = []
    
    # Essayer l'extraction native d'abord
    try:
        import PyPDF2
        
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            
            for page_num, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                text = text.strip()
                if text:
                    pages_text.append((page_num, text))
        
        # Vérifier si on a assez de texte
        total_text = sum(len(text) for _, text in pages_text)
        avg_per_page = total_text / len(reader.pages) if reader.pages else 0
        
        if avg_per_page >= 100:
            logger.info(f"Extraction native réussie: {len(pages_text)} pages, {total_text} caractères")
            return pages_text
        
        logger.info(f"Peu de texte extrait ({avg_per_page:.0f} car/page), tentative OCR...")
        
    except Exception as e:
        logger.warning(f"Extraction native échouée: {e}")
    
    # Fallback OCR si disponible
    if is_pdf_ocr_available():
        ocr_pages = ocr_pdf_pages(pdf_path, lang=lang)
        if ocr_pages:
            return ocr_pages
    
    # Retourner ce qu'on a (même si peu)
    return pages_text


def get_ocr_status() -> dict:
    """Retourne le statut de l'OCR."""
    return {
        'enabled': OCR_ENABLED,
        'tesseract_available': TESSERACT_AVAILABLE,
        'pdf2image_available': PDF2IMAGE_AVAILABLE,
        'ocr_available': is_ocr_available(),
        'pdf_ocr_available': is_pdf_ocr_available(),
        'default_lang': TESSERACT_LANG,
        'default_dpi': OCR_DPI,
    }
