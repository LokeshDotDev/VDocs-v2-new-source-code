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
    """Lazy load grammar tool (it's slow to initialize)"""
    global _grammar_tool
    if _grammar_tool is None:
        _grammar_tool = language_tool_python.LanguageTool('en-US')
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


def fix_grammar(text: str) -> str:
    """
    Fix grammar errors using LanguageTool.
    Only applies safe, clear corrections.
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
        matches = tool.check(core)

        # Apply corrections in reverse order to maintain offsets
        corrected = core
        for match in reversed(matches):
            if not match.replacements:
                continue

            replacement = match.replacements[0]

            # Allow grammar and style to boost fluency/clarity, but keep guardrails
            start, end = match.offset, match.offset + match.errorLength
            original_fragment = corrected[start:end]
            if not original_fragment:
                continue

            # Allow moderate phrasing changes (up to 2x or +16 chars)
            delta = abs(len(replacement) - len(original_fragment))
            if delta > max(16, 2 * len(original_fragment)):
                continue

            corrected = corrected[:start] + replacement + corrected[end:]

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

                    # Pass 2: sentence-level grammar/style on paragraphs with a single text node (outside tables)
                    if fix_gram:
                        strong_para = os.environ.get("SPELL_GRAMMAR_STRONG_PARAGRAPH", "0") in ("1", "true", "True")
                        paragraphs = root.xpath("//w:p[not(ancestor::w:tbl)]", namespaces=NSMAP)
                        for p in paragraphs:
                            t_nodes = p.xpath(".//w:t", namespaces=NSMAP)
                            if len(t_nodes) != 1:
                                continue  # avoid disturbing multi-run formatting
                            tn = t_nodes[0]
                            if not tn.text or len(tn.text.strip()) < 5:
                                continue

                            para_original = tn.text
                            para_fixed = fix_grammar(para_original)
                            if strong_para:
                                para_fixed = fix_grammar(para_fixed)

                            if para_fixed != para_original:
                                tn.text = para_fixed
                                stats["text_nodes_modified"] += 1
                                stats["total_changes"] += 1
                    
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
