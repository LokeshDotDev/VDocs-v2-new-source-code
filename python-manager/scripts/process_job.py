import os
import sys
import argparse
import tempfile
import zipfile
import shutil
import io
import time
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
from uuid import uuid4

# Add paths to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Add module paths
PYTHON_MANAGER = os.path.join(PROJECT_ROOT, "python-manager")
CONVERTER_MODULE = os.path.join(PYTHON_MANAGER, "modules", "converter_module")
REDUCTOR_MODULE = os.path.join(PROJECT_ROOT, "reductor-module", "reductor-service-v2")
HUMANIZER_MODULE = "/app/modules/humanizer"
SPELL_CHECKER_MODULE = "/app/modules/spell-grammar-checker"
FORMATTER_MODULE = os.path.join(PYTHON_MANAGER, "modules", "document-formatter")

# Strategy: Import each module's dependencies in isolation
try:
    # === CONVERTER MODULE ===
    sys.path.insert(0, PROJECT_ROOT)
    from modules.converter_module.utils.minio_handler import minio_handler
    from modules.converter_module.services.pdf_converter import PDFConverter
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
    
    # === DOCUMENT FORMATTER === (DISABLED - preserves original formatting)
    # sys.path.insert(0, FORMATTER_MODULE)
    # import formatter
    # sys.path.pop(0)
    
    # === REDUCTOR MODULE ===
    sys.path.insert(0, REDUCTOR_MODULE)

    # Import logger module
    import logger as reductor_logger_module

    # Add utils path for reductor utils
    UTILS_MODULE = os.path.join(REDUCTOR_MODULE, "utils")
    import importlib.util

    def import_module_from_path(module_name, module_path):
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    docx_anonymizer_path = os.path.join(UTILS_MODULE, "docx_anonymizer.py")
    identity_detector_path = os.path.join(UTILS_MODULE, "identity_detector.py")
    docx_anon_module = import_module_from_path("docx_anonymizer", docx_anonymizer_path)
    identity_det_module = import_module_from_path("identity_detector", identity_detector_path)

    # Extract functions
    anonymize_docx = docx_anon_module.anonymize_docx
    unzip_docx = docx_anon_module.unzip_docx
    load_xml = docx_anon_module.load_xml
    detect_identity = identity_det_module.detect_identity

    # Extract functions
    anonymize_docx = docx_anon_module.anonymize_docx
    unzip_docx = docx_anon_module.unzip_docx
    load_xml = docx_anon_module.load_xml
    detect_identity = identity_det_module.detect_identity

    sys.path.pop(0)  # Remove utils path
    sys.path.pop(0)  # Remove reductor module path
    
