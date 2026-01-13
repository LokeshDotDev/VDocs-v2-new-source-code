from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Dict, Any, Optional
import requests
import subprocess
import tempfile
import os
import shutil
from config import config
from logger import get_logger
from modules.ai_detector.binoculars_detector import BinocularsDetector
from docx import Document

logger = get_logger(__name__)

# Initialize Binoculars detector (connects to remote VPS)
binoculars_detector = BinocularsDetector()

app = FastAPI(
    title=config.APP_NAME,
    version=config.APP_VERSION,
    debug=config.DEBUG,
)

# Models
class ConvertPdfToHtmlRequest(BaseModel):
    user_id: str
    upload_id: str
    filename: str
    relative_path: str

class HealthResponse(BaseModel):
    status: str
    version: str

class DocxHumanizeRequest(BaseModel):
    input_file_path: str
    output_file_path: str
    skip_detect: Optional[bool] = True
    humanizer_url: Optional[str] = os.getenv("HUMANIZER_API_URL", "http://localhost:8000/humanize")

class AnonymizeTextRequest(BaseModel):
    text: str
    name_pattern: Optional[str] = None
    roll_pattern: Optional[str] = None

class AnonymizeDocxRequest(BaseModel):
    input_file_path: str
    output_file_path: str

class ExtractTextRequest(BaseModel):
    file_path: str

# Routes
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Manager health check - also checks registered services."""
    service_health = {}
    for service_name, service_config in config.SERVICES.items():
        try:
            response = requests.get(
                f"{service_config['url']}/health",
                timeout=5
            )
            service_health[service_name] = "connected" if response.status_code == 200 else "error"
        except Exception as e:
            logger.warning(f"Service {service_name} unhealthy: {e}")
            service_health[service_name] = "disconnected"
    
    return {
        "status": "ok",
        "version": config.APP_VERSION,
        "services": service_health,
    }

@app.post("/extract-text")
async def extract_text(request: ExtractTextRequest) -> Dict[str, Any]:
    """
    Extract text from a DOCX or TXT file.
    Expects: { "file_path": "/path/to/file.docx" }
    Returns: { "text": "extracted text content" }
    """
    try:
        file_path = request.file_path
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        
        # Extract text based on file type
        if file_path.endswith('.docx'):
            logger.info(f"📄 Extracting text from DOCX: {file_path}")
            doc = Document(file_path)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        elif file_path.endswith('.txt'):
            logger.info(f"📄 Extracting text from TXT: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            # Fallback: read as plain text
            logger.info(f"📄 Reading file as plain text: {file_path}")
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
        
        logger.info(f"✅ Extracted {len(text)} characters from {file_path}")
        return {"text": text}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Text extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reductor/anonymize-text")
async def reductor_anonymize_text(request: AnonymizeTextRequest, version: Optional[str] = None) -> Dict[str, Any]:
    """
    version: 'v2' or 'v3' (query param, defaults to v3 if not provided)
    """
    try:
        logger.info("🧹 Routing text anonymization to reductor")
        svc_key = f"reductor_{version}" if version in ("v2", "v3") else "reductor_v3"
        svc = config.SERVICES.get(svc_key)
        if not svc:
            raise HTTPException(status_code=500, detail=f"Reductor service {svc_key} not registered")
        url = f"{svc['url']}{svc['endpoints']['anonymize-text']}"
        resp = requests.post(url, json=request.dict(), timeout=120)
        if resp.status_code == 200:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Reductor service unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reductor/anonymize-docx")
async def reductor_anonymize_docx(request: AnonymizeDocxRequest, version: Optional[str] = None) -> Dict[str, Any]:
    """
    version: 'v2' or 'v3' (query param, defaults to v3 if not provided)
    """
    try:
        logger.info("🧹 Routing DOCX anonymization to reductor")
        svc_key = f"reductor_{version}" if version in ("v2", "v3") else "reductor_v3"
        svc = config.SERVICES.get(svc_key)
        if not svc:
            raise HTTPException(status_code=500, detail=f"Reductor service {svc_key} not registered")
        url = f"{svc['url']}{svc['endpoints']['anonymize-docx']}"
        resp = requests.post(url, json=request.dict(), timeout=600)
        if resp.status_code == 200:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Reductor service unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert/pdf-to-html")
async def convert_pdf_to_html(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Route PDF to HTML conversion to Converter Module.
    
    This is just a proxy - actual conversion is done by converter-module service.
    """
    try:
        logger.info(f"🔄 Routing conversion request to converter module: {request.filename}")
        
        # Get converter service config
        converter_service = config.SERVICES.get("converter")
        if not converter_service:
            raise HTTPException(status_code=500, detail="Converter service not registered")
        
        # Forward request to converter module
        converter_url = f"{converter_service['url']}{converter_service['endpoints']['pdf-to-html']}"
        response = requests.post(
            converter_url,
            json=request.dict(),
            timeout=300,  # 5 minutes
        )
        
        # Return converter response
        if response.status_code == 200:
            logger.info(f"✅ Conversion routed successfully")
            return response.json()
        else:
            logger.error(f"❌ Converter module returned error: {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Conversion failed")
            )
    
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to converter module")
        raise HTTPException(status_code=503, detail="Converter service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Conversion routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/convert/pdf-to-docx")
