#!/usr/bin/env python3
"""
Test the reductor directly to see what's being detected and removed
"""

import sys
import os

# Add paths
sys.path.insert(0, '/Users/vivekvyas/Desktop/Vdocs/source code/reductor-module/reductor-service-v2')

from utils.identity_detector import detect_identity
from utils.docx_anonymizer import anonymize_docx
from lxml import etree
import tempfile
import shutil

# Test file - use the one you're trying to redact
TEST_DOCX = "/Users/vivekvyas/Desktop/Vdocs/source code/reductor-module/reductor-service-v2/test_assignment.docx"

# Create a temp copy for testing
temp_output = tempfile.mktemp(suffix=".docx")

print("=" * 80)
print("REDUCTOR DIAGNOSTIC TEST")
print("=" * 80)

if not os.path.exists(TEST_DOCX):
    print(f"\n❌ Test file not found: {TEST_DOCX}")
    print("\nPlease provide the path to your MBA assignment document")
    sys.exit(1)

print(f"\n📄 Test file: {TEST_DOCX}")
print(f"   File exists: ✅")
print(f"   File size: {os.path.getsize(TEST_DOCX)} bytes")

try:
    # Step 1: Load the document and detect identity
    print("\n" + "=" * 80)
    print("STEP 1: DETECTION")
    print("=" * 80)
    
    parser = etree.XMLParser(remove_blank_text=False, strip_cdata=False, remove_comments=False)
    
    import zipfile
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(TEST_DOCX, 'r') as z:
        z.extractall(temp_dir)
    
    document_xml = os.path.join(temp_dir, "word/document.xml")
    tree = etree.parse(document_xml, parser)
    
    print("\n🔍 Detecting identity from document...")
    identity = detect_identity(tree)
    
    print(f"\nDetected Identity:")
    print(f"  Name: {identity.get('name')}")
    print(f"  Roll: {identity.get('roll_no')}")
    print(f"  Confidence: {identity.get('confidence')}")
    print(f"  Number of detections: {len(identity.get('detections', []))}")
    
    # Show all detections
    if identity.get('detections'):
        print(f"\n  All detections:")
        for det in identity.get('detections'):
            print(f"    - {det['entity_type']}: '{det['text']}' (score: {det['score']})")
    
    # Step 2: Test the removal
    print("\n" + "=" * 80)
    print("STEP 2: REMOVAL TEST")
    print("=" * 80)
    
    # Copy to temp for testing
    shutil.copy(TEST_DOCX, temp_output)
    print(f"\n✂️  Testing removal on: {temp_output}")
    
    name = identity.get('name')
    roll = identity.get('roll_no')
    
    if name:
        print(f"\n  Removing name: '{name}'")
        result = anonymize_docx(temp_output, temp_output, name=name, roll_no=None)
        print(f"  Result: {result}")
    
    if roll:
        print(f"\n  Removing roll: '{roll}'")
        result = anonymize_docx(temp_output, temp_output, name=None, roll_no=roll)
        print(f"  Result: {result}")
    
    # Step 3: Verify removal
    print("\n" + "=" * 80)
    print("STEP 3: VERIFICATION")
    print("=" * 80)
    
    # Check if the values are still in the output file
    with zipfile.ZipFile(temp_output, 'r') as z:
        with z.open('word/document.xml') as f:
            output_xml = f.read().decode('utf-8')
    
    print("\n🔍 Checking if values still exist in output...")
    
    if name:
        if name in output_xml:
            print(f"  ❌ Name STILL PRESENT: '{name}'")
        else:
            print(f"  ✅ Name REMOVED: '{name}'")
    
    if roll:
        if roll in output_xml:
            print(f"  ❌ Roll STILL PRESENT: '{roll}'")
        else:
            print(f"  ✅ Roll REMOVED: '{roll}'")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
    print(f"\nOutput file: {temp_output}")
    print("(Keep this for comparison)")
    
    # Cleanup
    shutil.rmtree(temp_dir)

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
