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
sys.path.append(PROJECT_ROOT)

# Add module paths
PYTHON_MANAGER = os.path.join(PROJECT_ROOT, "python-manager")
CONVERTER_MODULE = os.path.join(PYTHON_MANAGER, "modules", "converter-module")
REDUCTOR_MODULE = os.path.join(PROJECT_ROOT, "reductor-module", "doc-anonymizer-mvp")
HUMANIZER_MODULE = os.path.join(PYTHON_MANAGER, "modules", "humanizer")

sys.path.append(CONVERTER_MODULE)
sys.path.append(REDUCTOR_MODULE)
sys.path.append(HUMANIZER_MODULE)

# Imports
try:
    # Converter imports
    # CONVERTER_MODULE is in path, so we import directly from its subpackages
    from utils.minio_handler import minio_handler
    from services.pdf_converter import PDFConverter
    
    # Reductor imports
    # REDUCTOR_MODULE is in path, so we import 'backend'
    from backend.batch.processor import process_docx as reduct_docx
    
    # Humanizer imports
    # HUMANIZER_MODULE is in path
    import docx_humanize_lxml
except ImportError as e:
    print(f"Error importing modules: {e}")
    # Fallback for paths if direct import fails (e.g. structure differences)
    # We will handle this dynamically if needed
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
            redacted_path = os.path.join(temp_dir, "redacted_" + os.path.basename(docx_path))
            try:
                reduct_docx(docx_path, redacted_path)
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
                shutil.copy(redacted_path, humanized_path)
                # Validate fallback
                if not is_valid_docx(humanized_path):
                    print(f"[ERROR] Fallback redacted DOCX is also corrupted: {humanized_path}")
                    continue

            output_files.append(humanized_path)
        
        if not output_files:
            print("No files processed successfully.")
            return False
            
        # Zip results
        zip_filename = f"job_{job_id}_result.zip"
        zip_path = os.path.join(temp_dir, zip_filename)
        print("Zipping results...")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for file in output_files:
                arcname = os.path.basename(file).replace("humanized_", "")
                zipf.write(file, arcname)
        
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
