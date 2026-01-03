#!/usr/bin/env python3
"""
End-to-end test for one-click pipeline
Tests: Upload → MinIO → Process → Download ZIP
"""

import requests
import json
import time
import sys
from pathlib import Path

BASE_URL = "http://localhost:3001"
TEST_FILE = "test-document.pdf"

def create_test_pdf():
    """Create a simple test PDF"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        c = canvas.Canvas(TEST_FILE, pagesize=letter)
        c.drawString(100, 750, "Test Document for One-Click Pipeline")
        c.drawString(100, 700, "This is a test PDF file.")
        c.drawString(100, 650, "Student Name: John Doe")
        c.drawString(100, 600, "Roll Number: 12345")
        c.save()
        print(f"✅ Created test PDF: {TEST_FILE}")
        return True
    except ImportError:
        print("⚠️  reportlab not installed, using existing file if available")
        return Path(TEST_FILE).exists()

def test_upload_init():
    """Test upload initialization"""
    print("\n🧪 Test 1: Initialize Upload")
    print("-" * 50)
    
    response = requests.post(
        f"{BASE_URL}/api/one-click/upload",
        json={
            "fileName": TEST_FILE,
            "fileType": "application/pdf"
        },
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Failed: {response.text}")
        return None
    
    data = response.json()
    print(f"✅ Upload initialized")
    print(f"   Job ID: {data['jobId']}")
    print(f"   Upload URL: {data['uploadUrl']}")
    print(f"   Metadata: {json.dumps(data['metadata'], indent=2)}")
    
    return data

def test_status_check(job_id):
    """Test status endpoint"""
    print(f"\n🧪 Test 2: Check Status")
    print("-" * 50)
    
    response = requests.get(f"{BASE_URL}/api/one-click/status?jobId={job_id}")
    
    if response.status_code != 200:
        print(f"❌ Failed: {response.text}")
        return None
    
    data = response.json()
    print(f"✅ Status retrieved")
    print(f"   Stage: {data['stage']}")
    print(f"   Progress: {data['progress']}%")
    print(f"   Message: {data['message']}")
    
    return data

def test_tus_upload(upload_url, metadata, file_path):
    """Test TUS upload"""
    print(f"\n🧪 Test 3: TUS Upload")
    print("-" * 50)
    
    if not Path(file_path).exists():
        print(f"❌ File not found: {file_path}")
        return False
    
    with open(file_path, 'rb') as f:
        file_content = f.read()
    
    file_size = len(file_content)
    print(f"   File size: {file_size} bytes")
    
    # TUS metadata format: key1 value1,key2 value2
    tus_metadata = ",".join([f"{k} {str(v)}" for k, v in metadata.items()])
    
    # Create upload
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": str(file_size),
        "Upload-Metadata": tus_metadata
    }
    
    print(f"   Creating TUS upload...")
    create_response = requests.post(upload_url, headers=headers)
    
    if create_response.status_code != 201:
        print(f"❌ Create failed: {create_response.status_code}")
        print(f"   Response: {create_response.text}")
        return False
    
    upload_location = create_response.headers.get("Location")
    print(f"✅ Upload created: {upload_location}")
    
    # Upload data
    patch_headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream"
    }
    
    print(f"   Uploading file content...")
    patch_response = requests.patch(upload_location, data=file_content, headers=patch_headers)
    
    if patch_response.status_code != 204:
        print(f"❌ Upload failed: {patch_response.status_code}")
        print(f"   Response: {patch_response.text}")
        return False
    
    print(f"✅ File uploaded successfully")
    return True

def test_process(job_id):
    """Test processing endpoint"""
    print(f"\n🧪 Test 4: Start Processing")
    print("-" * 50)
    
    response = requests.post(
        f"{BASE_URL}/api/one-click/process",
        json={"jobId": job_id},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed: {response.text}")
        return False
    
    print(f"✅ Processing started")
    return True

def monitor_processing(job_id, timeout=300):
    """Monitor processing progress"""
    print(f"\n🧪 Test 5: Monitor Processing")
    print("-" * 50)
    
    start_time = time.time()
    last_stage = None
    
    while time.time() - start_time < timeout:
        response = requests.get(f"{BASE_URL}/api/one-click/status?jobId={job_id}")
        
        if response.status_code != 200:
            print(f"❌ Status check failed")
            return False
        
        data = response.json()
        
        if data['stage'] != last_stage:
            last_stage = data['stage']
            print(f"   [{data['progress']}%] {data['stage']}: {data['message']}")
        
        if data['stage'] == 'complete':
            print(f"✅ Processing complete!")
            return True
        
        if data.get('error'):
            print(f"❌ Processing error: {data['error']}")
            return False
        
        time.sleep(2)
    
    print(f"❌ Timeout after {timeout}s")
    return False

def test_download(job_id):
    """Test download endpoint"""
    print(f"\n🧪 Test 6: Download Result")
    print("-" * 50)
    
    response = requests.get(f"{BASE_URL}/api/one-click/download?jobId={job_id}", allow_redirects=False)
    
    if response.status_code == 302 or response.status_code == 307:
        download_url = response.headers.get('Location')
        print(f"✅ Download URL generated: {download_url[:80]}...")
        
        # Try to download
        download_response = requests.get(download_url)
        if download_response.status_code == 200:
            output_file = f"result-{job_id}.zip"
            with open(output_file, 'wb') as f:
                f.write(download_response.content)
            print(f"✅ Downloaded: {output_file} ({len(download_response.content)} bytes)")
            return True
        else:
            print(f"❌ Download failed: {download_response.status_code}")
            return False
    else:
        print(f"❌ No redirect: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        return False

def main():
    """Run all tests"""
    print("=" * 50)
    print("🧪 One-Click Pipeline E2E Test")
    print("=" * 50)
    
    # Step 0: Create test file
    if not create_test_pdf():
        print("❌ Cannot proceed without test file")
        sys.exit(1)
    
    # Step 1: Initialize upload
    upload_data = test_upload_init()
    if not upload_data:
        print("\n❌ Test failed at initialization")
        sys.exit(1)
    
    job_id = upload_data['jobId']
    
    # Step 2: Check initial status
    test_status_check(job_id)
    
    # Step 3: Upload via TUS
    if not test_tus_upload(upload_data['uploadUrl'], upload_data['metadata'], TEST_FILE):
        print("\n❌ Test failed at TUS upload")
        sys.exit(1)
    
    time.sleep(2)  # Wait for TUS server to process
    
    # Step 4: Start processing
    if not test_process(job_id):
        print("\n❌ Test failed at processing start")
        sys.exit(1)
    
    # Step 5: Monitor processing
    if not monitor_processing(job_id):
        print("\n❌ Test failed during processing")
        sys.exit(1)
    
    # Step 6: Download result
    if not test_download(job_id):
        print("\n❌ Test failed at download")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✅ All tests passed!")
    print("=" * 50)

if __name__ == "__main__":
    main()
