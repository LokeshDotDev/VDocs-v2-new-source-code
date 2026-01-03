"""
Universal File Converter Module
Handles conversion between multiple file formats:
- Documents: PDF, DOCX, DOC, ODT, RTF, TXT, HTML
- Images: JPG, PNG, GIF, BMP, TIFF, WebP, SVG
- Videos: MP4, MOV, AVI, MKV, WebM, FLV
- Audio: MP3, WAV, FLAC, M4A, AAC, OGG
"""

import os
import subprocess
from pathlib import Path
from typing import Optional
from PIL import Image
import pypandoc
from pdf2docx import Converter as PDF2DOCXConverter
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UniversalConverter:
    """Handles conversion between various file formats"""

    def __init__(self):
        self.temp_dir = Path("/tmp/universal-converter")
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    # ==================== DOCUMENT CONVERSIONS ====================

    def convert_document(
        self, input_path: str, output_path: str, input_format: str, output_format: str
    ) -> bool:
        """Convert between document formats"""
        try:
            input_format = input_format.lower()
            output_format = output_format.lower()

            # PDF to DOCX
            if input_format == "pdf" and output_format in ["docx", "doc"]:
                return self._pdf_to_docx(input_path, output_path)

            # DOCX to PDF
            elif input_format in ["docx", "doc"] and output_format == "pdf":
                return self._docx_to_pdf(input_path, output_path)

            # Use Pandoc for other document conversions
            elif self._is_pandoc_supported(input_format, output_format):
                return self._pandoc_convert(input_path, output_path, input_format, output_format)

            # LibreOffice for complex conversions
            else:
                return self._libreoffice_convert(input_path, output_path, output_format)

        except Exception as e:
            logger.error(f"Document conversion failed: {e}")
            return False

    def _pdf_to_docx(self, input_path: str, output_path: str) -> bool:
        """Convert PDF to DOCX using pdf2docx"""
        try:
            cv = PDF2DOCXConverter(input_path)
            cv.convert(output_path, start=0, end=None)
            cv.close()
            return True
        except Exception as e:
            logger.error(f"PDF to DOCX failed: {e}")
            return False

    def _docx_to_pdf(self, input_path: str, output_path: str) -> bool:
        """Convert DOCX to PDF using LibreOffice"""
        try:
            output_dir = Path(output_path).parent
            subprocess.run(
                [
                    "libreoffice",
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(output_dir),
                    input_path,
                ],
                check=True,
                capture_output=True,
            )
            return True
        except Exception as e:
            logger.error(f"DOCX to PDF failed: {e}")
            return False

    def _pandoc_convert(
        self, input_path: str, output_path: str, input_format: str, output_format: str
    ) -> bool:
        """Convert documents using Pandoc"""
        try:
            pypandoc.convert_file(
                input_path,
                output_format,
                outputfile=output_path,
                format=input_format,
            )
            return True
        except Exception as e:
            logger.error(f"Pandoc conversion failed: {e}")
            return False

    def _libreoffice_convert(self, input_path: str, output_path: str, output_format: str) -> bool:
        """Convert using LibreOffice command line"""
        try:
            output_dir = Path(output_path).parent
            subprocess.run(
                [
                    "libreoffice",
                    "--headless",
                    "--convert-to",
                    output_format,
                    "--outdir",
                    str(output_dir),
                    input_path,
                ],
                check=True,
                capture_output=True,
                timeout=120,
            )
            return True
        except Exception as e:
            logger.error(f"LibreOffice conversion failed: {e}")
            return False

    def _is_pandoc_supported(self, input_format: str, output_format: str) -> bool:
        """Check if Pandoc supports this conversion"""
        pandoc_formats = ["md", "markdown", "rst", "txt", "html", "docx", "odt", "rtf", "epub"]
        return input_format in pandoc_formats and output_format in pandoc_formats

    # ==================== IMAGE CONVERSIONS ====================

    def convert_image(self, input_path: str, output_path: str, output_format: str) -> bool:
        """Convert between image formats using Pillow"""
        try:
            with Image.open(input_path) as img:
                # Handle transparency for formats that don't support it
                if output_format.lower() in ["jpg", "jpeg"] and img.mode in ["RGBA", "LA", "P"]:
                    # Convert to RGB
                    rgb_img = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                    img = rgb_img

                # Save with appropriate format
                save_kwargs = {}
                if output_format.lower() in ["jpg", "jpeg"]:
                    save_kwargs["quality"] = 95
                elif output_format.lower() == "png":
                    save_kwargs["optimize"] = True
                elif output_format.lower() == "webp":
                    save_kwargs["quality"] = 90

                img.save(output_path, format=output_format.upper(), **save_kwargs)
                return True

        except Exception as e:
            logger.error(f"Image conversion failed: {e}")
            return False

    # ==================== VIDEO CONVERSIONS ====================

    def convert_video(self, input_path: str, output_path: str, output_format: str) -> bool:
        """Convert between video formats using FFmpeg"""
        try:
            # FFmpeg command for video conversion
            cmd = [
                "ffmpeg",
                "-i",
                input_path,
                "-c:v",
                "libx264",  # Video codec
                "-preset",
                "medium",
                "-crf",
                "23",  # Quality (lower = better)
                "-c:a",
                "aac",  # Audio codec
                "-b:a",
                "192k",
                "-y",  # Overwrite output
                output_path,
            ]

            # Adjust codec based on output format
            if output_format.lower() == "webm":
                cmd[5] = "libvpx-vp9"  # WebM video codec
                cmd[11] = "libopus"  # WebM audio codec
            elif output_format.lower() in ["avi", "mkv"]:
                cmd[5] = "libx264"
            elif output_format.lower() == "mov":
                cmd[5] = "libx264"

            subprocess.run(cmd, check=True, capture_output=True, timeout=600)
            return True

        except Exception as e:
            logger.error(f"Video conversion failed: {e}")
            return False

    # ==================== AUDIO CONVERSIONS ====================

    def convert_audio(self, input_path: str, output_path: str, output_format: str) -> bool:
        """Convert between audio formats using FFmpeg"""
        try:
            # FFmpeg command for audio conversion
            cmd = ["ffmpeg", "-i", input_path]

            # Set codec and bitrate based on format
            if output_format.lower() == "mp3":
                cmd.extend(["-c:a", "libmp3lame", "-b:a", "320k"])
            elif output_format.lower() == "wav":
                cmd.extend(["-c:a", "pcm_s16le"])
            elif output_format.lower() == "flac":
                cmd.extend(["-c:a", "flac"])
            elif output_format.lower() in ["m4a", "aac"]:
                cmd.extend(["-c:a", "aac", "-b:a", "256k"])
            elif output_format.lower() == "ogg":
                cmd.extend(["-c:a", "libvorbis", "-b:a", "256k"])
            else:
                cmd.extend(["-c:a", "copy"])

            cmd.extend(["-y", output_path])

            subprocess.run(cmd, check=True, capture_output=True, timeout=300)
            return True

        except Exception as e:
            logger.error(f"Audio conversion failed: {e}")
            return False


# Create singleton instance
converter = UniversalConverter()
