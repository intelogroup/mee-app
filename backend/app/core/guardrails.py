import re
import logging
from typing import List, Optional, Dict

logger = logging.getLogger(__name__)

BANNED_PHRASES = [
    "as an ai",
    "i'm an ai",
    "i am an ai",
    "ai assistant",
    "ai language model",
    "as an assistant",
    "i cannot",
    "it's important to note",
    "certainly!",
    "absolutely!",
    "great question",
    "here is",
    "feel free to",
    "i'm here to help",
    "my objective is",
    "for further assistance"
]

class ValidationResult:
    def __init__(self, is_valid: bool, cleaned_text: str, reason: Optional[str] = None):
        self.is_valid = is_valid
        self.cleaned_text = cleaned_text
        self.reason = reason

def enforce_length(text: str, max_sentences: int = 12) -> str:
    # Use regex to split by sentence-ending punctuation followed by whitespace
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if len(sentences) > max_sentences:
        logger.info(f"Guardrail: Truncating from {len(sentences)} to {max_sentences} sentences.")
        return " ".join(sentences[:max_sentences])
    return text

def strip_banned_phrases(text: str) -> str:
    cleaned = text
    for phrase in BANNED_PHRASES:
        if phrase in cleaned.lower():
            # Simply remove the sentence containing the banned phrase if possible
            # or replace with empty string if just a filler
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            cleaned = pattern.sub("", cleaned)
    
    # Cleanup double spaces and leading/trailing whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def enforce_question_limit(text: str, max_questions: int = 1, allow_questions: bool = True) -> str:
    if not allow_questions:
        return text.split('?')[0].strip() # Strip all questions
    if text.count('?') > max_questions:
        logger.info(f"Guardrail: Enforcing question limit ({max_questions}).")
        parts = text.split('?')
        return "?".join(parts[-max_questions-1:]) # Keep last N questions
    return text

async def validate_response(response: str, context: Dict = None) -> ValidationResult:
    """
    Main entry point for response validation.
    """
    context = context or {}
    allow_questions = context.get("allow_questions", True)
    max_sentences = context.get("max_sentences", 12)
    
    # 1. Strip banned phrases
    has_banned = any(phrase in response.lower() for phrase in BANNED_PHRASES)
    
    cleaned = strip_banned_phrases(response)
    
    # 2. Enforce length
    cleaned = enforce_length(cleaned, max_sentences=max_sentences)
    
    # 3. Enforce question limit
    cleaned = enforce_question_limit(cleaned, allow_questions=allow_questions)
    
    # 4. Clean slang excess
    cleaned = clean_slang_excess(cleaned)
    
    # Check if cleaning destroyed the response
    # Reduce limit to 2 to allow "K.", "No.", "Yo."
    if not cleaned or len(cleaned) < 2:
        return ValidationResult(False, response, "Guardrail destroyed response or response too short.")

    if has_banned:
        return ValidationResult(False, cleaned, "Banned phrases detected.")

    return ValidationResult(True, cleaned)

def clean_slang_excess(text: str) -> str:
    # Rule: Max one slang term per message (surgical strike)
    SLANG = ["!bam", "Shish!", "Ho man!", "gosh", "Bro", "man"]
    found_count = 0
    words = text.split()
    cleaned_words = []
    
    for word in words:
        if any(s.lower() == word.lower().strip(",.!?") for s in SLANG):
            found_count += 1
            if found_count > 1:
                continue # Skip extra slang
        cleaned_words.append(word)
        
    return " ".join(cleaned_words)
