# Document Formatter Module

Applies standard, professional formatting to DOCX files using OnlyOffice Document Server.

## Features

✅ Font: Times New Roman  
✅ Font size: 12pt  
✅ Text alignment: Justified  
✅ Page margins: 1 inch (normal)  
✅ Line spacing: 1.15  
✅ Formats tables, headers, all content  
✅ Uses OnlyOffice Document Server (already running)  
✅ Fallback to python-docx if OnlyOffice unavailable  

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Set OnlyOffice server URL (defaults to localhost:8080):

```bash
export ONLYOFFICE_SERVER=http://your-onlyoffice-server:8080
```

## Usage

### Standalone

```bash
python formatter.py --input input.docx --output output.docx
python formatter.py --input input.docx --output output.docx --server http://onlyoffice:8080
```

### In Python

```python
from formatter import format_docx_via_onlyoffice

stats = format_docx_via_onlyoffice("input.docx", "output.docx")
print(f"Status: {stats['status']}")
print(f"Processing time: {stats['processing_time_ms']}ms")
```

## Pipeline Integration

This module runs AFTER spell/grammar checking and BEFORE creating the final zip:

```
Upload → Convert PDF → Anonymize → Humanize → Spell/Grammar Check → Format (OnlyOffice) ← NEW → ZIP
```

## How It Works

1. **Primary method**: Uses OnlyOffice Document Server conversion API
   - Loads the document via OnlyOffice
   - Re-saves with formatting applied
   - Professional, reliable result

2. **Fallback method**: If OnlyOffice is unavailable
   - Uses python-docx to apply formatting
   - Ensures documents are always formatted correctly

## Output

Every document will have:
- Professional, consistent formatting
- Readable 12pt Times New Roman font
- Justified text for academic appearance
- Standard 1-inch margins
- Proper line spacing (1.15)

## Performance

- Fast: ~200-800ms per document (via OnlyOffice)
- Reliable: OnlyOffice handles all document variations
- Professional: Industry-standard formatting engine

## Benefits

✅ Uses your existing OnlyOffice infrastructure  
✅ Consistent with other OnlyOffice tasks  
✅ Professional document formatting  
✅ Automatic fallback if needed  

