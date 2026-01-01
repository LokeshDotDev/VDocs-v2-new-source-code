import os
import sys
import argparse
import tempfile
import zipfile
import shutil
import io
import time
from pathlib import Path

# Add paths to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Add module paths
PYTHON_MANAGER = os.path.join(PROJECT_ROOT, "python-manager")
CONVERTER_MODULE = os.path.join(PYTHON_MANAGER, "modules", "converter-module")
REDUCTOR_MODULE = os.path.join(PROJECT_ROOT, "reductor-module", "reductor-service-v2")
HUMANIZER_MODULE = os.path.join(PYTHON_MANAGER, "modules", "humanizer")
SPELL_CHECKER_MODULE = os.path.join(PYTHON_MANAGER, "modules", "spell-grammar-checker")

# Strategy: Import each module's dependencies in isolation
try:
    # === CONVERTER MODULE ===
    sys.path.insert(0, CONVERTER_MODULE)
    from utils.minio_handler import minio_handler
    from services.pdf_converter import PDFConverter
    sys.path.pop(0)
    
    # Clear utils from cache to allow other utils packages
    if 'utils' in sys.modules:
        del sys.modules['utils']
    
    # === HUMANIZER MODULE ===  
    sys.path.insert(0, HUMANIZER_MODULE)
    import docx_humanize_lxml
    sys.path.pop(0)
    
    # Clear utils again
    if 'utils' in sys.modules:
        del sys.modules['utils']
    
    # === SPELL/GRAMMAR CHECKER ===
    sys.path.insert(0, SPELL_CHECKER_MODULE)
    import spell_grammar_checker
    sys.path.pop(0)
    
    # === REDUCTOR MODULE ===
    sys.path.insert(0, REDUCTOR_MODULE)
    
    # Import logger module
    import logger as reductor_logger_module
    
    # Now import reductor utils
    import utils.docx_anonymizer as docx_anon_module
    import utils.identity_detector as identity_det_module
    
    # Extract functions
    anonymize_docx = docx_anon_module.anonymize_docx
    unzip_docx = docx_anon_module.unzip_docx
    load_xml = docx_anon_module.load_xml
    detect_identity = identity_det_module.detect_identity
    
    sys.path.pop(0)
    
