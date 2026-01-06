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
    import numpy as np
    
    # Configurer le chemin Tesseract si spécifié (mais pas dans Docker)
    if TESSERACT_CMD and not TESSERACT_CMD.startswith('C:\\'):
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
    np = None
    TESSERACT_AVAILABLE = False

# Vérifier si OpenCV est disponible pour le pré-traitement
try:
    import cv2
    OPENCV_AVAILABLE = True
    logger.info("OpenCV disponible pour le pré-traitement OCR")
except ImportError as e:
    logger.warning(f"OpenCV non disponible: {e}")
    cv2 = None
    OPENCV_AVAILABLE = False

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


def is_preprocessing_available() -> bool:
    """Vérifie si le pré-traitement d'image est disponible."""
    return OPENCV_AVAILABLE and is_ocr_available()


def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Applique un pré-traitement d'image pour améliorer la qualité OCR.
    
    Args:
        image: Image PIL à traiter
        
    Returns:
        Image PIL traitée
    """
    if not OPENCV_AVAILABLE:
        logger.debug("OpenCV non disponible, retour de l'image originale")
        return image
    
    try:
        # Convertir PIL Image en numpy array
        img_array = np.array(image)
        
        # Convertir en niveaux de gris si nécessaire
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        # Augmenter le contraste avec CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Réduction du bruit avec filtre médian
        denoised = cv2.medianBlur(enhanced, 3)
        
        # Binarisation adaptative (meilleure que seuillage simple)
        binary = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Redresser la page (deskew)
        deskewed = deskew_image(binary)
        
        # Retourner en PIL Image
        return Image.fromarray(deskewed)
        
    except Exception as e:
        logger.warning(f"Erreur lors du pré-traitement d'image: {e}")
        return image


def deskew_image(image: np.ndarray) -> np.ndarray:
    """
    Redresse une image inclinée (deskewing).
    
    Args:
        image: Image numpy array en niveaux de gris
        
    Returns:
        Image numpy array redressée
    """
    try:
        # Calculer les coordonnées des pixels non nuls
        coords = np.column_stack(np.where(image > 0))
        
        if len(coords) == 0:
            return image
        
        # Calculer l'angle de l'inclinaison
        angle = cv2.minAreaRect(coords)[-1]
        
        # Corriger l'angle (OpenCV retourne -90 à 0, nous voulons 0 à 90)
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        
        # Si l'angle est très faible, pas besoin de corriger
        if abs(angle) < 0.5:
            return image
        
        # Calculer le centre de l'image
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        
        # Créer la matrice de rotation
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        
        # Appliquer la rotation
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return rotated
        
    except Exception as e:
        logger.warning(f"Erreur lors du deskewing: {e}")
        return image


def is_scanned_pdf(pdf_path: str) -> bool:
    """
    Détecte si un PDF est scanné (contient principalement des images).
    
    Args:
        pdf_path: Chemin vers le fichier PDF
        
    Returns:
        True si le PDF est probablement scanné
    """
    try:
        import PyPDF2
        
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            total_chars = 0
            total_pages = len(pdf_reader.pages)
            
            # Extraire le texte natif des premières pages
            for page in pdf_reader.pages[:min(3, total_pages)]:
                try:
                    text = page.extract_text()
                    total_chars += len(text.strip())
                except:
                    continue
            
            # Calculer la moyenne de caractères par page
            chars_per_page = total_chars / min(3, total_pages)
            
            # Si moins de 100 caractères par page → probablement scanné
            is_scanned = chars_per_page < 100
            
            logger.debug(f"Detection PDF scanné: {chars_per_page:.1f} car/page → {'Scanné' if is_scanned else 'Texte'}")
            
            return is_scanned
            
    except Exception as e:
        logger.warning(f"Erreur lors de la détection PDF scanné: {e}")
        # En cas d'erreur, supposer que c'est scanné pour utiliser l'OCR
        return True


def get_tesseract_config(document_type: str = None) -> str:
    """
    Retourne la configuration Tesseract optimale selon le type de document.
    
    Args:
        document_type: Type de document (facture, formulaire, tableau, etc.)
        
    Returns:
        Chaîne de configuration Tesseract
    """
    # Modes PSM (Page Segmentation Mode) selon type de document
    PSM_MODES = {
        'facture': '--psm 6',  # Bloc de texte uniforme
        'formulaire': '--psm 4',  # Colonne unique
        'tableau': '--psm 6',  # Tableau
        'texte': '--psm 3',  # Texte plein par défaut
        'default': '--psm 3'  # Mode automatique par défaut
    }
    
    # OEM (OCR Engine Mode) - utiliser le LSTM moderne (3)
    oem_mode = '--oem 3'
    
    # Config selon type de document
    psm_mode = PSM_MODES.get(document_type, PSM_MODES['default'])
    
    config = f"{psm_mode} {oem_mode}"
    
    logger.debug(f"Configuration Tesseract pour {document_type or 'default'}: {config}")
    
    return config


def ocr_image(image_path: str, lang: str = None, document_type: str = None, use_preprocessing: bool = True) -> str:
    """
    Extrait le texte d'une image avec Tesseract OCR et pré-traitement optionnel.
    
    Args:
        image_path: Chemin vers l'image
        lang: Code langue Tesseract (fra, eng, etc.)
        document_type: Type de document pour config Tesseract
        use_preprocessing: Appliquer le pré-traitement d'image
        
    Returns:
        Texte extrait
    """
    if not is_ocr_available():
        logger.warning("OCR non disponible")
        return ""
    
    lang = lang or TESSERACT_LANG
    
    try:
        # Charger l'image
        image = Image.open(image_path)
        
        # Appliquer le pré-traitement si disponible et activé
        if use_preprocessing and is_preprocessing_available():
            logger.debug(f"Application du pré-traitement sur {image_path}")
            processed_image = preprocess_image(image)
        else:
            processed_image = image
        
        # Obtenir la configuration Tesseract optimisée
        config = get_tesseract_config(document_type)
        
        # Extraire le texte avec la configuration avancée
        text = pytesseract.image_to_string(
            processed_image, 
            lang=lang, 
            config=config
        )
        
        logger.debug(f"OCR terminé pour {image_path}: {len(text)} caractères")
        return text.strip()
        
    except Exception as e:
        logger.error(f"Erreur OCR sur {image_path}: {e}")
        return ""


def ocr_image_bytes(image_bytes: bytes, lang: str = None, document_type: str = None, use_preprocessing: bool = True) -> str:
    """
    Extrait le texte d'une image en bytes avec Tesseract OCR et pré-traitement optionnel.
    
    Args:
        image_bytes: Contenu de l'image en bytes
        lang: Code langue Tesseract
        document_type: Type de document pour config Tesseract
        use_preprocessing: Appliquer le pré-traitement d'image
        
    Returns:
        Texte extrait
    """
    if not is_ocr_available():
        return ""
    
    lang = lang or TESSERACT_LANG
    
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        # Appliquer le pré-traitement si disponible et activé
        if use_preprocessing and is_preprocessing_available():
            processed_image = preprocess_image(image)
        else:
            processed_image = image
        
        # Obtenir la configuration Tesseract optimisée
        config = get_tesseract_config(document_type)
        
        # Extraire le texte avec la configuration avancée
        text = pytesseract.image_to_string(
            processed_image, 
            lang=lang, 
            config=config
        )
        
        return text.strip()
    except Exception as e:
        logger.error(f"Erreur OCR sur image bytes: {e}")
        return ""


def ocr_pdf_pages(pdf_path: str, lang: str = None, dpi: int = None, document_type: str = None, use_preprocessing: bool = True) -> List[Tuple[int, str]]:
    """
    Extrait le texte de chaque page d'un PDF scanné avec OCR avancé.
    
    Args:
        pdf_path: Chemin vers le fichier PDF
        lang: Code langue Tesseract
        dpi: Résolution pour la conversion (défaut: 300)
        document_type: Type de document pour config Tesseract
        use_preprocessing: Appliquer le pré-traitement d'image
        
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
        
        # Obtenir la configuration Tesseract optimisée
        config = get_tesseract_config(document_type)
        
        for page_num, image in enumerate(images, start=1):
            try:
                # Appliquer le pré-traitement si disponible et activé
                if use_preprocessing and is_preprocessing_available():
                    processed_image = preprocess_image(image)
                else:
                    processed_image = image
                
                # Appliquer l'OCR avec configuration avancée
                text = pytesseract.image_to_string(
                    processed_image, 
                    lang=lang, 
                    config=config
                )
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
    lang: str = None,
    document_type: str = None,
    use_preprocessing: bool = True,
    force_ocr: bool = False
) -> List[Tuple[int, str]]:
    """
    Extrait le texte d'un PDF avec détection intelligente et fallback OCR.
    
    1. Détecte si le PDF est scanné
    2. Si texte natif suffisant et non forcé → utilise PyPDF2
    3. Sinon, utilise l'OCR avec pré-traitement et configuration avancée
    
    Args:
        pdf_path: Chemin vers le PDF
        lang: Langue pour l'OCR
        document_type: Type de document pour config Tesseract
        use_preprocessing: Appliquer le pré-traitement d'image
        force_ocr: Forcer l'OCR même si du texte est détecté
        
    Returns:
        Liste de tuples (numéro_page, texte)
    """
    pages_text = []
    
    # Détecter si le PDF est scanné (sauf si OCR forcé)
    is_scanned = False
    if not force_ocr:
        is_scanned = is_scanned_pdf(pdf_path)
        logger.debug(f"PDF détecté comme: {'scanné' if is_scanned else 'texte'}")
    
    # Si le PDF n'est pas scanné et OCR non forcé, essayer l'extraction native
    if not is_scanned and not force_ocr:
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
            
            logger.info(f"Peu de texte extrait ({avg_per_page:.0f} car/page), basculement vers OCR...")
            
        except Exception as e:
            logger.warning(f"Extraction native échouée: {e}")
    
    # Utiliser l'OCR avec pré-traitement et configuration avancée
    if is_pdf_ocr_available():
        logger.info(f"Utilisation de l'OCR avec pré-traitement: {use_preprocessing}")
        ocr_pages = ocr_pdf_pages(pdf_path, lang=lang, dpi=OCR_DPI, document_type=document_type, use_preprocessing=use_preprocessing)
        if ocr_pages:
            total_chars = sum(len(text) for _, text in ocr_pages)
            logger.info(f"OCR terminé: {len(ocr_pages)} pages, {total_chars} caractères")
            return ocr_pages
    
    # Retourner ce qu'on a (même si peu)
    logger.warning("OCR indisponible, retour du texte natif (si disponible)")
    return pages_text


def get_ocr_status() -> dict:
    """Retourne le statut de l'OCR avec toutes les fonctionnalités."""
    return {
        'enabled': OCR_ENABLED,
        'tesseract_available': TESSERACT_AVAILABLE,
        'pdf2image_available': PDF2IMAGE_AVAILABLE,
        'opencv_available': OPENCV_AVAILABLE,
        'ocr_available': is_ocr_available(),
        'pdf_ocr_available': is_pdf_ocr_available(),
        'preprocessing_available': is_preprocessing_available(),
        'default_lang': TESSERACT_LANG,
        'default_dpi': OCR_DPI,
        'features': {
            'basic_ocr': TESSERACT_AVAILABLE,
            'pdf_ocr': is_pdf_ocr_available(),
            'image_preprocessing': is_preprocessing_available(),
            'intelligent_detection': True,
            'advanced_tesseract_config': True,
            'deskewing': OPENCV_AVAILABLE,
            'noise_reduction': OPENCV_AVAILABLE,
            'contrast_enhancement': OPENCV_AVAILABLE,
        }
    }
