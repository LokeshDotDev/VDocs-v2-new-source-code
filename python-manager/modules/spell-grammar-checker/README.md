# Spell and Grammar Checker Module

Lightweight spell and grammar correction for DOCX files without AI models.

## Features

- ✅ Spell checking using `pyspellchecker` (pure Python, no AI)
- ✅ Grammar checking using `language-tool-python` (rule-based, no AI)
- ✅ Preserves all DOCX formatting and structure
- ✅ No aggressive synonym replacement
- ✅ Only fixes clear errors
- ⚡ Lightweight and fast

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### As a standalone tool

```bash
python spell_grammar_checker.py --input input.docx --output output.docx
```

### In Python code

```python
from spell_grammar_checker import process_docx

stats = process_docx("input.docx", "output.docx")
print(f"Fixed {stats['total_changes']} errors")
```

### Options

- `--no-spell`: Disable spell checking
- `--no-grammar`: Disable grammar checking

## How It Works

1. **Spell Checking**: Uses `pyspellchecker` to find and fix misspelled words
   - Preserves capitalization
   - Skips numbers, URLs, emails
   - Only applies clear corrections

2. **Grammar Checking**: Uses `LanguageTool` for grammar fixes
   - Rule-based (not AI)
   - Only applies confident corrections
   - Preserves sentence structure

3. **DOCX Processing**:
   - Processes each text node independently
   - Skips tables (to avoid breaking structure)
   - Preserves all formatting, alignment, styles

## Integration with Pipeline

This module is integrated into the main processing pipeline after humanization:

1. Upload files
2. Convert PDF → DOCX
3. Anonymize (reductor)
4. Humanize
5. **Fix spelling & grammar** ← New step
6. Create result.zip

This ensures all output files are clean and error-free.
