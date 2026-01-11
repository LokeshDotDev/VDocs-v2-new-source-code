"""
Ultra-conservative DOCX humanizer:
- Processes each text node (w:t) independently
- NEVER modifies document structure, runs, or formatting
- Skips tables completely using XPath filter
- Only changes text content within existing nodes
- Preserves alignment, spacing, styles, and layout 100%

Key principle: Humanize CONTENT only, never STRUCTURE
"""

import argparse
import io
import os
import re
import zipfile
import difflib

import requests
from lxml import etree


NSMAP = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

HUMANIZER_URL = os.environ.get("HUMANIZER_URL", "http://localhost:8000/humanize")

# Tuning knobs (env-driven) for aggressiveness and safety guards
# MAXIMUM HUMANIZATION - target ~30% AI detection with aggressive transformation
# Goal: Heavily rephrase while maintaining factual accuracy
BYPASS = os.environ.get("HUMANIZER_BYPASS", "0") in ("1", "true", "True")  # default OFF - humanizer will run
AGGRESSIVE = os.environ.get("HUMANIZER_AGGRESSIVE", "1") in ("1", "true", "True")  # default ON for strongest paraphrase
HIGH_P_SYN = float(os.environ.get("HUMANIZER_P_SYN_HIGH", "0.88"))  # very aggressive synonym replacement
HIGH_P_TRANS = float(os.environ.get("HUMANIZER_P_TRANS_HIGH", "0.60"))  # aggressive transitions
MID_P_SYN = float(os.environ.get("HUMANIZER_P_SYN_LOW", "0.65"))   # moderate-high
MID_P_TRANS = float(os.environ.get("HUMANIZER_P_TRANS_LOW", "0.45"))  # moderate transitions
MAX_LEN_DELTA = float(os.environ.get("HUMANIZER_MAX_LEN_DELTA", "0.80"))  # allow 80% length variation
SIMILARITY_MAX = float(os.environ.get("HUMANIZER_SIMILARITY_MAX", "0.70"))  # allow strong transformation but keep coherence window
MAX_ATTEMPTS = int(os.environ.get("HUMANIZER_ATTEMPTS", "30"))  # more attempts for best result


