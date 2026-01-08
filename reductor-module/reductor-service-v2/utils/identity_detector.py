"""
identity_detector.py

Smart student identity detection using Presidio + Regex pipeline.

UPDATED: Now uses Presidio as PRIMARY detector with Regex as fallback.
"""

import re
from lxml import etree
from logger import get_logger
from pipeline.redact_pipeline import get_redaction_pipeline

logger = get_logger(__name__)

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

# Initialize redaction pipeline (Presidio + Regex)
_redaction_pipeline = None

def get_pipeline():
    """Get or create redaction pipeline instance"""
    global _redaction_pipeline
    if _redaction_pipeline is None:
        _redaction_pipeline = get_redaction_pipeline()
    return _redaction_pipeline


def extract_text_nodes(root: etree._Element) -> list:
    """Extract all text node content as list."""
    return [t.text or "" for t in root.xpath("//w:t", namespaces=WORD_NAMESPACE)]


def extract_combined_text(root: etree._Element, max_nodes: int = 200) -> str:
    """Combine adjacent text nodes to handle split names/values."""
    texts = extract_text_nodes(root)
    # Join first N nodes with spaces to create continuous text
    return " ".join(texts[:max_nodes]).strip()


def extract_first_n_lines(root: etree._Element, n: int = 20) -> str:
    """Extract first N text nodes (document start)."""
    texts = extract_text_nodes(root)
    return " ".join(texts[:n]).strip()


def extract_table_text(root: etree._Element) -> str:
    """Extract text from tables specifically."""
    table_texts = []
    for table in root.xpath("//w:tbl", namespaces=WORD_NAMESPACE):
        for t in table.xpath(".//w:t", namespaces=WORD_NAMESPACE):
            if t.text:
                table_texts.append(t.text)
    return " ".join(table_texts[:100]).strip()


def detect_identity(docx_tree: etree._ElementTree) -> dict:
    """
    Detect student identity from DOCX using Presidio + Regex pipeline.
    
    Returns:
    {
        "name": "JOHN DOE" or None,
        "roll_no": "123456789" or None,
        "confidence": "HIGH" | "MEDIUM" | "LOW" | "CLEAN",
        "detections": List of all detected entities
    }
    """
    root = docx_tree.getroot()
    texts = extract_text_nodes(root)
    first_section = extract_first_n_lines(root, 40)
    combined_text = extract_combined_text(root, 200)
    table_text = extract_table_text(root)
    
    # Also get full raw text for aggressive scan
    full_text = " ".join(texts[:300]).strip()
    
    # Use Presidio + Regex pipeline for detection
    logger.info("Running Presidio + Regex detection pipeline...")
    logger.info(f"Table text (first 500 chars): {table_text[:500]}")
    logger.info(f"Combined text (first 500 chars): {combined_text[:500]}")
    pipeline = get_pipeline()
    detections = []
    for segment_name, segment in [("combined", combined_text), ("first_section", first_section), ("table", table_text), ("full", full_text)]:
        if not segment:
            continue
        logger.info(f"Scanning segment: {segment_name} ({len(segment)} chars)")
        _, stats = pipeline.redact_text(segment)
        segment_detections = stats.get("entities", [])
        logger.info(f"Found {len(segment_detections)} entities in {segment_name}")
        detections.extend(segment_detections)

    # Deduplicate detections by span/text/type to avoid double counting
    unique = []
    seen = set()
    for det in detections:
        key = (det["entity_type"], det["start"], det["end"], det.get("text"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(det)
    detections = unique
    
    detected_name = None
    detected_roll = None
    confidence = "LOW"
    
    # Extract detected entities
    # Find first PERSON and STUDENT_ROLL_NUMBER
    for detection in detections:
        if detection["entity_type"] == "PERSON" and not detected_name:
            detected_name = detection["text"]
            confidence = "HIGH" if detection["score"] > 0.7 else "MEDIUM"
            logger.info(f"  🔍 Detected name (Presidio/Regex): {detected_name} (score={detection['score']:.2f})")
        
        elif detection["entity_type"] == "STUDENT_ROLL_NUMBER" and not detected_roll:
            detected_roll = detection["text"]
            logger.info(f"  🔍 Detected roll (Presidio/Regex): {detected_roll} (score={detection['score']:.2f})")
    
    # Determine final confidence
    if detected_name and detected_roll:
        confidence = "HIGH"
    elif detected_name or detected_roll:
        confidence = "MEDIUM"
    elif not detected_name and not detected_roll:
        confidence = "CLEAN"
    
    return {
        "name": detected_name,
        "roll_no": detected_roll,
        "confidence": confidence,
        "detections": detections
    }