async def convert_pdf_to_docx(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Route PDF to DOCX conversion to Converter Module (for ONLYOFFICE).
    """
    try:
        logger.info(f"Routing PDF->DOCX conversion request to converter module: {request.filename}")

        converter_service = config.SERVICES.get("converter")
        if not converter_service:
            raise HTTPException(status_code=500, detail="Converter service not registered")

        converter_url = f"{converter_service['url']}{converter_service['endpoints']['pdf-to-docx']}"
        response = requests.post(
            converter_url,
            json=request.dict(),
            timeout=300,
        )

        if response.status_code == 200:
            logger.info("PDF->DOCX conversion routed successfully")
            return response.json()
        else:
            logger.error(f"Converter module returned error (pdf-to-docx): {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "PDF->DOCX conversion failed"),
            )
    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to converter module (pdf-to-docx)")
        raise HTTPException(status_code=503, detail="Converter service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF->DOCX routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert/pdf-to-html-direct")
async def convert_pdf_to_html_direct(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Route direct PDF→HTML conversion (PyMuPDF) to Converter Module.
    """
    try:
        logger.info(f"🔄 Routing DIRECT conversion request to converter module: {request.filename}")

        converter_service = config.SERVICES.get("converter")
        if not converter_service:
            raise HTTPException(status_code=500, detail="Converter service not registered")

        converter_url = f"{converter_service['url']}{converter_service['endpoints']['pdf-to-html-direct']}"
        response = requests.post(
            converter_url,
            json=request.dict(),
            timeout=300,
        )

        if response.status_code == 200:
            logger.info("✅ DIRECT conversion routed successfully")
            return response.json()
        else:
            logger.error(f"❌ Converter module returned error (direct): {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Direct conversion failed"),
            )
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to converter module (direct)")
        raise HTTPException(status_code=503, detail="Converter service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Direct conversion routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai-detection/detect")
async def ai_detect(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Proxy single-text detection to AI Detector /detect.
    Expects: { "text": "..." }
    Returns: { "score", "prediction", "isAIGenerated", "aiPercentage" }
    """
    try:
        logger.info("🔍 Routing AI single detection request")
        ai_detector_service = config.SERVICES.get("ai-detector")
        if not ai_detector_service:
            raise HTTPException(status_code=500, detail="AI Detector service not registered")
        detector_url = f"{ai_detector_service['url']}{ai_detector_service['endpoints']['detect']}"
        response = requests.post(detector_url, json=request, timeout=300)
        if response.status_code == 200:
            return response.json()
        raise HTTPException(status_code=response.status_code, detail=response.text)
    except requests.exceptions.ReadTimeout:
        raise HTTPException(status_code=504, detail="AI detection timed out")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="AI Detector service unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai-detection/batch-detect")
async def ai_batch_detect(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Proxy batch detection to AI Detector /batch-detect.
    Expects: { "texts": ["...", "..."] }
    Returns: { "results": [{ "score", "prediction", ...}] }
    """
    try:
        num_chunks = len(request.get('texts', []))
        logger.info(f"🔍 Routing AI batch detection ({num_chunks} chunks)")
        ai_detector_service = config.SERVICES.get("ai-detector")
        if not ai_detector_service:
            raise HTTPException(status_code=500, detail="AI Detector service not registered")
        detector_url = f"{ai_detector_service['url']}{ai_detector_service['endpoints']['batch-detect']}"
        # Batch processing takes longer: allow 600s (10 minutes) for up to 30+ chunks
        response = requests.post(detector_url, json=request, timeout=600)
        if response.status_code == 200:
            logger.info(f"✅ AI batch detection completed ({num_chunks} chunks)")
            return response.json()
        raise HTTPException(status_code=response.status_code, detail=response.text)
    except requests.exceptions.ReadTimeout:
        raise HTTPException(status_code=504, detail="AI batch detection timed out after 600s")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="AI Detector service unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/humanizer/humanize")
