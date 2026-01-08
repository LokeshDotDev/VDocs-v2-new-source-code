"""
Presidio PII Detector - PRIMARY detection engine
Uses Microsoft Presidio for intelligent PII detection.
"""

import logging
from typing import List, Dict
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry, Pattern, PatternRecognizer
from presidio_analyzer.nlp_engine import NlpEngineProvider

logger = logging.getLogger(__name__)


class PresidioDetector:
    """Microsoft Presidio-based PII detector"""
    
    _instance = None
    _analyzer = None
    
    def __new__(cls):
        """Singleton pattern - initialize once"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize Presidio analyzer engine ONCE"""
        try:
            logger.info("Initializing Presidio analyzer...")
            
            # Create NLP engine with spaCy
            nlp_configuration = {
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
            }
            provider = NlpEngineProvider(nlp_configuration=nlp_configuration)
            nlp_engine = provider.create_engine()
            
            # Create custom registry
            registry = RecognizerRegistry()
            registry.load_predefined_recognizers(nlp_engine=nlp_engine)
            
            # Add custom STUDENT_ROLL_NUMBER recognizer
            student_roll_recognizer = self._create_student_roll_recognizer()
            registry.add_recognizer(student_roll_recognizer)
            
            # Create analyzer
            self._analyzer = AnalyzerEngine(
                registry=registry,
                nlp_engine=nlp_engine
            )
            
            logger.info("✅ Presidio analyzer initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Presidio: {e}")
            raise
    
    def _create_student_roll_recognizer(self) -> PatternRecognizer:
        """
        Create custom recognizer for student roll numbers.
        Detects 8-15 digit numbers with academic context.
        """
        # Regex pattern for roll numbers (8-15 digits)
        roll_number_pattern = Pattern(
            name="roll_number_pattern",
            regex=r"\b\d{8,15}\b",
            score=0.5  # Medium confidence from pattern alone
        )
        
        # Context keywords that boost confidence
        context_keywords = [
            "roll no", "roll number", "enrollment", "student id",
            "registration", "uid", "roll", "student number",
            "enrolment", "id no", "id number"
        ]
        
        student_roll_recognizer = PatternRecognizer(
            supported_entity="STUDENT_ROLL_NUMBER",
            name="student_roll_recognizer",
            patterns=[roll_number_pattern],
            context=context_keywords,
            supported_language="en"
        )
        
        return student_roll_recognizer
    
    def detect(self, text: str) -> List[Dict]:
        """
        Detect PII entities in text using Presidio.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of detected entities with:
            - entity_type: Type of PII (PERSON, STUDENT_ROLL_NUMBER, etc.)
            - start: Start position
            - end: End position
            - score: Confidence score (0-1)
            - text: The detected text
        """
        if not text or not text.strip():
            return []
        
        try:
            # Analyze text for PII
            results = self._analyzer.analyze(
                text=text,
                language="en",
                entities=["PERSON", "STUDENT_ROLL_NUMBER"]
            )
            
            # Convert to dict format
            detections = []
            for result in results:
                detections.append({
                    "entity_type": result.entity_type,
                    "start": result.start,
                    "end": result.end,
                    "score": result.score,
                    "text": text[result.start:result.end]
                })
            
            logger.info(f"Presidio detected {len(detections)} entities")
            for det in detections:
                logger.debug(f"  - {det['entity_type']}: '{det['text']}' (score={det['score']:.2f})")
            
            return detections
            
        except Exception as e:
            logger.error(f"Presidio detection error: {e}")
            return []


# Singleton instance
_presidio_detector_instance = None


def get_presidio_detector() -> PresidioDetector:
    """Get singleton Presidio detector instance"""
    global _presidio_detector_instance
    if _presidio_detector_instance is None:
        _presidio_detector_instance = PresidioDetector()
    return _presidio_detector_instance
