"""
Regex-based PII Detector - SECONDARY/Fallback detection engine
Contains the existing regex-based detection logic as fallback.
"""

import re
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class RegexDetector:
    """Regex-based PII detector - fallback logic"""
    
    def __init__(self):
        """Initialize regex patterns"""
        # Enhanced patterns - case insensitive, flexible
        self.label_pattern = re.compile(
            r"^(NAME|STUDENT\s+NAME|SUBMITTED\s+BY|AUTHOR|STUDENT)\s*:?\s*(.*)$",
            re.IGNORECASE
        )
        self.roll_pattern = re.compile(
            r"^(ROLL\s*NO|ROLL\s*NUMBER|ROLL|STUDENT\s*ID|ENROLLMENT\s*NO|ID\s*NO|ENROLLMENT)\s*:?\s*(.*)$",
            re.IGNORECASE
        )
        self.combined_pattern = re.compile(
            r"(?:NAME|STUDENT)\s*:?\s*([a-z\s]{3,50}).*?(?:ROLL|ID|ENROLLMENT)\s*:?\s*(\d{6,15})",
            re.IGNORECASE | re.DOTALL
        )
    
    def detect(self, text: str) -> List[Dict]:
        """
        Detect PII using regex patterns.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of detected entities with:
            - entity_type: Type of PII (PERSON, STUDENT_ROLL_NUMBER)
            - start: Start position
            - end: End position
            - score: Confidence score (0-1)
            - text: The detected text
        """
        if not text or not text.strip():
            return []
        
        detections = []
        
        # Try combined pattern first
        m = self.combined_pattern.search(text)
        if m:
            name = m.group(1).strip()
            roll = m.group(2).strip()
            
            # Add name detection
            name_start = m.start(1)
            name_end = m.end(1)
            detections.append({
                "entity_type": "PERSON",
                "start": name_start,
                "end": name_end,
                "score": 0.8,
                "text": name
            })
            
            # Add roll detection
            roll_start = m.start(2)
            roll_end = m.end(2)
            detections.append({
                "entity_type": "STUDENT_ROLL_NUMBER",
                "start": roll_start,
                "end": roll_end,
                "score": 0.8,
                "text": roll
            })
            
            logger.info(f"Regex detected combined: name='{name}', roll='{roll}'")
            return detections
        
        # Try individual patterns
        # NAME detection - improved to catch all name variations (multiple occurrences)
        name_pattern_primary = re.compile(
            r"(?:NAME|STUDENT\s+NAME|SUBMITTED\s+BY|AUTHOR)\s*[:–-]?\s*([A-Z][A-Za-z\s\.\'\-]+?)(?:\n|$|(?=Roll|ID|Enrollment))",
            re.IGNORECASE | re.MULTILINE
        )
        name_pattern_fallback = re.compile(
            r"(?:NAME|STUDENT\s+NAME)\s*[:–-]?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)",
            re.IGNORECASE
        )

        for m in name_pattern_primary.finditer(text):
            name = m.group(1).strip()
            if len(name) >= 2 and not any(x in name.lower() for x in ['name', 'roll', 'id', 'enrollment']):
                detections.append({
                    "entity_type": "PERSON",
                    "start": m.start(1),
                    "end": m.end(1),
                    "score": 0.85,
                    "text": name
                })
                logger.info(f"Regex detected name: '{name}'")

        # Fallback names
        if not any(d["entity_type"] == "PERSON" for d in detections):
            for m in name_pattern_fallback.finditer(text):
                name = m.group(1).strip()
                if len(name) >= 2 and not any(x in name.lower() for x in ['name', 'roll', 'id', 'enrollment']):
                    detections.append({
                        "entity_type": "PERSON",
                        "start": m.start(1),
                        "end": m.end(1),
                        "score": 0.75,
                        "text": name
                    })
                    logger.info(f"Regex detected name (fallback): '{name}'")
        
        # ROLL NUMBER detection
        roll_pattern = re.compile(
            r"(?:ROLL\s*NO(?:\.|)|ROLL\s*NUMBER|ROLL|STUDENT\s*ID|ENROLLMENT\s*NO|ID\s*NO|REG)\s*[:–-]?\s*(\d{4,20})",
            re.IGNORECASE
        )
        for rm in roll_pattern.finditer(text):
            roll = rm.group(1).strip()
            detections.append({
                "entity_type": "STUDENT_ROLL_NUMBER",
                "start": rm.start(1),
                "end": rm.end(1),
                "score": 0.7,
                "text": roll
            })
            logger.info(f"Regex detected roll: '{roll}'")
        
        # Fallback: Find any 4-20 digit numbers (weak confidence)
        if not any(d["entity_type"] == "STUDENT_ROLL_NUMBER" for d in detections):
            for match in re.finditer(r"\b(\d{8,15})\b", text):
                roll = match.group(1)
                detections.append({
                    "entity_type": "STUDENT_ROLL_NUMBER",
                    "start": match.start(1),
                    "end": match.end(1),
                    "score": 0.4,  # Low confidence
                    "text": roll
                })
                logger.info(f"Regex detected roll (weak): '{roll}'")
        
        return detections


# Singleton instance
_regex_detector_instance = None


def get_regex_detector() -> RegexDetector:
    """Get singleton Regex detector instance"""
    global _regex_detector_instance
    if _regex_detector_instance is None:
        _regex_detector_instance = RegexDetector()
    return _regex_detector_instance