def _post_json(url: str, payload: dict, timeout: int = 60) -> dict:
    resp = requests.post(url, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def _apply_casing_like(original: str, new: str) -> str:
    """Match casing style of original (ALL CAPS, Title Case, lower)."""
    o = original.strip()
    if not o:
        return new
    if o.isupper():
        return new.upper()
    # Title-like if most words are capitalized
    words = o.split()
    if words and sum(w[:1].isupper() for w in words) >= max(1, int(0.6 * len(words))):
        return " ".join(w[:1].upper() + w[1:] if w else w for w in new.split())
    if o.islower():
        return new.lower()
    return new


def _numbers_sequence(text: str) -> list:
    return re.findall(r"\d+[\d,\.]*", text)


def _length_ratio_ok(a: str, b: str, max_delta: float = MAX_LEN_DELTA) -> bool:
    la, lb = len(a), len(b)
    if la == 0:
        return True
    ratio = abs(lb - la) / la
    return ratio <= max_delta


def _changed_enough(a: str, b: str) -> bool:
    """True if paraphrase differs sufficiently from original (<= SIMILARITY_MAX)."""
    sm = difflib.SequenceMatcher(a=a, b=b)
    return sm.ratio() <= SIMILARITY_MAX


def _preserve_whitespace_shell(original: str, core: str) -> str:
    m = re.match(r"(\s*)(.*?)(\s*)$", original, flags=re.DOTALL)
    if not m:
        return core
    pre, _, post = m.groups()
    return f"{pre}{core}{post}"


def _ancestor_paragraph(text_node: etree._Element) -> etree._Element:
    p_list = text_node.xpath("ancestor::w:p[1]", namespaces=NSMAP)
    return p_list[0] if p_list else None


def _paragraph_text(p: etree._Element) -> str:
    return "".join((t.text or "") for t in p.xpath(".//w:t", namespaces=NSMAP))


def _is_question_para_text(text: str) -> bool:
    norm = " ".join((text or "").split()).lower()
    return bool(re.match(r'^q\s*\d+[\.:]*', norm)) or bool(re.match(r'^question\s+\d+', norm))


def _is_heading_paragraph(p: etree._Element) -> bool:
    styles = p.xpath("./w:pPr/w:pStyle", namespaces=NSMAP)
    if not styles:
        return False
    val = styles[0].get(f"{{{NSMAP['w']}}}val", "")
    return bool(re.search(r"heading", val, flags=re.IGNORECASE))


def _is_list_paragraph(p: etree._Element) -> bool:
    return bool(p.xpath("./w:pPr/w:numPr", namespaces=NSMAP))


def _should_humanize_text_node(text_node: etree._Element) -> bool:
    p = _ancestor_paragraph(text_node)
    if p is None:
        return False
    # Global bypass to minimize AI detection; default on
    if BYPASS:
        return False
    # Skip headings
    if _is_heading_paragraph(p):
        return False
    text = _paragraph_text(p)
    # Skip obvious question lines
    if _is_question_para_text(text):
        return False
    # Always allow list items; else require decent length
    if _is_list_paragraph(p):
        return True
    return len((text or "").strip()) >= 30  # humanize paragraphs with 30+ chars


def _humanize_text_node(text_node: etree._Element) -> None:
    """
    Humanize a single text node without touching structure.
    This preserves ALL formatting by only changing text content.
    """
    original_text = text_node.text or ""
    
    # Skip very short text (likely labels, numbers, etc.)
    if len(original_text.strip()) < 5:  # Reduced from 8 to 5
        return
    
    # Skip if it's just whitespace or special characters
    if not re.search(r'\w{2,}', original_text):  # Reduced from 3 to 2
        return
    
    import traceback
    try:
        # Strip outer whitespace, keep a shell to reapply later
        stripped = original_text.strip()
        if not stripped:
            return

        def call_humanizer(text: str, p_syn: float, p_trans: float) -> str:
            payload = {
                "text": text,
                "p_syn": p_syn,
                "p_trans": p_trans,
                "preserve_linebreaks": True,
            }
            data = _post_json(HUMANIZER_URL, payload, timeout=90)
            for key in ("human_text", "humanized_text", "text", "output", "result"):
                if key in data and isinstance(data[key], str):
                    return data[key]
            return text

        # Try aggressive first if enabled, then moderate fallback
        attempts = []
        if AGGRESSIVE:
            attempts.append((HIGH_P_SYN, HIGH_P_TRANS))
        attempts.append((MID_P_SYN, MID_P_TRANS))

        best = None
        # Try multiple times to obtain sufficiently different paraphrase
        for ps, pt in attempts:
            for _ in range(max(1, MAX_ATTEMPTS)):
                try:
                    candidate = call_humanizer(stripped, ps, pt)
                except Exception as e:
                    # Log and skip this node if a parsing error occurs
                    print(f"[ERROR] Exception in call_humanizer: {e}")
                    print(f"[ERROR] Problematic text node: {repr(original_text)}")
                    # Print XML context for debugging
                    parent = text_node.getparent()
                    if parent is not None:
                        print(f"[ERROR] Parent XML: {etree.tostring(parent, encoding='unicode', pretty_print=True)}")
                    else:
                        print("[ERROR] No parent XML context available.")
                    return  # Skip this node, continue with others
                
                if not candidate or not candidate.strip():
                    continue
                
                # Always keep at least one candidate (even if checks fail)
                if best is None:
                    best = candidate
                
                # Basic guards: length, similarity, digits preservation
                if not _length_ratio_ok(stripped, candidate, MAX_LEN_DELTA):
                    continue  # Try another, but keep 'best' if we have one
                
                # Check if changed enough (only in AGGRESSIVE mode)
                if AGGRESSIVE and not _changed_enough(stripped, candidate):
                    # Too similar, retry with same params
                    continue
                
                # Ensure numeric tokens sequence count doesn't change
                onums, nnums = _numbers_sequence(stripped), _numbers_sequence(candidate)
                if len(onums) != len(nnums):
                    # Force original numeric tokens into candidate where possible
                    if len(nnums) == 0 and len(onums) > 0:
                        # Too risky, skip
                        continue
                    # Replace in order
                    i = 0
                    def repl(m):
                        nonlocal i
                        val = onums[i] if i < len(onums) else m.group(0)
                        i += 1
                        return val
                    candidate = re.sub(r"\d+[\d,\.]*", repl, candidate)
                
                # This candidate passed all checks!
                best = candidate
                break
            if best and _changed_enough(stripped, best):
                break  # Found good candidate, stop trying

        if best and best.strip():
            # Final guard: allow stronger paraphrase but keep coherence
            if difflib.SequenceMatcher(a=stripped, b=best).ratio() < 0.55:
                return
            best = _apply_casing_like(stripped, best)
            best = _preserve_whitespace_shell(original_text, best)
            text_node.text = best

    except Exception as e:
        # If humanization fails, keep original text, log and skip
        print(f"[ERROR] Failed to humanize text node: {e}")
        print(f"[ERROR] Original text: {repr(original_text)}")
        parent = text_node.getparent()
        if parent is not None:
            print(f"[ERROR] Parent XML: {etree.tostring(parent, encoding='unicode', pretty_print=True)}")
        else:
            print("[ERROR] No parent XML context available.")
        import traceback
        traceback.print_exc()
        pass


def _process_tree(tree: etree._ElementTree, skip_detect: bool = False) -> None:
    """
    Process each text node independently to preserve exact formatting.
    Skip tables completely. Only humanize content, never structure.
    """
    # Get all text nodes that are NOT inside tables
    text_nodes = tree.xpath("//w:t[not(ancestor::w:tbl)]", namespaces=NSMAP)

    for text_node in text_nodes:
        if _should_humanize_text_node(text_node):
            _humanize_text_node(text_node)


def _should_process(name: str) -> bool:
    """Only process main document, skip headers/footers."""
    if name == "word/document.xml":
        return True
    return False


def process_docx(input_path: str, output_path: str, skip_detect: bool = False) -> None:
    """Process DOCX file."""
    import os
    import tempfile
    import shutil
    # --- Validate input DOCX before processing ---
    def is_valid_docx(path):
        try:
            with zipfile.ZipFile(path, 'r') as zf:
                return zf.testzip() is None
        except zipfile.BadZipFile:
            return False

    if not is_valid_docx(input_path):
        print(f"[ERROR] Input DOCX is corrupted: {input_path}")
        raise RuntimeError("Input DOCX file is corrupted. Aborting humanizer.")

    # Write to a temp file first, only move to output_path if valid
    with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmpfile:
        tmp_output = tmpfile.name
    try:
        with zipfile.ZipFile(input_path, "r") as zin, zipfile.ZipFile(tmp_output, "w") as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if _should_process(item.filename):
                    try:
                        tree = etree.parse(io.BytesIO(data))
                    except Exception as xml_err:
                        import traceback, tempfile
                        print(f"[XML ERROR] Failed to parse {item.filename} in {input_path}: {xml_err}")
                        tb = traceback.format_exc()
                        print(tb)
                        # Write problematic XML to a temp file for later analysis
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".xml", mode="wb") as badxml:
                            badxml.write(data)
                            print(f"[XML ERROR] Problematic XML written to: {badxml.name}")
                        raise RuntimeError(f"XML parse error in {item.filename}: {xml_err}\nTraceback:\n{tb}\nProblematic XML saved to: {badxml.name}")
                    _process_tree(tree, skip_detect=skip_detect)
                    data = etree.tostring(
                        tree,
                        xml_declaration=True,
                        encoding="UTF-8",
                        standalone="yes",
                    )
                zi = zipfile.ZipInfo(item.filename)
                zi.date_time = item.date_time
                zi.compress_type = item.compress_type
                zi.external_attr = item.external_attr
                zout.writestr(zi, data)

        # --- Validate output DOCX ---
        if not is_valid_docx(tmp_output):
            print(f"[ERROR] Output DOCX is corrupted: {tmp_output}")
            os.remove(tmp_output)
            raise RuntimeError("Humanizer produced a corrupted DOCX file.")

        shutil.move(tmp_output, output_path)
    except Exception as e:
        if os.path.exists(tmp_output):
            os.remove(tmp_output)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Humanize DOCX content - preserves ALL formatting, tables, and structure"
    )
    parser.add_argument("--input", required=True, help="Path to input DOCX")
    parser.add_argument("--output", required=True, help="Path to write modified DOCX")
    parser.add_argument(
        "--skip-detect", action="store_true", help="Skip AI detection, humanize only"
    )
    args = parser.parse_args()

    if not HUMANIZER_URL:
        raise SystemExit("HUMANIZER_URL is not set")

    process_docx(args.input, args.output, skip_detect=args.skip_detect)


if __name__ == "__main__":
    main()
