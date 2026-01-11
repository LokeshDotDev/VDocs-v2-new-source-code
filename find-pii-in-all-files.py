#!/usr/bin/env python3
"""
Search ALL files in DOCX to find where PII is actually stored
"""

import sys
import os
import zipfile
import tempfile

def find_pii_in_docx(docx_path: str):
    """Search all files in DOCX for PII"""
    
    if not os.path.exists(docx_path):
        print(f"❌ File not found: {docx_path}")
        return
    
    print(f"📄 Scanning all files in DOCX: {docx_path}\n")
    
    temp_dir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(docx_path, 'r') as z:
            z.extractall(temp_dir)
        
        search_term = b"SHIVSHANKAR"
        
        print(f"🔍 Searching for {search_term.decode()}...\n")
        
        found_files = []
        
        # Scan all files in the DOCX
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                filepath = os.path.join(root, file)
                relpath = os.path.relpath(filepath, temp_dir)
                
                try:
                    with open(filepath, "rb") as f:
                        content = f.read()
                    
                    if search_term in content:
                        found_files.append(relpath)
                        print(f"✓ Found in: {relpath}")
                        
                        # Show context
                        idx = content.find(search_term)
                        start = max(0, idx - 100)
                        end = min(len(content), idx + 200)
                        context = content[start:end].decode("utf-8", errors="ignore")
                        print(f"  Context: ...{context}...\n")
                except:
                    pass
        
        if not found_files:
            print(f"❌ '{search_term.decode()}' NOT FOUND in any file!\n")
            print("Checking for roll number...")
            search_term = b"2414500428"
            
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    filepath = os.path.join(root, file)
                    relpath = os.path.relpath(filepath, temp_dir)
                    
                    try:
                        with open(filepath, "rb") as f:
                            content = f.read()
                        
                        if search_term in content:
                            found_files.append(relpath)
                            print(f"✓ Found in: {relpath}")
                    except:
                        pass
            
            if not found_files:
                print(f"❌ Roll number also NOT FOUND!\n")
                print("📋 List of all files in DOCX:")
                for root, dirs, files in os.walk(temp_dir):
                    for file in sorted(files):
                        filepath = os.path.join(root, file)
                        relpath = os.path.relpath(filepath, temp_dir)
                        size = os.path.getsize(filepath)
                        print(f"  {relpath} ({size} bytes)")
    
    finally:
        import shutil
        shutil.rmtree(temp_dir)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 find-pii-in-all-files.py <path_to_docx>")
        sys.exit(1)
    
    find_pii_in_docx(sys.argv[1])
