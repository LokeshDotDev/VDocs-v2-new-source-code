"""
Binoculars AI Detector - Remote VPS Client
Connects to remote GPU VPS running Binoculars model for AI detection.
Does NOT run models locally.
"""

import os
import requests
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class BinocularsDetector:
    """Client for remote Binoculars AI detection service"""
    
    def __init__(self):
        """Initialize Binoculars detector client"""
        self.vps_url = os.getenv("BINOCULARS_VPS_URL", "http://your-gpu-vps-url:8000")
        self.threshold = 0.6
        self.max_chunk_size = 8000
        self.timeout = 120  # 2 minutes timeout for API calls
        
        logger.info(f"Binoculars detector initialized. VPS URL: {self.vps_url}")
    
    def detect(self, text: str) -> Dict:
        """
        Detect if text is AI-generated using remote Binoculars service
        
        Args:
            text: Text to analyze
            
        Returns:
            {
                "score": float,  # Binoculars score (higher = more likely AI)
                "is_ai_generated": boolean  # True if score >= threshold
            }
        """
        if not text or not text.strip():
            logger.warning("Empty text provided to detector")
            return {
                "score": 0.0,
                "is_ai_generated": False
            }
        
        try:
            # Chunk text if too long
            chunks = self._chunk_text(text)
            logger.info(f"Processing {len(chunks)} chunks for AI detection")
            
            # Process each chunk
            scores = []
            for i, chunk in enumerate(chunks):
                chunk_result = self._detect_chunk(chunk)
                scores.append(chunk_result)
                logger.debug(f"Chunk {i+1}/{len(chunks)} score: {chunk_result:.4f}")
            
            # Average score across all chunks
            avg_score = sum(scores) / len(scores) if scores else 0.0
            is_ai = avg_score >= self.threshold
            
            result = {
                "score": round(avg_score, 4),
                "is_ai_generated": is_ai
            }
            
            logger.info(f"Detection result: score={result['score']}, is_ai={is_ai}")
            return result
            
        except Exception as e:
            logger.error(f"Error in Binoculars detection: {str(e)}")
            # On error, assume not AI to avoid blocking pipeline
            return {
                "score": 0.0,
                "is_ai_generated": False,
                "error": str(e)
            }
    
    def _chunk_text(self, text: str) -> list:
        """Split text into chunks of max_chunk_size characters"""
        chunks = []
        words = text.split()
        current_chunk = []
        current_length = 0
        
        for word in words:
            word_length = len(word) + 1  # +1 for space
            if current_length + word_length > self.max_chunk_size and current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = [word]
                current_length = word_length
            else:
                current_chunk.append(word)
                current_length += word_length
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        return chunks if chunks else [text]
    
    def _detect_chunk(self, chunk: str) -> float:
        """
        Send chunk to remote Binoculars VPS for detection
        
        Args:
            chunk: Text chunk to analyze
            
        Returns:
            float: Binoculars score for this chunk
        """
        try:
            # Call remote VPS API
            response = requests.post(
                f"{self.vps_url}/detect",
                json={"text": chunk},
                timeout=self.timeout,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("score", 0.0)
            else:
                logger.error(f"VPS returned status {response.status_code}: {response.text}")
                return 0.0
                
        except requests.Timeout:
            logger.error(f"Timeout calling Binoculars VPS")
            return 0.0
        except requests.ConnectionError:
            logger.error(f"Cannot connect to Binoculars VPS at {self.vps_url}")
            return 0.0
        except Exception as e:
            logger.error(f"Error calling VPS: {str(e)}")
            return 0.0
    
    def health_check(self) -> Dict:
        """Check if remote VPS is available"""
        try:
            response = requests.get(
                f"{self.vps_url}/health",
                timeout=10
            )
            return {
                "status": "healthy" if response.status_code == 200 else "unhealthy",
                "vps_url": self.vps_url
            }
        except:
            return {
                "status": "unhealthy",
                "vps_url": self.vps_url
            }