except Exception as e:
    print(f"Error importing modules: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

def process_job(job_id):
    print(f"Processing job: {job_id}")
    
    # 1. Setup paths
    raw_prefix = f"jobs/{job_id}/raw/"
    
    # 2. List files
    try:
        objects = minio_handler.client.list_objects(minio_handler.bucket, prefix=raw_prefix, recursive=True)
        files = [obj.object_name for obj in objects]
    except Exception as e:
        print(f"Failed to list objects: {e}")
        return False

    if not files:
        print("No files found.")
        return False

    print(f"Found {len(files)} files.")
    
    # Create temp dir for processing
    with tempfile.TemporaryDirectory() as temp_dir:
        output_files = []
        
        for file_key in files:
            print(f"Processing {file_key}...")
            filename = os.path.basename(file_key)
            local_path = os.path.join(temp_dir, filename)
            
            # Download
            try:
                data = minio_handler.download_file(file_key)
                with open(local_path, "wb") as f:
                    f.write(data.getbuffer())
            except Exception as e:
                print(f"Failed to download {file_key}: {e}")
                continue
            

            # Convert if PDF
            docx_path = local_path
            def is_valid_docx(path):
                import zipfile
                try:
                    with zipfile.ZipFile(path, 'r') as zf:
                        return zf.testzip() is None
                except zipfile.BadZipFile:
                    return False

            if filename.lower().endswith(".pdf"):
                print("Converting PDF to DOCX...")
                try:
                    with open(local_path, "rb") as f:
                        pdf_bytes = io.BytesIO(f.read())
                    docx_bytes = PDFConverter.convert_pdf_to_docx(pdf_bytes)
                    docx_filename = os.path.splitext(filename)[0] + ".docx"
                    docx_path = os.path.join(temp_dir, docx_filename)
                    with open(docx_path, "wb") as f:
                        f.write(docx_bytes.getbuffer())
                    # Validate converted DOCX
                    if not is_valid_docx(docx_path):
                        print(f"[ERROR] PDF-to-DOCX conversion produced a corrupted DOCX: {docx_path}")
                        continue
                except Exception as e:
                    print(f"Conversion failed: {e}")
                    continue
            elif not filename.lower().endswith(".docx"):
                print(f"Skipping non-docx/pdf file: {filename}")
                continue
            else:
                # Validate original DOCX
                if not is_valid_docx(docx_path):
                    print(f"[ERROR] Input DOCX is corrupted: {docx_path}")
                    continue


            # Reduct
            print("Redacting...")
            
            # Detect identity first
            try:
                temp_unzip = unzip_docx(docx_path)
                document_xml = os.path.join(temp_unzip, "word/document.xml")
                tree = load_xml(document_xml)
                identity = detect_identity(tree)
                shutil.rmtree(temp_unzip)
                print(f"Detected identity: name={identity.get('name')}, roll_no={identity.get('roll_no')}")
            except Exception as e:
                print(f"Failed to detect identity: {e}")
                identity = {"name": None, "roll_no": None}
            
            redacted_path = os.path.join(temp_dir, "redacted_" + os.path.basename(docx_path))
            try:
                anonymize_docx(
                    docx_path, 
                    redacted_path,
                    name=identity.get("name"),
                    roll_no=identity.get("roll_no")
                )
                # Validate redacted DOCX
                if not is_valid_docx(redacted_path):
                    print(f"[ERROR] Redactor produced a corrupted DOCX: {redacted_path}")
                    continue
            except Exception as e:
                print(f"Redaction failed: {e}")
                continue


            # Humanize
            print("Humanizing...")
            humanized_path = os.path.join(temp_dir, "humanized_" + os.path.basename(docx_path))
            try:
                docx_humanize_lxml.process_docx(redacted_path, humanized_path, skip_detect=True)
                # Validate humanized DOCX
                if not is_valid_docx(humanized_path):
                    print(f"[ERROR] Humanizer produced a corrupted DOCX: {humanized_path}")
                    continue
            except Exception as e:
                print(f"Humanization failed: {e}")
                # Fallback to redacted if humanization fails
            # Fix Spelling & Grammar (NEW STEP)
            print("Fixing spelling and grammar...")
            final_path = os.path.join(temp_dir, "final_" + os.path.basename(docx_path))
            try:
                stats = spell_grammar_checker.process_docx(humanized_path, final_path)
                print(f"  Fixed {stats['total_changes']} spelling/grammar errors")
                # Validate fixed DOCX
                if not is_valid_docx(final_path):
                    print(f"[ERROR] Spell checker produced a corrupted DOCX: {final_path}")
                    # Fallback to humanized version
                    shutil.copy(humanized_path, final_path)
            except Exception as e:
                print(f"Spell/grammar check failed: {e}")
                # Fallback to humanized if spell check fails
                shutil.copy(humanized_path, final_path)
            
            output_files.append(final_path)
        
        # Zip Results
        zip_path = os.path.join(temp_dir, "result.zip")
        print("Zipping results...")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for file in output_files:
                # Remove prefixes (final_, humanized_, redacted_) to get clean names
                basename = os.path.basename(file)
                for prefix in ["final_", "humanized_", "redacted_"]:
                    if basename.startswith(prefix):
                        basename = basename[len(prefix):]
                        break
                zipf.write(file, basename)
        
        # Upload Zip
        zip_key = f"jobs/{job_id}/result.zip"
        print(f"Uploading zip to {zip_key}...")
        try:
            with open(zip_path, "rb") as f:
                minio_handler.upload_file(zip_key, io.BytesIO(f.read()), "application/zip")
        except Exception as e:
            print(f"Failed to upload zip: {e}")
            return False

        print("Done!")
        return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    args = parser.parse_args()
    
    success = process_job(args.job_id)
    sys.exit(0 if success else 1)
