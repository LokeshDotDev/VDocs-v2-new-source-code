"""
identity_detector.py

Smart student identity detection.

CRITICAL:
- Detects ONLY student name and roll number
- Ignores labels, headers, course names
- Operates on text nodes at document start
- Uses regex patterns tuned for academic documents
"""

import re
from lxml import etree
from logger import get_logger

logger = get_logger(__name__)

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract_text_nodes(root: etree._Element) -> list:
    """Extract all text node content as list."""
    return [t.text or "" for t in root.xpath("//w:t", namespaces=WORD_NAMESPACE)]


def extract_combined_text(root: etree._Element, max_nodes: int = 50) -> str:
    """Combine adjacent text nodes to handle split names/values."""
    texts = extract_text_nodes(root)
    # Join first N nodes with spaces to create continuous text
    return " ".join(texts[:max_nodes]).strip()


def extract_first_n_lines(root: etree._Element, n: int = 20) -> str:
    """Extract first N text nodes (document start)."""
    texts = extract_text_nodes(root)
    return " ".join(texts[:n]).strip()


def extract_table_text(root: etree._Element) -> str:
    """Extract text from tables specifically."""
    table_texts = []
    for table in root.xpath("//w:tbl", namespaces=WORD_NAMESPACE):
        for t in table.xpath(".//w:t", namespaces=WORD_NAMESPACE):
            if t.text:
                table_texts.append(t.text)
    return " ".join(table_texts[:30]).strip()


