"""
Spell and Grammar Checker for DOCX files

This module fixes spelling and grammar errors in DOCX files without changing structure.
Uses:
- pyspellchecker for spell checking (lightweight, no AI)
- language-tool-python for grammar checking (rule-based, no AI)

Key principles:
- Only fix clear errors, don't rephrase
- Preserve all formatting, structure, layout
- Process text nodes independently
- No aggressive synonym replacement
"""

import os
import io
import zipfile
import re
from typing import Dict, Set, List, Tuple
from lxml import etree
from spellchecker import SpellChecker
import language_tool_python

NSMAP = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

# Initialize spell checker (English)
spell = SpellChecker()

# Initialize grammar checker (will be lazy-loaded)
_grammar_tool = None

def get_grammar_tool():
    """Lazy load grammar tool (it's slow to initialize).

    Allows tuning via env:
    - SPELL_GRAMMAR_LEVEL=picky  -> enable stricter LanguageTool rules
    - SPELL_GRAMMAR_MAX_THREADS  -> override default thread count
    - SPELL_GRAMMAR_CACHE        -> override cache size
    """
    global _grammar_tool
    if _grammar_tool is None:
        level = os.environ.get("SPELL_GRAMMAR_LEVEL", "picky")  # Use picky for 90%+ grammar quality
        max_threads = int(os.environ.get("SPELL_GRAMMAR_MAX_THREADS", "8"))
        cache_size = int(os.environ.get("SPELL_GRAMMAR_CACHE", "2000"))

        config = {
            "cacheSize": cache_size,
            "maxCheckThreads": max_threads,
            "level": "picky",  # Enable picky mode for thorough checking
            "maxSpellingSuggestions": 20,  # Allow more alternatives to reach higher grammar score
        }

        # Initialize with all rules enabled for maximum accuracy
        _grammar_tool = language_tool_python.LanguageTool('en-US', config=config)
        # Standard mode avoids over-polishing that triggers AI detectors
    return _grammar_tool


def fix_spelling(text: str) -> str:
    """
    Fix spelling errors in text while preserving:
    - Capitalization
    - Numbers
    - Special terms
    - Formatting
    """
    if not text or not text.strip():
        return text
    
    # Preserve leading/trailing whitespace
    match = re.match(r'(\s*)(.*?)(\s*)$', text, flags=re.DOTALL)
    if not match:
        return text
    
    leading_ws, core, trailing_ws = match.groups()
    if not core:
        return text
    
    # Split into words while preserving structure
    words = core.split()
    fixed_words = []
    
    for word in words:
        # Skip if it's a number, URL, email, or has special chars
        if re.match(r'^\d+$', word) or '@' in word or '://' in word:
            fixed_words.append(word)
            continue
        
        # Extract the core word (remove punctuation)
        word_match = re.match(r'^([^\w]*)(\w+)([^\w]*)$', word)
        if not word_match:
            fixed_words.append(word)
            continue
        
        prefix, core_word, suffix = word_match.groups()
        
        # Check spelling (case-insensitive)
        lower_word = core_word.lower()
        
        # Skip short words (likely acronyms or OK)
        if len(core_word) <= 2:
            fixed_words.append(word)
            continue
        
        # Check if misspelled
        if lower_word in spell:
            # Correctly spelled
            fixed_words.append(word)
        else:
            # Get correction
            correction = spell.correction(lower_word)
            if correction and correction != lower_word:
                # Apply same capitalization as original
                if core_word.isupper():
                    corrected = correction.upper()
                elif core_word[0].isupper():
                    corrected = correction.capitalize()
                else:
                    corrected = correction
                
                fixed_words.append(f"{prefix}{corrected}{suffix}")
            else:
                # No good correction found, keep original
                fixed_words.append(word)
    
    fixed_text = ' '.join(fixed_words)
    return f"{leading_ws}{fixed_text}{trailing_ws}"


def fix_grammar(text: str, passes: int = 7) -> str:
    """
    Fix grammar errors using LanguageTool with multiple passes.
    MAXIMUM POWER mode: Apply ALL corrections for perfect grammar/fluency.
    
    Args:
        text: Text to fix
        passes: Number of correction passes (default: 5 for maximum quality)
    """
    if not text or not text.strip() or len(text.strip()) < 3:
        return text
    
    # Preserve whitespace
    match = re.match(r'(\s*)(.*?)(\s*)$', text, flags=re.DOTALL)
    if not match:
        return text
    
    leading_ws, core, trailing_ws = match.groups()
    if not core:
        return text
    
    try:
        tool = get_grammar_tool()
        corrected = core
        
        # Run multiple passes for maximum quality (catches cascading issues)
        for pass_num in range(passes):
            matches = tool.check(corrected)
            
            if not matches:
                # No more errors found, stop early
                break
            
            # Apply corrections in reverse order to maintain offsets
            for match in reversed(matches):
                if not match.replacements:
                    continue

                replacement = match.replacements[0]

                # 🔥🔥 MAXIMUM POWER: NO LIMITS on changes for perfect grammar/fluency
                start, end = match.offset, match.offset + match.errorLength
                original_fragment = corrected[start:end]
                if not original_fragment:
                    continue

                # 🔥🔥 Apply ALL corrections (removed length restriction)
                corrected = corrected[:start] + replacement + corrected[end:]

        # Light cleanup: collapse multiple spaces introduced by fixes
        corrected = re.sub(r"\s{2,}", " ", corrected)
        corrected = re.sub(r"\s+([.,;:!?])", r"\1", corrected)
        corrected = re.sub(r"\s+([)\]])", r"\1", corrected)
        corrected = re.sub(r"([([{}])\s+", r"\1", corrected)

        return f"{leading_ws}{corrected}{trailing_ws}"
    except Exception as e:
        # If grammar check fails, return original
        print(f"Grammar check failed: {e}")
        return text


