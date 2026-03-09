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


def preprocess_image(image: Image.Image, aggressive: bool = False) -> Image.Image:
    """
    Applique un pré-traitement d'image pour améliorer la qualité OCR.
    
    Args:
        image: Image PIL à traiter
        aggressive: Mode agressif pour documents très dégradés (anciens, mal scannés)
        
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
        
        # === ÉTAPE 1: Redimensionnement si résolution trop basse ===
        height, width = gray.shape[:2]
        min_dimension = min(height, width)
        if min_dimension < 1000:
            # Upscale pour améliorer la reconnaissance
            scale_factor = 1500 / min_dimension
            gray = cv2.resize(gray, None, fx=scale_factor, fy=scale_factor, interpolation=cv2.INTER_CUBIC)
            logger.debug(f"Image upscalée: {width}x{height} -> {gray.shape[1]}x{gray.shape[0]}")
        
        # === ÉTAPE 2: Suppression du bruit de fond (documents anciens) ===
        if aggressive:
            # Filtre bilatéral: préserve les bords tout en lissant
            gray = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # === ÉTAPE 3: Correction du contraste avec CLAHE ===
        clahe_clip = 3.0 if aggressive else 2.0
        clahe = cv2.createCLAHE(clipLimit=clahe_clip, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # === ÉTAPE 4: Débruitage ===
        if aggressive:
            # Débruitage non-local means (plus puissant mais plus lent)
            denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)
        else:
            # Filtre médian standard
            denoised = cv2.medianBlur(enhanced, 3)
        
        # === ÉTAPE 5: Amélioration de la netteté ===
        # Kernel de sharpening
        kernel_sharpen = np.array([[-1, -1, -1],
                                   [-1,  9, -1],
                                   [-1, -1, -1]])
        sharpened = cv2.filter2D(denoised, -1, kernel_sharpen)
        
        # === ÉTAPE 6: Binarisation adaptative ===
        block_size = 15 if aggressive else 11
        binary = cv2.adaptiveThreshold(
            sharpened, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, 2
        )
        
        # === ÉTAPE 7: Nettoyage morphologique (suppression des petits artefacts) ===
        if aggressive:
            # Ouverture morphologique pour supprimer le bruit
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
            # Fermeture pour reconnecter les caractères fragmentés
            binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        # === ÉTAPE 8: Redressement (deskew) ===
        deskewed = deskew_image(binary)
        
        # === ÉTAPE 9: Suppression des bordures noires ===
        deskewed = remove_borders(deskewed)
        
        # Retourner en PIL Image
        return Image.fromarray(deskewed)
        
    except Exception as e:
        logger.warning(f"Erreur lors du pré-traitement d'image: {e}")
        return image


def remove_borders(image: np.ndarray, threshold: int = 10) -> np.ndarray:
    """
    Supprime les bordures noires autour de l'image (crop intelligent).
    
    Args:
        image: Image numpy array
        threshold: Seuil de détection des bordures
        
    Returns:
        Image numpy array sans bordures
    """
    try:
        # Trouver les lignes/colonnes non-noires
        rows = np.any(image > threshold, axis=1)
        cols = np.any(image > threshold, axis=0)
        
        if not rows.any() or not cols.any():
            return image
        
        # Trouver les indices min/max
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        
        # Ajouter une petite marge
        margin = 5
        rmin = max(0, rmin - margin)
        rmax = min(image.shape[0], rmax + margin)
        cmin = max(0, cmin - margin)
        cmax = min(image.shape[1], cmax + margin)
        
        return image[rmin:rmax, cmin:cmax]
        
    except Exception as e:
        logger.warning(f"Erreur lors de la suppression des bordures: {e}")
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
        import pypdf as PyPDF2

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
        import pypdf as PyPDF2

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
            import pypdf as PyPDF2

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


# ============================================================================
# SCORE QUALITÉ OCR - Détection de contenu mal reconnu
# ============================================================================

import re

def calculer_score_qualite_ocr(contenu: str) -> dict:
    """
    Calcule un score de qualité OCR basé sur le contenu textuel.
    
    Indicateurs de mauvaise qualité OCR :
    - Beaucoup de caractères spéciaux inhabituels
    - Mots très courts ou tronqués
    - Séquences de chiffres/lettres incohérentes
    
    Args:
        contenu: Texte extrait par OCR
        
    Returns:
        dict avec score (0-1), niveau ('bon'/'moyen'/'faible'), avertissement, details
    """
    if not contenu or len(contenu) < 50:
        return {
            'score': 0.5,
            'niveau': 'moyen',
            'avertissement': None,
            'details': {
                'ratio_caracteres_speciaux': 0,
                'ratio_mots_tronques': 0,
                'ratio_sequences_incorrectes': 0,
                'longueur_moyenne_mots': 0
            }
        }

    mots = contenu.split()
    total_mots = len(mots)
    total_caracteres = len(contenu)

    # 1. Ratio de caractères spéciaux inhabituels (hors ponctuation normale)
    caracteres_speciaux = re.findall(r'[^\w\s.,;:!?()\'"\-éèêëàâäùûüôöîïçÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ€°]', contenu)
    ratio_caracteres_speciaux = len(caracteres_speciaux) / max(total_caracteres, 1)

    # 2. Ratio de mots "tronqués" (1-2 caractères qui ne sont pas des mots courants)
    mots_courts_valides = {'a', 'à', 'y', 'n', 'de', 'du', 'le', 'la', 'un', 'en', 'et', 'ou', 'au', 'ce', 'sa', 'se', 'si', 'ne', 'ni', 'je', 'tu', 'il', 'on', 'ma', 'ta', 'me', 'te', 'vs', 'cf'}
    mots_tronques = [m for m in mots if len(m) <= 2 and m.lower() not in mots_courts_valides]
    ratio_mots_tronques = len(mots_tronques) / max(total_mots, 1)

    # 3. Ratio de séquences incohérentes
    sequences_incorrectes = []
    for m in mots:
        # Chiffres isolés (sauf dates et numéros courants)
        if re.match(r'^\d{1,2}$', m) and not re.match(r'^(0[1-9]|[12]\d|3[01])$', m):
            sequences_incorrectes.append(m)
        # Majuscules au milieu du mot (sauf acronymes)
        elif len(m) > 3 and re.search(r'[a-z][A-Z]', m) and not re.match(r'^[A-Z]+$', m):
            sequences_incorrectes.append(m)
        # Séquences de consonnes improbables
        elif re.search(r'[bcdfghjklmnpqrstvwxz]{5,}', m, re.IGNORECASE):
            sequences_incorrectes.append(m)
    ratio_sequences_incorrectes = len(sequences_incorrectes) / max(total_mots, 1)

    # 4. Longueur moyenne des mots
    longueur_moyenne_mots = sum(len(m) for m in mots) / max(total_mots, 1)

    # Calcul du score final (pondéré)
    score = 1.0
    score -= ratio_caracteres_speciaux * 3
    score -= ratio_mots_tronques * 2
    score -= ratio_sequences_incorrectes * 1.5
    
    if longueur_moyenne_mots < 3:
        score -= 0.2
    elif 4 < longueur_moyenne_mots < 8:
        score += 0.1

    # Borner le score entre 0 et 1
    score = max(0, min(1, score))

    # Déterminer le niveau et l'avertissement
    if score >= 0.7:
        niveau = 'bon'
        avertissement = None
    elif score >= 0.4:
        niveau = 'moyen'
        avertissement = 'Ce document présente quelques erreurs de numérisation. Certaines informations peuvent être incomplètes.'
    else:
        niveau = 'faible'
        avertissement = 'Document ancien ou mal numérisé : certaines informations peuvent être incomplètes ou mal reconnues. Un re-scan pourrait améliorer la qualité.'

    return {
        'score': round(score, 2),
        'niveau': niveau,
        'avertissement': avertissement,
        'priorite_rescan': score < 0.4,
        'details': {
            'ratio_caracteres_speciaux': round(ratio_caracteres_speciaux, 3),
            'ratio_mots_tronques': round(ratio_mots_tronques, 3),
            'ratio_sequences_incorrectes': round(ratio_sequences_incorrectes, 3),
            'longueur_moyenne_mots': round(longueur_moyenne_mots, 1),
        }
    }


def analyser_qualite_document(document_id: str) -> dict:
    """
    Analyse la qualité OCR d'un document spécifique.
    
    Args:
        document_id: ID du document à analyser
        
    Returns:
        dict avec score, niveau, avertissement, priorite_rescan
    """
    from .models import Document, DocumentChunk
    
    try:
        document = Document.objects.get(id=document_id)
        
        # Récupérer le contenu des chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by('ordre')
        contenu_complet = '\n'.join([c.texte for c in chunks if c.texte])
        
        if not contenu_complet:
            return {
                'document_id': document_id,
                'titre': document.titre,
                'score': 0,
                'niveau': 'faible',
                'avertissement': 'Aucun contenu textuel disponible pour ce document.',
                'priorite_rescan': True,
                'details': {}
            }
        
        qualite = calculer_score_qualite_ocr(contenu_complet)
        qualite['document_id'] = document_id
        qualite['titre'] = document.titre
        qualite['caracteres_total'] = len(contenu_complet)
        qualite['chunks_count'] = chunks.count()
        
        return qualite
        
    except Document.DoesNotExist:
        return {
            'document_id': document_id,
            'error': 'Document non trouvé'
        }
    except Exception as e:
        logger.error(f"Erreur analyse qualité document {document_id}: {e}")
        return {
            'document_id': document_id,
            'error': str(e)
        }
