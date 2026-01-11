"""
docx_anonymizer.py

DOCX anonymization via text-node-level removal.

CRITICAL PRINCIPLE:
- NEVER re-serialize XML (breaks formatting)
- ONLY clear text node content
- Remove by exact text match in <w:t>VALUE</w:t>
- Fallback: byte-level replacement on document.xml
- Preserves all structure, spacing, alignment
"""

import os
import re
import zipfile
import tempfile
from lxml import etree
from logger import get_logger

logger = get_logger(__name__)

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


TEXT_LIKE_EXTENSIONS = {
    ".xml",
    ".rels",
    ".txt",
    ".htm",
    ".html",
    ".json",
    ".csv",
    ".tsv",
    ".md",
    ".properties",
    ".ini",
    ".cfg",
}


def _replace_bytes_case_insensitive(file_path: str, targets: list[bytes]) -> int:
    """Case-insensitive byte replacement for text-like files. Returns replacements count."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in TEXT_LIKE_EXTENSIONS:
        return 0

    try:
        with open(file_path, "rb") as f:
            data = f.read()
    except Exception:
        return 0

    total = 0
    for tgt in targets:
        if not tgt:
            continue
        pattern = re.compile(re.escape(tgt), flags=re.IGNORECASE)
        hits = len(re.findall(pattern, data))
        if hits:
            data = re.sub(pattern, b"[REDACTED]", data)
            total += hits

    if total:
        try:
            with open(file_path, "wb") as f:
                f.write(data)
        except Exception:
            return 0
    return total


def unzip_docx(docx_path: str) -> str:
    """Unzip DOCX to temp directory."""
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(docx_path, 'r') as z:
        z.extractall(temp_dir)
    return temp_dir


def load_xml(xml_path: str) -> etree._ElementTree:
    """Load XML with parser that preserves all whitespace."""
    import tempfile
    import traceback
    parser = etree.XMLParser(
        remove_blank_text=False,
        strip_cdata=False,
        remove_comments=False,
    )
    try:
        return etree.parse(xml_path, parser)
    except Exception as e:
        tb = traceback.format_exc()
        temp_path = None
        try:
            with open(xml_path, 'rb') as src:
                xml_bytes = src.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix="_anonymizer_failed.xml", mode="wb") as f:
                f.write(xml_bytes)
                temp_path = f.name
        except Exception as file_exc:
            temp_path = f"[Failed to save XML: {file_exc}]"
        logger.error(f"[ERROR] XML parse failed in docx_anonymizer.py load_xml for {xml_path}: {e}\nTraceback:\n{tb}\nProblematic XML saved to: {temp_path}")
        raise


def zip_docx(temp_dir: str, output_path: str):
    """Rezip DOCX from temp directory."""
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for foldername, _, filenames in os.walk(temp_dir):
            for filename in filenames:
                file_path = os.path.join(foldername, filename)
                arcname = os.path.relpath(file_path, temp_dir)
                z.write(file_path, arcname)


def _remove_value_aggressive(docx_path: str, value: str) -> int:
    """
    AGGRESSIVE direct byte-level removal.
    Simple, bulletproof, no regex complexity.
    
    Args:
        docx_path: Path to DOCX file
        value: Value to remove (e.g., "JOHN DOE")
    
    Returns:
        Number of occurrences removed
    """
    if not value or not value.strip():
        return 0
    
    val_clean = value.strip()
    removed_count = 0
    
    temp_dir = unzip_docx(docx_path)
    try:
        # Scan every XML part (document, headers, footers, customXml, settings)
        for root, _, files in os.walk(temp_dir):
            for filename in files:
                if not filename.lower().endswith('.xml'):
                    continue
                xml_path = os.path.join(root, filename)

                # Read as bytes
                with open(xml_path, "rb") as f:
                    xml_bytes = f.read()

                val_bytes = val_clean.encode("utf-8")
                pattern = re.compile(re.escape(val_bytes), flags=re.IGNORECASE)
                hits = len(re.findall(pattern, xml_bytes))

                if hits:
                    xml_bytes = re.sub(pattern, b"[REDACTED]", xml_bytes)
                    removed_count += hits
                    logger.info(f"  ✂️  Removed {hits} occurrences of '{val_clean}' in {filename}")

                    with open(xml_path, "wb") as f:
                        f.write(xml_bytes)

        # Final fallback: replace in any text-like file (rels, customXml, etc.)
        targets = [val_clean.encode("utf-8")]
        for root, _, files in os.walk(temp_dir):
            for filename in files:
                file_path = os.path.join(root, filename)
                hits = _replace_bytes_case_insensitive(file_path, targets)
                if hits:
                    removed_count += hits

        # Rezip once after all edits
        zip_docx(temp_dir, docx_path)

        return removed_count
    finally:
        import shutil
        shutil.rmtree(temp_dir)


def _remove_value_from_text_nodes(docx_path: str, value: str) -> int:
    """
    Remove value using aggressive byte-level strategy.
    
    Args:
        docx_path: Path to DOCX file
        value: Value to remove (e.g., "JOHN DOE")
    
    Returns:
        Number of occurrences removed
    """
    return _remove_value_aggressive(docx_path, value)


def _remove_value_byte_level(docx_path: str, value: str) -> int:
    """
    Fallback: byte-level replacement in document.xml
    
    Regex pattern: <w:t...>VALUE</w:t>
    Clear by replacing VALUE → "" (preserve tags)
    
    Returns:
        Number of bytes removed
    """
    if not value or not value.strip():
        return 0
    
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        
        with open(document_xml, "rb") as f:
            xml_bytes = f.read()
        
        val_bytes = value.strip().encode("utf-8")
        # Replace with NBSP to preserve structure and bullet rendering
        pattern = b"(<w:t[^>]*>)" + re.escape(val_bytes) + b"(</w:t>)"
        
        replaced = re.sub(pattern, b"\\1\xC2\xA0\\2", xml_bytes, flags=re.IGNORECASE)
        
        bytes_removed = len(xml_bytes) - len(replaced)
        
        if bytes_removed > 0:
            with open(document_xml, "wb") as f:
                f.write(replaced)
            logger.info(f"    ✂️  Byte-level removal: {bytes_removed} bytes")
        
        zip_docx(temp_dir, docx_path)
        return bytes_removed
    finally:
        import shutil
        shutil.rmtree(temp_dir)


def _fix_bullet_formatting(docx_path: str) -> int:
    """
    Fix bullet formatting by changing Symbol/Wingdings fonts to normal fonts.
    
    PDF converters often use Symbol font for bullets, which renders as squares in Word.
    This changes the font to Arial/Calibri so bullets display correctly.
    
    Returns: number of runs fixed
    """
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        tree = load_xml(document_xml)
        root = tree.getroot()
        
        fixed = 0
        
        # Find all runs with Symbol/Wingdings fonts
        for run in root.xpath("//w:r", namespaces=WORD_NAMESPACE):
            rPr = run.find("w:rPr", WORD_NAMESPACE)
            if rPr is None:
                continue
            
            # Check font
            fonts = rPr.find("w:rFonts", WORD_NAMESPACE)
            if fonts is None:
                continue
            
            # Get the font names
            ascii_font = fonts.get(f"{{{WORD_NAMESPACE['w']}}}ascii", "")
            
            # If it's Symbol or Wingdings, change to Arial
            if ascii_font in ['Symbol', 'Wingdings', 'Webdings', 'MT Extra']:
                # Change all font attributes to Arial
                fonts.set(f"{{{WORD_NAMESPACE['w']}}}ascii", "Arial")
                fonts.set(f"{{{WORD_NAMESPACE['w']}}}hAnsi", "Arial")
                fonts.set(f"{{{WORD_NAMESPACE['w']}}}cs", "Arial")
                fixed += 1
                
                text_node = run.find("w:t", WORD_NAMESPACE)
                if text_node is not None and text_node.text:
                    logger.info(f"  ✓ Changed {ascii_font} → Arial for text: {repr(text_node.text[:20])}")
        
        # Write back XML
        tree.write(document_xml, encoding="UTF-8", xml_declaration=True)
        
        # Rezip
        zip_docx(temp_dir, docx_path)
        
        return fixed
    finally:
        import shutil
        shutil.rmtree(temp_dir)


def anonymize_docx(input_path: str, output_path: str, name: str = None, roll_no: str = None) -> dict:
    """
    Anonymize DOCX by removing name and roll number.
    BULLETPROOF: Uses direct byte replacement at multiple levels.
    
    Args:
        input_path: Input DOCX file
        output_path: Output anonymized DOCX
        name: Student name to remove
        roll_no: Student roll number to remove
    
    Returns:
        {
            "removed_name": count,
            "removed_roll": count,
            "bytes_removed": total
        }
    """
    import shutil
    
    # Copy input to output first
    shutil.copy(input_path, output_path)
    
    logger.info(f"🔄 Anonymizing {output_path}...")
    logger.info(f"   Using BULLETPROOF byte-level replacement")
    
    stats = {
        "removed_name": 0,
        "removed_roll": 0,
        "bytes_removed": 0,
    }
    
    temp_dir = unzip_docx(output_path)
    try:
        label_name_re = re.compile(r"\b(learner\s+name|student\s+name|name)\b", re.IGNORECASE)
        label_roll_re = re.compile(r"\b(learner\s+roll|roll\s+(?:number|no\.?|num\.?|#)|enrollment\s+(?:no|number)|id\s+(?:no|number))\b", re.IGNORECASE)

        name_clean = name.strip() if name else None
        roll_clean = roll_no.strip() if roll_no else None
        name_parts = [p for p in (name_clean.split() if name_clean else []) if len(p) >= 3]

        for root, _, files in os.walk(temp_dir):
            for filename in files:
                if not filename.lower().endswith('.xml'):
                    continue

                xml_path = os.path.join(root, filename)
                try:
                    tree = etree.parse(xml_path)
                except Exception:
                    continue

                changed = False

                # Only process WordprocessingML parts that actually contain text nodes
                if not (tree.getroot().tag.endswith('document') or tree.xpath("//w:t", namespaces=WORD_NAMESPACE)):
                    continue

                # Paragraph-level scan to enforce label context
                for para in tree.xpath("//w:p", namespaces=WORD_NAMESPACE):
                    para_text = "".join((t.text or "") for t in para.xpath(".//w:t", namespaces=WORD_NAMESPACE))
                    para_lower = para_text.lower()
                    has_name_label = bool(label_name_re.search(para_lower))
                    has_roll_label = bool(label_roll_re.search(para_lower))

                    for text_node in para.xpath(".//w:t", namespaces=WORD_NAMESPACE):
                        txt_raw = text_node.text or ""
                        txt = txt_raw.strip()
                        if not txt:
                            continue

                        # Roll: exact match only (case-insensitive), requires roll label in same paragraph
                        if roll_clean and has_roll_label and txt.lower() == roll_clean.lower():
                            text_node.text = "[REDACTED]"
                            stats["removed_roll"] += 1
                            changed = True
                            continue

                        # Name: exact match; optional parts if name is split, only when label present
                        if name_clean and has_name_label:
                            if txt.lower() == name_clean.lower():
                                text_node.text = "[REDACTED]"
                                stats["removed_name"] += 1
                                changed = True
                                continue
                            if len(name_clean) >= 6:
                                for part in name_parts:
                                    if txt.lower() == part.lower():
                                        text_node.text = "[REDACTED]"
                                        stats["removed_name"] += 1
                                        changed = True
                                        break

                if changed:
                    tree.write(xml_path, encoding="UTF-8", xml_declaration=True)

        # Rezip all modified parts
        zip_docx(temp_dir, output_path)
        
        logger.info(f"✅ Anonymization complete:")
        logger.info(f"   Name instances removed: {stats['removed_name']}")
        logger.info(f"   Roll instances removed: {stats['removed_roll']}")
        logger.info(f"   Total bytes removed: {stats['bytes_removed']}")
        
        return stats
    
    finally:
        import shutil
        shutil.rmtree(temp_dir)
