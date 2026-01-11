#!/usr/bin/env python3
"""
DIRECT REMOVAL TEST
Test if removal function works on an actual DOCX file
Skips all detection logic, just tries removing a known value
"""

import sys
import os
import shutil
import logging

# Add paths
sys.path.insert(0, '/Users/vivekvyas/Desktop/Vdocs/source code/reductor-module/reductor-service-v2')

from utils.docx_anonymizer import _remove_value_aggressive

# Simple logger
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("removal_test")

def test_removal(docx_path: str):
    """Test direct removal on a DOCX file"""
    
    if not os.path.exists(docx_path):
        logger.error(f"❌ File not found: {docx_path}")
        return False
    
    logger.info(f"📄 Testing direct removal on: {docx_path}")
    
    # Create a backup
    backup = docx_path + ".backup"
    shutil.copy(docx_path, backup)
    logger.info(f"✅ Backup created: {backup}")
    
    try:
        # Test 1: Direct byte removal using the new anonymize_docx method
        logger.info("\n🔬 TEST 1: Direct anonymize_docx with known values")
        
        # These are the values we know exist in the document
        test_values = [
            "SHIVSHANKAR DINKAR MAPARI",
            "2414500428",
            "Shivshankar",
            "MAPARI"
        ]
        
        for value in test_values:
            logger.info(f"  Attempting to remove: '{value}'")
            removed_count = _remove_value_aggressive(docx_path, value)
            logger.info(f"    Result: {removed_count} occurrences processed")
        
        logger.info("\n✅ Removal completed. Check the file to see if PII is gone.")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error during removal: {e}")
        logger.error(f"   Restoring from backup...")
        shutil.copy(backup, docx_path)
        return False
    finally:
        # Optional: remove backup if successful
        if os.path.exists(backup):
            logger.info(f"📝 Backup still at: {backup}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        logger.error("Usage: python3 test-removal-directly.py <path_to_docx>")
        sys.exit(1)
    
    docx_file = sys.argv[1]
    success = test_removal(docx_file)
    sys.exit(0 if success else 1)
