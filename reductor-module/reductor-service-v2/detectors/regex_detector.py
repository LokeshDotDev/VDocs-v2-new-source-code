"""
Regex-based PII Detector - SECONDARY/Fallback detection engine
Contains regex-based detection logic for both TABLE and NON-TABLE formats.
Works for:
- Table cells: LEARNER NAME | VALUE
- Inline format: LEARNER NAME: VALUE
- Flexible spacing and variations
"""

import re
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class RegexDetector:
    """Regex-based PII detector - handles both table and non-table formats"""
    
    def __init__(self):
        """Initialize regex patterns for comprehensive coverage"""
        
        # Strict line-based label patterns; require label on the same line.
        self.name_line_pattern = re.compile(
            r"(?:LEARNER\s+NAME|STUDENT\s+NAME|NAME)\s*[:\-\|=]?\s*([A-Z][A-Za-z\s\.'\-]{2,100})",
            re.IGNORECASE,
        )

        self.roll_line_pattern = re.compile(
            r"(?:LEARNER\s+ROLL|ROLL\s+(?:NUMBER|NO\.?|NUM\.?|#)|ENROLLMENT\s+(?:NO|NUMBER)|ID\s*(?:NO|NUMBER)?)\s*[:\-\|=]?\s*(\d{4,20})",
            re.IGNORECASE,
        )
    
    def detect(self, text: str) -> List[Dict]:
        """
        Detect PII using comprehensive regex patterns for BOTH table and non-table formats.
        
        Args:
            text: Text to analyze (can be from table or inline format)
            
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
        
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue

            m_name = self.name_line_pattern.search(stripped)
            if m_name:
                name = m_name.group(1).strip()
                detections.append({
                    "entity_type": "PERSON",
                    "start": m_name.start(1),
                    "end": m_name.end(1),
                    "score": 0.85,
                    "text": name,
                })

            m_roll = self.roll_line_pattern.search(stripped)
            if m_roll:
                roll = m_roll.group(1).strip()
                detections.append({
                    "entity_type": "STUDENT_ROLL_NUMBER",
                    "start": m_roll.start(1),
                    "end": m_roll.end(1),
                    "score": 0.85,
                    "text": roll,
                })

        return detections


# Singleton instance
_regex_detector_instance = None


def get_regex_detector() -> RegexDetector:
    """Get singleton Regex detector instance"""
    global _regex_detector_instance
    if _regex_detector_instance is None:
        _regex_detector_instance = RegexDetector()
    return _regex_detector_instance
