#!/usr/bin/env python3
"""
Extract and examine document.xml to find how PII is actually stored
"""

import sys
import os
import zipfile
import tempfile

def examine_docx(docx_path: str):
    """Extract and display relevant XML content"""
    
    if not os.path.exists(docx_path):
        print(f"❌ File not found: {docx_path}")
        return
    
    print(f"📄 Extracting: {docx_path}\n")
    
    temp_dir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(docx_path, 'r') as z:
            z.extractall(temp_dir)
        
        document_xml_path = os.path.join(temp_dir, "word/document.xml")
        
        with open(document_xml_path, "rb") as f:
            content = f.read()
        
        # Decode to string for search
        text = content.decode("utf-8", errors="ignore")
        
        # Look for known PII
        search_terms = ["SHIVSHANKAR", "DINKAR", "MAPARI", "2414500428", "LEARNER", "ROLL"]
        
        print("🔍 Searching for key terms in document.xml:\n")
        
        for term in search_terms:
            if term.lower() in text.lower():
                # Find context around the term
                idx = text.lower().find(term.lower())
                if idx >= 0:
                    start = max(0, idx - 150)
                    end = min(len(text), idx + 150)
                    context = text[start:end]
                    print(f"✓ Found '{term}':")
                    print(f"  Context: ...{context}...\n")
            else:
                print(f"✗ Not found: '{term}'\n")
        
        # Show raw bytes around known PII
        print("\n" + "="*60)
        print("📊 RAW BYTE ANALYSIS:")
        print("="*60 + "\n")
        
        # Look for "SHIVSHANKAR" in bytes
        search_bytes = "SHIVSHANKAR".encode("utf-8")
        idx = content.find(search_bytes)
        
        if idx >= 0:
            print(f"Found 'SHIVSHANKAR' at byte offset {idx}:\n")
            start = max(0, idx - 100)
            end = min(len(content), idx + 200)
            chunk = content[start:end]
            
            print("Hex dump:")
            print(chunk.hex())
            print("\nDecoded (with errors='ignore'):")
            print(chunk.decode("utf-8", errors="ignore"))
        else:
            print("'SHIVSHANKAR' not found in bytes!\n")
            print("This means the text is either:")
            print("  1. Split across multiple text nodes")
            print("  2. Encoded differently")
            print("  3. Hidden in another document file (headers, footers, styles)\n")
            
            # Look for partial matches
            print("Looking for partial matches...")
            for term in ["SHIV", "DINKAR", "MAPARI", "2414"]:
                if term.encode("utf-8") in content:
                    print(f"  ✓ Found '{term}'")
                else:
                    print(f"  ✗ Not found '{term}'")
    
    finally:
        import shutil
        shutil.rmtree(temp_dir)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 examine-docx-content.py <path_to_docx>")
        sys.exit(1)
    
    examine_docx(sys.argv[1])
