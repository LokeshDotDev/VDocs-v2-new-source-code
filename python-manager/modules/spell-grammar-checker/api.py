"""
Spell & Grammar Checker API

Simple FastAPI wrapper to expose spell and grammar checking functionality
for plain text via HTTP endpoints.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn
from spell_grammar_checker import process_text_node

# Initialize FastAPI app
app = FastAPI(
    title="Spell & Grammar Checker API",
    version="0.1",
    description="Check and fix spelling and grammar errors in plain text",
)

class CheckRequest(BaseModel):
    text: str = Field(..., description="The text to check")
    fix_spelling: Optional[bool] = Field(True, description="Whether to fix spelling errors")
    fix_grammar: Optional[bool] = Field(True, description="Whether to fix grammar errors")

class CheckResponse(BaseModel):
    original_text: str
    corrected_text: str
    
    class Config:
        schema_extra = {
            "example": {
                "original_text": "Thiss is a tst of the speling checker.",
                "corrected_text": "This is a test of the spelling checker.",
            }
        }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

@app.post("/check", response_model=CheckResponse)
def check_text(req: CheckRequest):
    """Check and fix spelling and grammar in text.
    
    Args:
        text: The input text to check
        fix_spelling: Whether to fix spelling errors (default: true)
        fix_grammar: Whether to fix grammar errors (default: true)
    
    Returns:
        original_text: The original text
        corrected_text: The text with corrections applied
    """
    try:
        if not req.text or not req.text.strip():
            raise HTTPException(status_code=400, detail="Text must not be empty")
        
        # Process the text
        corrected = process_text_node(
            req.text,
            fix_spell=req.fix_spelling,
            fix_gram=req.fix_grammar
        )
        
        return {
            "original_text": req.text,
            "corrected_text": corrected,
        }
    except Exception as e:
        print(f"[ERROR] Exception in /check endpoint:")
        print(f"[ERROR] Input text: {repr(req.text)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

if __name__ == "__main__":
    # Run with: python api.py
    # Or: GRAMMAR_PORT=8001 python api.py
    import os
    host = os.environ.get("GRAMMAR_HOST", "0.0.0.0")
    port = int(os.environ.get("GRAMMAR_PORT", "8001"))
    uvicorn.run(app, host=host, port=port)
