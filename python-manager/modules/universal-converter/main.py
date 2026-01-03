"""
FastAPI service for Universal File Converter
Handles conversion requests from the Next.js frontend
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from converter import converter
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Universal Converter Service")


class ConversionRequest(BaseModel):
    inputPath: str
    outputPath: str
    inputFormat: str = None
    outputFormat: str


@app.post("/convert-document")
async def convert_document(request: ConversionRequest):
    """Convert document files"""
    try:
        success = converter.convert_document(
            request.inputPath,
            request.outputPath,
            request.inputFormat,
            request.outputFormat,
        )

        if success:
            return {"success": True, "outputPath": request.outputPath}
        else:
            raise HTTPException(status_code=500, detail="Document conversion failed")

    except Exception as e:
        logger.error(f"Document conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/convert-image")
async def convert_image(request: ConversionRequest):
    """Convert image files"""
    try:
        success = converter.convert_image(
            request.inputPath, request.outputPath, request.outputFormat
        )

        if success:
            return {"success": True, "outputPath": request.outputPath}
        else:
            raise HTTPException(status_code=500, detail="Image conversion failed")

    except Exception as e:
        logger.error(f"Image conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/convert-video")
async def convert_video(request: ConversionRequest):
    """Convert video files"""
    try:
        success = converter.convert_video(
            request.inputPath, request.outputPath, request.outputFormat
        )

        if success:
            return {"success": True, "outputPath": request.outputPath}
        else:
            raise HTTPException(status_code=500, detail="Video conversion failed")

    except Exception as e:
        logger.error(f"Video conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/convert-audio")
async def convert_audio(request: ConversionRequest):
    """Convert audio files"""
    try:
        success = converter.convert_audio(
            request.inputPath, request.outputPath, request.outputFormat
        )

        if success:
            return {"success": True, "outputPath": request.outputPath}
        else:
            raise HTTPException(status_code=500, detail="Audio conversion failed")

    except Exception as e:
        logger.error(f"Audio conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "universal-converter"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