async def humanize_text(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Route humanization request to Humanizer Module.
    Expects: { "text": "some text", "mode": "standard" }
    Returns: { "humanized_text": "...", "metrics": {...} }
    """
    try:
        logger.info(f"✍️ Routing humanization request")
        
        humanizer_service = config.SERVICES.get("humanizer")
        if not humanizer_service:
            raise HTTPException(status_code=500, detail="Humanizer service not registered")
        
        humanizer_url = f"{humanizer_service['url']}{humanizer_service['endpoints']['humanize']}"
        response = requests.post(
            humanizer_url,
            json=request,
            timeout=300,
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Humanization completed")
            return response.json()
        else:
            logger.error(f"❌ Humanizer returned error: {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Humanization failed")
            )
    
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to Humanizer module")
        raise HTTPException(status_code=503, detail="Humanizer service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Humanization routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/humanizer/humanize-docx")
async def humanize_docx(request: DocxHumanizeRequest) -> Dict[str, Any]:
    """
    Humanize a DOCX file while preserving formatting.
    Runs the docx_humanize_lxml.py script which calls the humanizer API.
    """
    try:
        logger.info(f"📄 Starting DOCX humanization: {request.input_file_path}")
        
        # Path to the DOCX humanizer script
        script_path = os.path.join(
            os.path.dirname(__file__),
            "modules",
            "humanizer",
            "docx_humanize_lxml.py"
        )
        
        # Python interpreter (use virtual environment if exists)
        python_path = os.path.join(
            os.path.dirname(__file__),
            "modules",
            "humanizer",
            ".venv",
            "Scripts" if os.name == "nt" else "bin",
            "python.exe" if os.name == "nt" else "python"
        )
        
        if not os.path.exists(python_path):
            python_path = "python"
        
        # Build command
        args = [
            python_path,
            script_path,
            "--input", request.input_file_path,
            "--output", request.output_file_path,
        ]
        
        if request.skip_detect:
            args.append("--skip-detect")
        
        # Set environment variables for the subprocess
        env = os.environ.copy()
        env["HUMANIZER_URL"] = request.humanizer_url
        
        logger.info(f"🚀 Running: {' '.join(args)}")
        logger.info(f"🌐 HUMANIZER_URL: {request.humanizer_url}")
        
        # Run the script
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minutes
            env=env,
        )
        
        if result.returncode != 0:
            logger.error(f"❌ DOCX humanization failed: {result.stderr}")
            raise HTTPException(
                status_code=500,
                detail=f"DOCX humanization failed: {result.stderr}"
            )
        
        logger.info(f"✅ DOCX humanization completed")
        
        return {
            "status": "success",
            "input_file": request.input_file_path,
            "output_file": request.output_file_path,
            "stdout": result.stdout,
        }
    
    except subprocess.TimeoutExpired:
        logger.error("❌ DOCX humanization timed out")
        raise HTTPException(status_code=504, detail="DOCX humanization timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ DOCX humanization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai-detector/detect-binoculars")
async def detect_ai_binoculars(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Detect if text is AI-generated using Binoculars (remote VPS).
    Expects: { "text": "some text" }
    Returns: { "score": float, "is_ai_generated": boolean }
    """
    try:
        text = request.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="text field is required")
        
        logger.info(f"🔍 Running Binoculars AI detection on {len(text)} characters")
        result = binoculars_detector.detect(text)
        
        logger.info(f"✅ Binoculars detection complete: score={result['score']}, is_ai={result['is_ai_generated']}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Binoculars detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": config.APP_NAME,
        "version": config.APP_VERSION,
        "description": "Orchestrator/Router for document processing services",
        "registered_services": list(config.SERVICES.keys()),
        "endpoints": {
            "health": "/health",
            "extract-text": "/extract-text",
            "convert/pdf-to-html": "/convert/pdf-to-html",
            "convert/pdf-to-html-direct": "/convert/pdf-to-html-direct",
            "ai-detection/detect": "/ai-detection/detect",
            "ai-detection/batch-detect": "/ai-detection/batch-detect",
            "ai-detector/detect-binoculars": "/ai-detector/detect-binoculars",
            "humanizer/humanize": "/humanizer/humanize",
            "humanizer/humanize-docx": "/humanizer/humanize-docx",
        },
    }

if __name__ == "__main__":
    import uvicorn
    import os
    host = os.getenv("HOST", "0.0.0.0")
    port = config.PORT
    uvicorn.run(app, host=host, port=port)
