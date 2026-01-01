import os
import io
import zipfile
from minio import Minio
from minio.error import S3Error

# CONFIGURE THESE
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "wedocs")
JOBS_PREFIX = os.environ.get("JOBS_PREFIX", "jobs/")  # or set to a specific job: jobs/<jobid>/

# Connect to MinIO
client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False
)

def is_valid_docx(data: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(data), 'r') as zf:
            test = zf.testzip()
            return test is None
    except zipfile.BadZipFile:
        return False

def is_valid_zip(data: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(data), 'r') as zf:
            test = zf.testzip()
            return test is None
    except zipfile.BadZipFile:
        return False

def cleanup_minio():
    print(f"Scanning for corrupted files in bucket '{MINIO_BUCKET}' under prefix '{JOBS_PREFIX}'...")
    objects = client.list_objects(MINIO_BUCKET, prefix=JOBS_PREFIX, recursive=True)
    deleted = 0
    checked = 0
    for obj in objects:
        checked += 1
        if obj.size == 0:
            print(f"Deleting zero-byte file: {obj.object_name}")
            client.remove_object(MINIO_BUCKET, obj.object_name)
            deleted += 1
            continue
        if obj.object_name.lower().endswith('.docx'):
            data = client.get_object(MINIO_BUCKET, obj.object_name).read()
            if not is_valid_docx(data):
                print(f"Deleting corrupted DOCX: {obj.object_name}")
                client.remove_object(MINIO_BUCKET, obj.object_name)
                deleted += 1
        elif obj.object_name.lower().endswith('.zip'):
            data = client.get_object(MINIO_BUCKET, obj.object_name).read()
            if not is_valid_zip(data):
                print(f"Deleting corrupted ZIP: {obj.object_name}")
                client.remove_object(MINIO_BUCKET, obj.object_name)
                deleted += 1
    print(f"Checked {checked} files. Deleted {deleted} corrupted/empty files.")

if __name__ == "__main__":
    cleanup_minio()
