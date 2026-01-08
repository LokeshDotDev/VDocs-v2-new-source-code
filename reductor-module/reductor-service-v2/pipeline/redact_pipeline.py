"""
Redaction Pipeline
Combines Presidio (PRIMARY) and Regex (SECONDARY) PII detection and redaction.

Pipeline:
1. Extract text from document
2. Run Presidio detector (PRIMARY)
3. Run Regex detector (SECONDARY fallback)
4. Merge detections (avoid duplicates)
5. Redact all detected PII
6. Return redacted text
"""

import logging
import re
from typing import List, Dict, Tuple
from detectors.presidio_detector import get_presidio_detector
from detectors.regex_detector import get_regex_detector

logger = logging.getLogger(__name__)


class RedactionPipeline:
    """Combines Presidio and Regex detection for comprehensive PII redaction"""
    
    def __init__(self):
        """Initialize detectors"""
        self.presidio_detector = get_presidio_detector()
        self.regex_detector = get_regex_detector()
        logger.info("Redaction pipeline initialized")
    
    def _merge_detections(self, presidio_detections: List[Dict], regex_detections: List[Dict]) -> List[Dict]:
        """
        Merge detections from Presidio and Regex, avoiding duplicates.
        Always prioritize PERSON and STUDENT_ROLL_NUMBER detection - regex acts as safety net.
        
        Args:
            presidio_detections: List of Presidio detections
            regex_detections: List of Regex detections
            
        Returns:
            Merged list of unique detections, sorted by position
        """
        merged = list(presidio_detections)  # Start with Presidio (higher priority)
        
        for regex_det in regex_detections:
            is_duplicate = False
            
            # Check if this regex detection overlaps with any Presidio detection
            for pres_det in presidio_detections:
                if regex_det["entity_type"] == pres_det["entity_type"]:
                    # Calculate overlap
                    overlap_start = max(regex_det["start"], pres_det["start"])
                    overlap_end = min(regex_det["end"], pres_det["end"])
                    overlap_length = max(0, overlap_end - overlap_start)
                    
                    regex_length = regex_det["end"] - regex_det["start"]
                    pres_length = pres_det["end"] - pres_det["start"]
                    
                    # If >50% overlap, consider duplicate
                    if overlap_length > 0.5 * min(regex_length, pres_length):
                        is_duplicate = True
                        logger.debug(f"Skipping duplicate: '{regex_det['text']}'")
                        break
            
            if not is_duplicate:
                # Always add regex detections - they're our safety net for names/rolls
                merged.append(regex_det)
                logger.debug(f"Adding regex detection (SAFETY NET): '{regex_det['text']}' type={regex_det['entity_type']}")
        
        # Sort by start position
        merged.sort(key=lambda x: x["start"])
        
        return merged
    
    def redact_text(self, text: str, redaction_char: str = "█") -> Tuple[str, Dict]:
        """
        Redact PII from text using combined Presidio + Regex detection.
        
        Args:
            text: Input text to redact
            redaction_char: Character to use for redaction (default: █)
            
        Returns:
            Tuple of (redacted_text, stats)
            stats contains:
            - total_detections: Total number of PII entities found
            - presidio_count: Number from Presidio
            - regex_count: Number from Regex
            - names_redacted: Number of names redacted
            - rolls_redacted: Number of roll numbers redacted
            - entities: List of detected entities
        """
        if not text or not text.strip():
            return text, {
                "total_detections": 0,
                "presidio_count": 0,
                "regex_count": 0,
                "names_redacted": 0,
                "rolls_redacted": 0,
                "entities": []
            }
        
        logger.info(f"Starting redaction pipeline on {len(text)} characters")
        
        # Step 1: Run Presidio (PRIMARY)
        logger.info("Running Presidio detector...")
        presidio_detections = self.presidio_detector.detect(text)
        logger.info(f"Presidio found {len(presidio_detections)} entities")
        
        # Step 2: Run Regex (SECONDARY)
        logger.info("Running Regex detector...")
        regex_detections = self.regex_detector.detect(text)
        logger.info(f"Regex found {len(regex_detections)} entities")
        
        # Step 3: Merge detections
        merged_detections = self._merge_detections(presidio_detections, regex_detections)
        logger.info(f"Merged to {len(merged_detections)} unique entities")
        
        # Step 4: Redact text
        redacted_text = text
        names_count = 0
        rolls_count = 0

        def _is_formula_line(global_start: int) -> bool:
            """Detect if line contains mathematical formulas/notation."""
            line_start = redacted_text.rfind("\n", 0, global_start)
            if line_start == -1:
                line_start = 0
            else:
                line_start += 1

            line_end = redacted_text.find("\n", global_start)
            if line_end == -1:
                line_end = len(redacted_text)

            line_text = redacted_text[line_start:line_end]
            
            # Math indicators: equations, matrices, symbols
            math_patterns = [
                r"\\[a-zA-Z]+",  # LaTeX commands
                r"[=∫∑∏∂Δ√≈≠≤≥±×÷]",  # Math symbols
                r"\^\d|_\d",  # Superscript/subscript
                r"\[\s*\[|\]\s*\]",  # Matrix brackets
                r"\d+[a-zA-Z]\s*[=≈]",  # Variable equations like "2x ="
                r"[A-Z]\s*=\s*\[",  # Matrix definitions
                r"d[A-Z]/d[A-Z]",  # Derivatives
                r"Ep\s*=",  # Elasticity formulas
                r"\(\s*[A-Z]\s*=\s*\d+",  # Coordinate/value pairs
            ]
            
            for pat in math_patterns:
                if re.search(pat, line_text):
                    return True
            return False

        def _label_on_line(global_start: int, entity_type: str) -> int:
            """Return label end on same line if present, else -1."""
            if global_start < 0:
                return -1

            line_start = redacted_text.rfind("\n", 0, global_start)
            if line_start == -1:
                line_start = 0
            else:
                line_start += 1

            line_end = redacted_text.find("\n", global_start)
            if line_end == -1:
                line_end = len(redacted_text)

            line_text = redacted_text[line_start:line_end]
            offset_base = line_start

            patterns = []
            if entity_type == "PERSON":
                patterns = [r"(?i)(name|student\s+name|submitted\s+by|author|student)\s*[:–-]?\s*"]
            elif entity_type == "STUDENT_ROLL_NUMBER":
                patterns = [r"(?i)(roll\s*no|roll\s*number|roll|student\s*id|enrollment\s*no|id\s*no|enrollment)\s*[:–-]?\s*"]

            for pat in patterns:
                m = re.search(pat, line_text)
                if m:
                    return offset_base + m.end()
            return -1
        
        # Process in reverse order to maintain positions
        for detection in reversed(merged_detections):
            start = detection["start"]
            end = detection["end"]
            entity_type = detection["entity_type"]
            original_text = detection["text"]

            # Skip formulas/mathematical notation
            if _is_formula_line(start):
                logger.debug(f"Skipping formula line: '{original_text}'")
                continue

            # Require a label on the same line for PERSON/ROLL to avoid redacting body text
            label_end = _label_on_line(start, entity_type)
            if label_end == -1:
                # No label context; skip to avoid damaging course names/body/formulas
                logger.debug(f"Skipping unlabeled detection: '{original_text}'")
                continue

            adjusted_start = label_end

            # Also trim inline label if detector span includes it
            span_text = redacted_text[start:end]
            inline_label = None
            if entity_type == "PERSON":
                inline_label = re.match(r"(?i)\s*(name|student\s+name|submitted\s+by|author|student)\s*[:–-]?\s*", span_text)
            elif entity_type == "STUDENT_ROLL_NUMBER":
                inline_label = re.match(r"(?i)\s*(roll\s*no|roll\s*number|roll|student\s*id|enrollment\s*no|id\s*no|enrollment)\s*[:–-]?\s*", span_text)

            if inline_label and inline_label.end() < len(span_text):
                adjusted_start = max(adjusted_start, start + inline_label.end())

            # If nothing to redact after keeping the label, skip
            if adjusted_start >= end:
                continue

            # Replace detected value with spaces (leave label intact)
            redaction = " " * (end - adjusted_start)
            redacted_text = redacted_text[:adjusted_start] + redaction + redacted_text[end:]

            # Count by type
            if entity_type == "PERSON":
                names_count += 1
            elif entity_type == "STUDENT_ROLL_NUMBER":
                rolls_count += 1

            logger.debug(
                "Redacted %s: '%s' at position %s-%s (value only)",
                entity_type,
                original_text,
                adjusted_start,
                end,
            )
        
        # Step 5: Prepare stats
        stats = {
            "total_detections": len(merged_detections),
            "presidio_count": len(presidio_detections),
            "regex_count": len(regex_detections),
            "names_redacted": names_count,
            "rolls_redacted": rolls_count,
            "entities": merged_detections
        }
        
        logger.info(f"Redaction complete: {names_count} names, {rolls_count} rolls")
        
        return redacted_text, stats


# Singleton instance
_redaction_pipeline_instance = None


def get_redaction_pipeline() -> RedactionPipeline:
    """Get singleton redaction pipeline instance"""
    global _redaction_pipeline_instance
    if _redaction_pipeline_instance is None:
        _redaction_pipeline_instance = RedactionPipeline()
    return _redaction_pipeline_instance


def redact_text(text: str) -> str:
    """
    Convenience function for text redaction.
    
    Args:
        text: Text to redact
        
    Returns:
        Redacted text
    """
    pipeline = get_redaction_pipeline()
    redacted, stats = pipeline.redact_text(text)
    return redacted
