from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import Dict, Any, Optional
import requests
import subprocess
import os
import sys
from pathlib import Path
import importlib.util

from config import config
from logger import get_logger
from modules.ai_detector.binoculars_detector import BinocularsDetector
from docx import Document

logger = get_logger(__name__)

# =========================================================
# 🔥 SAFE + DOCKER-CORRECT process_job.py IMPORT
# =========================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PROCESS_JOB_PATH = os.path.join(BASE_DIR, "scripts", "process_job.py")

if not os.path.isfile(PROCESS_JOB_PATH):
    raise FileNotFoundError(
        f"❌ process_job.py not found.\nExpected at: {PROCESS_JOB_PATH}\n"
        f"Contents of BASE_DIR: {os.listdir(BASE_DIR)}"
    )

spec = importlib.util.spec_from_file_location(
    "process_job_module",
    PROCESS_JOB_PATH
)

process_job_module = importlib.util.module_from_spec(spec)
sys.modules["process_job_module"] = process_job_module
spec.loader.exec_module(process_job_module)

logger.info(f"✅ process_job.py loaded successfully | process_job_path={PROCESS_JOB_PATH}")

# =========================================================
# INIT SERVICES
# =========================================================
binoculars_detector = BinocularsDetector()

app = FastAPI(
    title=config.APP_NAME,
    version=config.APP_VERSION,
    debug=config.DEBUG,
)

# =========================================================
# MODELS
# =========================================================
class HealthResponse(BaseModel):
    status: str
    version: str
    services: Dict[str, str]

class ProcessJobRequest(BaseModel):
    job_id: str

class ExtractTextRequest(BaseModel):
    file_path: str

# =========================================================
# ROUTES
# =========================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    service_health = {}

    for service_name, svc in config.SERVICES.items():
        try:
            r = requests.get(f"{svc['url']}/health", timeout=5)
            service_health[service_name] = "connected" if r.status_code == 200 else "error"
        except Exception:
            service_health[service_name] = "disconnected"

    return {
        "status": "ok",
        "version": config.APP_VERSION,
        "services": service_health,
    }

# ---------------------------------------------------------
# JOB ORCHESTRATION (THIS WAS FAILING BEFORE)
# ---------------------------------------------------------
@app.post("/process-job")
async def process_job_endpoint(payload: ProcessJobRequest = Body(...)):
    logger.info(f"[process-job] Starting orchestration | job_id={payload.job_id}")
    try:
        result = process_job_module.process_job(payload.job_id)
        status = "completed" if result else "failed"

        logger.info(f"[process-job] Finished | job_id={payload.job_id} | status={status}")
        return {"jobId": payload.job_id, "status": status}
    except Exception as e:
        logger.exception("[process-job] Fatal error")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------
# TEXT EXTRACTION
# ---------------------------------------------------------
@app.post("/extract-text")
async def extract_text(req: ExtractTextRequest) -> Dict[str, Any]:
    file_path = req.file_path

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    try:
        if file_path.endswith(".docx"):
            doc = Document(file_path)
            text = "\n".join(p.text for p in doc.paragraphs)
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()

        return {"text": text}
    except Exception as e:
        logger.exception("Text extraction failed")
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# ROOT
# =========================================================
@app.get("/")
async def root():
    return {
        "service": config.APP_NAME,
        "version": config.APP_VERSION,
        "status": "running",
    }

# =========================================================
# ENTRYPOINT
# =========================================================
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = config.PORT

    logger.info(f"🚀 Python Manager starting | host={host} | port={port}")

    uvicorn.run(app, host=host, port=port)
