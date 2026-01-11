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
    pipeline = get_pipeline()

    text_nodes = root.xpath("//w:t", namespaces=WORD_NAMESPACE)
    detections = []

    # Detect per text node to avoid span mismatch; only keep exact node text matches
    for idx, node in enumerate(text_nodes):
        node_text = (node.text or "").strip()
        if not node_text:
            continue
        _, stats = pipeline.redact_text(node_text)
        for det in stats.get("entities", []):
            det_text = (det.get("text") or "").strip()
            if not det_text:
                continue
            # Exact match (case-insensitive) with the node text only
            if det_text.lower() != node_text.lower():
                continue
            detections.append({
                "entity_type": det["entity_type"],
                "text": det_text,
                "score": det.get("score", 0.0),
                "node_index": idx,
            })

    detected_name = None
    detected_roll = None
    confidence = "LOW"

    for det in detections:
        if det["entity_type"] == "PERSON" and not detected_name:
            detected_name = det["text"]
            confidence = "HIGH" if det.get("score", 0) > 0.7 else "MEDIUM"
        if det["entity_type"] == "STUDENT_ROLL_NUMBER" and not detected_roll:
            detected_roll = det["text"]

    if detected_name and detected_roll:
        confidence = "HIGH"
    elif detected_name or detected_roll:
        confidence = "MEDIUM"
    else:
        confidence = "CLEAN"

    return {
        "name": detected_name,
        "roll_no": detected_roll,
        "confidence": confidence,
        "detections": detections,
    }