def detect_identity(docx_tree: etree._ElementTree) -> dict:
    """
    Detect student identity from DOCX.
    
    Returns:
    {
        "name": "JOHN DOE" or None,
        "roll_no": "123456789" or None,
        "confidence": "HIGH" | "MEDIUM" | "LOW" | "CLEAN"
    }
    """
    root = docx_tree.getroot()
    texts = extract_text_nodes(root)
    first_section = extract_first_n_lines(root, 25)
    
    detected_name = None
    detected_roll = None
    confidence = "LOW"
    
    # Enhanced patterns - case insensitive, flexible
    label_pattern = re.compile(
        r"^(NAME|STUDENT\s+NAME|SUBMITTED\s+BY|AUTHOR|STUDENT)\s*:?\s*(.*)$",
        re.IGNORECASE
    )
    roll_pattern = re.compile(
        r"^(ROLL\s*NO|ROLL\s*NUMBER|ROLL|STUDENT\s*ID|ENROLLMENT\s*NO|ID\s*NO|ENROLLMENT)\s*:?\s*(.*)$",
        re.IGNORECASE
    )
    
    # Combined pattern - NAME and ROLL in same line
    combined_pattern = re.compile(
        r"(?:NAME|STUDENT)\s*:?\s*([a-z\s]{3,50}).*?(?:ROLL|ID|ENROLLMENT)\s*:?\s*(\d{6,15})",
        re.IGNORECASE | re.DOTALL
    )
    
    # Check for combined pattern first
    for txt in texts[:30]:
        m = combined_pattern.search(txt)
        if m:
            detected_name = m.group(1).strip()
            detected_roll = m.group(2).strip()
            confidence = "HIGH"
            logger.info(f"  🔍 Detected combined: name={detected_name}, roll={detected_roll}")
            return {
                "name": detected_name,
                "roll_no": detected_roll,
                "confidence": confidence,
            }
    
    for idx, txt in enumerate(texts[:30]):  # Only first 30 nodes
        txt_clean = txt.strip()
        if not txt_clean or len(txt_clean) < 2:
            continue
        
        # Check if this is a NAME label
        m_name = label_pattern.match(txt_clean)
        if m_name and not detected_name:
            value = m_name.group(2).strip()
            # Accept names >= 2 chars with special characters
            if value and len(value) >= 2 and not value.isnumeric():
                detected_name = value
                confidence = "HIGH"
                logger.info(f"  🔍 Detected name from label: {detected_name}")
            else:
                # Try next node (combine multiple nodes for split names)
                combined_next = []
                for next_idx in range(idx + 1, min(idx + 5, len(texts))):
                    next_txt = texts[next_idx].strip()
                    if next_txt and not next_txt.isnumeric():
                        combined_next.append(next_txt)
                        combined_candidate = " ".join(combined_next)
                        if len(combined_candidate) >= 2:
                            detected_name = combined_candidate
                            confidence = "HIGH"
                            logger.info(f"  🔍 Detected name from next node(s): {detected_name}")
                            break
        
        # Check if this is a ROLL label
        m_roll = roll_pattern.match(txt_clean)
        if m_roll and not detected_roll:
            value = m_roll.group(2).strip()
            # Accept roll numbers 4-20 digits
            if value and re.match(r"^\d{4,20}$", value):
                detected_roll = value
                logger.info(f"  🔍 Detected roll from label: {detected_roll}")
            else:
                # Try next node
                for next_idx in range(idx + 1, min(idx + 4, len(texts))):
                    next_txt = texts[next_idx].strip()
                    if re.match(r"^\d{4,20}$", next_txt):
                        detected_roll = next_txt
                        logger.info(f"  🔍 Detected roll from next node: {detected_roll}")
                        break
    
    # Pattern 2: Regex on first section if still missing - MORE FLEXIBLE
    if not detected_name:
        # Try multiple patterns with varying case sensitivity
        patterns = [
            r"(?:NAME|STUDENT\s+NAME|SUBMITTED\s+BY)\s*[:–-]?\s*([A-Za-z][A-Za-z\s]{2,50})",
            r"(?:NAME|STUDENT)\s*[:–-]?\s*([a-z][a-z\s]{2,50})",  # lowercase
            r"(?:NAME|STUDENT)\s*[:–-]?\s*([A-Z][A-Z\s]{2,50})",  # uppercase
        ]
        for pattern in patterns:
            m = re.search(pattern, first_section, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip()
                # Filter out common false positives
                if len(candidate) > 2 and not candidate.isnumeric():
                    detected_name = candidate
                    confidence = "HIGH"
                    logger.info(f"  🔍 Detected name from regex: {detected_name}")
                    break
    
    if not detected_roll:
        m = re.search(r"(?:ROLL|ENROLLMENT|ID|STUDENT\s+ID|REG)\s*[:–-]?\s*(\d{4,20})", combined_text, re.IGNORECASE)
        if m:
            detected_roll = m.group(1).strip()
            logger.info(f"  🔍 Detected roll from regex (combined): {detected_roll}")
        
        if not detected_roll:
            m = re.search(r"(?:ROLL|ENROLLMENT|ID|REG)\s*[:–-]?\s*(\d{4,20})", table_text, re.IGNORECASE)
            if m:
                detected_roll = m.group(1).strip()
                logger.info(f"  🔍 Detected roll from regex (table): {detected_roll}")
    
    # If nothing found yet, do aggressive fallback on combined text
    if not detected_name or not detected_roll:
        roll_weak = re.search(r"\b(\d{4,20})\b", combined_text)
        # More flexible name pattern - any case, with special chars
        name_patterns = [
            r"\b([A-Z][a-z.'\-]+\s+[A-Z][a-z.'\-]+)\b",  # Title Case
            r"\b([A-Z][A-Z\s.'\-]+[A-Z])\b",  # UPPER CASE
            r"\b([a-z][a-z.'\-]+\s+[a-z][a-z.'\-]+)\b",  # lower case
        ]
        
        if roll_weak and not detected_roll:
            detected_roll = roll_weak.group(1)
            confidence = "MEDIUM"
            logger.info(f"  🔍 Detected roll (weak): {detected_roll}")
        
        if not detected_name:
            for pattern in name_patterns:
                name_weak = re.search(pattern, combined_text)
                if name_weak:
                    candidate = name_weak.group(1)
                    # Avoid common words
                    if len(candidate) >= 2 and candidate.lower() not in ['the', 'and', 'for', 'with', 'from', 'this', 'that']:
                        detected_name = candidate
                        confidence = "MEDIUM"
                        logger.info(f"  🔍 Detected name (weak): {detected_name}")
                        break
    
    # Determine final confidence
    if detected_name and detected_roll:
        if confidence == "MEDIUM":
            confidence = "HIGH"
    elif not detected_name and not detected_roll:
        confidence = "CLEAN"
    
    return {
        "name": detected_name,
        "roll_no": detected_roll,
        "confidence": confidence,
    }
