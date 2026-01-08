import unicodedata
import re
from docx import Document

LIGATURE_FIXES = {
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "–": "-",
    "—": "-",
}

def _normalize_text(s: str) -> str:
    s = unicodedata.normalize('NFKC', s)
    for k, v in LIGATURE_FIXES.items():
        s = s.replace(k, v)
    return s

def sanitize_docx_inplace(path: str) -> None:
    """Open a DOCX and fix common PDF→DOCX glyph issues without stripping formatting.

    - Normalize Unicode (NFKC)
    - Fix common ligatures
    """
    doc = Document(path)
    for para in doc.paragraphs:
        if not para.runs:
            continue
        # Normalize each run text (do not alter bullets/numbering or alignment)
        for run in para.runs:
            run.text = _normalize_text(run.text)

    doc.save(path)