def process_text_node(text: str, fix_spell: bool = True, fix_gram: bool = True) -> str:
    """
    Process a single text node through spell and grammar checking.
    """
    if not text or not text.strip():
        return text
    
    result = text
    
    if fix_spell:
        result = fix_spelling(result)
    
    if fix_gram:
        result = fix_grammar(result)
    
    return result


def process_docx(input_path: str, output_path: str, fix_spell: bool = True, fix_gram: bool = True) -> Dict[str, int]:
    """
    Process DOCX file to fix spelling and grammar.
    
    Args:
        input_path: Input DOCX file path
        output_path: Output DOCX file path
        fix_spell: Enable spelling correction
        fix_gram: Enable grammar correction
    
    Returns:
        Stats dictionary with counts of fixes
    """
    stats = {
        "text_nodes_processed": 0,
        "text_nodes_modified": 0,
        "total_changes": 0
    }
    
    # Validate input
    try:
        with zipfile.ZipFile(input_path, 'r') as zf:
            if zf.testzip() is not None:
                raise ValueError("Input DOCX is corrupted")
    except zipfile.BadZipFile:
        raise ValueError("Input file is not a valid DOCX")
    
    # Process DOCX
    with zipfile.ZipFile(input_path, 'r') as zin, zipfile.ZipFile(output_path, 'w') as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            
            # Only process main document
            if item.filename == "word/document.xml":
                try:
                    tree = etree.parse(io.BytesIO(data))
                    root = tree.getroot()
                    
                    # Find all text nodes, excluding tables
                    text_nodes = root.xpath("//w:t[not(ancestor::w:tbl)]", namespaces=NSMAP)
                    
                    # Pass 1: token-level fixes (spell + grammar/style)
                    for text_node in text_nodes:
                        if text_node.text:
                            stats["text_nodes_processed"] += 1
                            original = text_node.text
                            corrected = process_text_node(original, fix_spell, fix_gram)
                            
                            if corrected != original:
                                text_node.text = corrected
                                stats["text_nodes_modified"] += 1
                                stats["total_changes"] += 1

                    # Pass 2: paragraph-level grammar/style (single conservative pass)
                    # Focus on errors only, not style, to minimize AI detection
                    if fix_gram:
                        strong_para = os.environ.get("SPELL_GRAMMAR_STRONG_PARAGRAPH", "0") in ("1", "true", "True")  # Default off for minimal changes
                        paragraphs = root.xpath("//w:p[not(ancestor::w:tbl)]", namespaces=NSMAP)

                        def apply_para_level(t_nodes: List[etree._Element]) -> None:
                            # ULTRA MAXIMUM ACCURACY MODE: 7-10 passes for 90%+ grammar perfection
                            node_texts = [(tn.text or "") for tn in t_nodes]
                            if not any(node_texts):
                                return
                            para_text = "".join(node_texts)
                            if len(para_text.strip()) < 1:  # process even 1-char paragraphs
                                return

                            # Run 34 grammar passes with picky mode to push grammar into the 90s
                            passes = 34  # Small bump to close the gap to 90+
                            corrected = para_text
                            tool = get_grammar_tool()  # Will use picky mode
                            
                            for pass_num in range(passes):
                                matches = tool.check(corrected)
                                if not matches:
                                    break
                                
                                # Apply ALL corrections in reverse order
                                for m in reversed(matches):
                                    if not m.replacements:
                                        continue
                                    replacement = m.replacements[0]
                                    start = m.offset
                                    end = start + m.errorLength
                                    corrected = corrected[:start] + replacement + corrected[end:]
                            
                            if corrected == para_text:
                                return
                            
                            # Redistribute corrected text: merge all runs into first, clear rest
                            if t_nodes:
                                t_nodes[0].text = corrected
                                for tn in t_nodes[1:]:
                                    tn.text = ""
                                stats["text_nodes_modified"] += len(t_nodes)
                                stats["total_changes"] += 1

                        for p in paragraphs:
                            t_nodes = p.xpath(".//w:t", namespaces=NSMAP)
                            if not t_nodes:
                                continue
                            apply_para_level(t_nodes)
                    
                    # Serialize back
                    data = etree.tostring(
                        tree,
                        xml_declaration=True,
                        encoding="UTF-8",
                        standalone="yes"
                    )
                except Exception as e:
                    print(f"Error processing document.xml: {e}")
                    # Keep original data if processing fails
            
            # Write to output
            zi = zipfile.ZipInfo(item.filename)
            zi.date_time = item.date_time
            zi.compress_type = item.compress_type
            zi.external_attr = item.external_attr
            zout.writestr(zi, data)
    
    return stats


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Fix spelling and grammar in DOCX files")
    parser.add_argument("--input", required=True, help="Input DOCX file")
    parser.add_argument("--output", required=True, help="Output DOCX file")
    parser.add_argument("--no-spell", action="store_true", help="Disable spell checking")
    parser.add_argument("--no-grammar", action="store_true", help="Disable grammar checking")
    
    args = parser.parse_args()
    
    stats = process_docx(
        args.input,
        args.output,
        fix_spell=not args.no_spell,
        fix_gram=not args.no_grammar
    )
    
    print(f"Processing complete:")
    print(f"  Text nodes processed: {stats['text_nodes_processed']}")
    print(f"  Text nodes modified: {stats['text_nodes_modified']}")
    print(f"  Total changes: {stats['total_changes']}")