except Exception as e:
    print(f"Error importing modules: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

def is_valid_docx(path: str) -> bool:
    import zipfile
    try:
        with zipfile.ZipFile(path, "r") as zf:
            return zf.testzip() is None
    except zipfile.BadZipFile:
        return False


def process_single_file(args):
    """Process one file (convert/redact/humanize/format) and return output path + key."""
    file_key, job_id, temp_dir = args
    started = time.perf_counter()
    worker_dir = tempfile.mkdtemp(dir=temp_dir, prefix="work_")
    try:
        filename = os.path.basename(file_key)
        local_path = os.path.join(worker_dir, filename)

        # Download
        data = minio_handler.download_file(file_key)
        with open(local_path, "wb") as f:
            f.write(data.getbuffer())

        docx_path = local_path

        if filename.lower().endswith(".pdf"):
            print("Converting PDF to DOCX...")
            with open(local_path, "rb") as f:
                pdf_bytes = io.BytesIO(f.read())
            docx_bytes = PDFConverter.convert_pdf_to_docx(pdf_bytes)
            docx_filename = os.path.splitext(filename)[0] + ".docx"
            docx_path = os.path.join(worker_dir, docx_filename)
            with open(docx_path, "wb") as f:
                f.write(docx_bytes.getbuffer())
            if not is_valid_docx(docx_path):
                print(f"[ERROR] PDF-to-DOCX conversion produced a corrupted DOCX: {docx_path}")
                return None
        elif not filename.lower().endswith(".docx"):
            print(f"Skipping non-docx/pdf file: {filename}")
            return None
        else:
            if not is_valid_docx(docx_path):
                print(f"[ERROR] Input DOCX is corrupted: {docx_path}")
                return None

        # Redact
        print("Redacting...")
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

        redacted_path = os.path.join(worker_dir, "redacted_" + os.path.basename(docx_path))
        anonymize_docx(
            docx_path,
            redacted_path,
            name=identity.get("name"),
            roll_no=identity.get("roll_no"),
        )
        if not is_valid_docx(redacted_path):
            print(f"[ERROR] Redactor produced a corrupted DOCX: {redacted_path}")
            return None

        # Humanize
        print("Humanizing...")
        humanized_path = os.path.join(worker_dir, "humanized_" + os.path.basename(docx_path))
        try:
            docx_humanize_lxml.process_docx(redacted_path, humanized_path, skip_detect=True)
            if not is_valid_docx(humanized_path):
                print(f"[ERROR] Humanizer produced a corrupted DOCX: {humanized_path}")
                shutil.copy(redacted_path, humanized_path)
        except Exception as e:
            print(f"Humanizer failed: {e}")
            shutil.copy(redacted_path, humanized_path)

        # Spell / Grammar
        print("Fixing spelling and grammar...")
        final_path = os.path.join(worker_dir, "final_" + os.path.basename(docx_path))
        try:
            stats = spell_grammar_checker.process_docx(humanized_path, final_path)
            print(f"  Fixed {stats['total_changes']} spelling/grammar errors")
            if not is_valid_docx(final_path):
                print(f"[ERROR] Spell checker produced a corrupted DOCX: {final_path}")
                shutil.copy(humanized_path, final_path)
        except Exception as e:
            print(f"Spell/grammar check failed: {e}")
            shutil.copy(humanized_path, final_path)

        # Formatting (DISABLED - preserves original formatting)
        # print("Applying standard formatting...")
        formatted_path = final_path  # Skip formatting, use spell-checked file directly
        # try:
        #     format_stats = formatter.format_docx_via_onlyoffice(final_path, formatted_path)
        #     print(f"  Formatting status: {format_stats['status']}")
        #     print(f"  Processing time: {format_stats['processing_time_ms']}ms")
        #     if not is_valid_docx(formatted_path):
        #         print(f"[ERROR] Formatter produced a corrupted DOCX: {formatted_path}")
        #         shutil.copy(final_path, formatted_path)
        # except Exception as e:
        #     print(f"Formatting failed: {e}")
        #     shutil.copy(final_path, formatted_path)

        elapsed = time.perf_counter() - started
        print(f"[TIMER] {filename} done in {elapsed:.2f}s")
        return formatted_path, file_key
    except Exception as e:
        print(f"[ERROR] Worker failed for {file_key}: {e}")
        return None
    finally:
        # Do not cleanup worker_dir here; caller zips from formatted path inside worker_dir
        pass


def process_job(job_id):
    print(f"Processing job: {job_id}")

    raw_prefix = f"jobs/{job_id}/raw/"

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

    env_workers = os.getenv("ONECLICK_MAX_WORKERS")
    if env_workers:
        try:
            max_workers = max(1, int(env_workers))
        except ValueError:
            max_workers = max(1, os.cpu_count() - 1)
    else:
        # Default: modest cap to reduce thrash on 16 GB machines
        max_workers = min(4, max(1, os.cpu_count() - 1))
    print(f"Using up to {max_workers} parallel workers")

    with tempfile.TemporaryDirectory() as temp_dir:
        output_files = []

        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            future_map = {executor.submit(process_single_file, (file_key, job_id, temp_dir)): file_key for file_key in files}

            completed = 0
            for future in as_completed(future_map):
                file_key = future_map[future]
                completed += 1
                try:
                    result = future.result()
                    if result:
                        output_files.append(result)
                        print(f"[Progress] {completed}/{len(files)} finished")
                    else:
                        print(f"[Progress] {completed}/{len(files)} skipped or failed")
                except Exception as e:
                    print(f"[ERROR] Future failed for {file_key}: {e}")

        if not output_files:
            print("No files succeeded; aborting zip upload.")
            return False

        zip_path = os.path.join(temp_dir, "result.zip")
        print("Zipping results with folder structure...")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for file_path, original_key in output_files:
                relative_path = original_key.replace(f"jobs/{job_id}/raw/", "")
                path_parts = relative_path.split('/')
                if len(path_parts) > 1:
                    relative_path = '/'.join(path_parts[1:])
                else:
                    relative_path = path_parts[0]

                filename = os.path.basename(relative_path)
                folder = os.path.dirname(relative_path)

                for prefix in ["formatted_", "final_", "humanized_", "redacted_"]:
                    if filename.startswith(prefix):
                        filename = filename[len(prefix):]
                        break

                if filename.lower().endswith('.pdf'):
                    filename = filename[:-4] + '.docx'

                zip_file_path = os.path.join(folder, filename) if folder else filename

                print(f"  Adding: {zip_file_path}")
                zipf.write(file_path, zip_file_path)

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
