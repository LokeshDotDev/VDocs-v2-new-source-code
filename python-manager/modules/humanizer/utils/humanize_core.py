"""
Core humanization utilities - Streamlit-free version
Extracted from pages/humanize_text.py for API usage
"""
import random
import re
import ssl
import warnings
import nltk
import spacy
from nltk.tokenize import sent_tokenize, word_tokenize

warnings.filterwarnings("ignore", category=FutureWarning)

########################################
# Download needed NLTK resources
########################################
def download_nltk_resources():
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context

    resources = ['punkt', 'averaged_perceptron_tagger',
                 'punkt_tab', 'wordnet', 'averaged_perceptron_tagger_eng']
    for r in resources:
        nltk.download(r, quiet=True)

download_nltk_resources()

########################################
# Prepare spaCy pipeline
########################################
nlp = None
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("⚠️  spaCy en_core_web_sm model not found. Install with: python -m spacy download en_core_web_sm")
    print("⚠️  Proceeding without spaCy — synonym changes disabled.")

########################################
# Citation Regex
########################################
CITATION_REGEX = re.compile(
    r"\(\s*[A-Za-z&\-,\.\s]+(?:et al\.\s*)?,\s*\d{4}(?:,\s*(?:pp?\.\s*\d+(?:-\d+)?))?\s*\)"
)

########################################
# Header Detection Patterns
########################################
HEADER_PATTERNS = [
    r"^student\s+name\s*:?",
    r"^name\s*:?",
    r"^roll\s+(?:no|number|n[oó])\s*:?",
    r"^roll\s*:?",
    r"^student\s+id\s*:?",
    r"^enrollment\s+(?:no|number)\s*:?",
    r"^semester\s*:?",
    r"^course\s+name\s*:?",
    r"^course\s*:?",
    r"^subject\s*:?",
    r"^department\s*:?",
    r"^college\s*:?",
    r"^university\s*:?",
    r"^submission\s+date\s*:?",
    r"^date\s+of\s+submission\s*:?",
    r"^submitted\s+by\s*:?",
    r"^submitted\s+on\s*:?",
    r"^author\s*:?",
    r"^faculty\s*:?",
    r"^class\s*:?",
    r"^section\s*:?",
    r"^division\s*:?",
    r"^batch\s*:?",
]

HEADER_REGEX = re.compile("|".join(HEADER_PATTERNS), re.IGNORECASE)

def is_header_or_metadata(line: str) -> bool:
    """
    Check if a line is a header/metadata line that should not be humanized.
    Headers are typically short lines with labels followed by colons or values.
    """
    line_stripped = line.strip()
    
    # Skip empty lines
    if not line_stripped:
        return False
    
    # Check against header patterns
    if HEADER_REGEX.match(line_stripped):
        return True
    
    # Skip very short lines (likely headers/labels)
    if len(line_stripped) < 10:
        # But only if they end with ':' (label pattern)
        if ':' in line_stripped:
            return True
    
    return False

########################################
# Helper: Protect numeric/currency patterns
########################################
CURRENCY_PATTERN = re.compile(r'([₹$€£¥]\s*[\d,]+(?:\.\d{1,2})?)')

def protect_numbers(text):
    """Extract currency and large numbers, replace with placeholders."""
    protected = {}
    counter = [0]
    
    def replace_fn(match):
        value = match.group(0)
        # Remove any spaces within the number
        clean_value = re.sub(r'(₹|\$|€|£|¥)\s+', r'\1', value)
        clean_value = clean_value.replace(' ', '')
        placeholder = f"__NUM{counter[0]}__"
        protected[placeholder] = clean_value
        counter[0] += 1
        return placeholder
    
    modified = CURRENCY_PATTERN.sub(replace_fn, text)
    return modified, protected

def restore_numbers(text, protected):
    """Restore protected numbers/currency."""
    for placeholder, original in protected.items():
        text = text.replace(placeholder, original)
    return text

########################################
# Helper: Word & Sentence Counts
########################################
def count_words(text):
    return len(word_tokenize(text))

def count_sentences(text):
    return len(sent_tokenize(text))

########################################
# Step 1: Extract & Restore Citations
########################################
def extract_citations(text):
    refs = CITATION_REGEX.findall(text)
    placeholder_map = {}
    replaced_text = text
    for i, r in enumerate(refs, start=1):
        placeholder = f"[[REF_{i}]]"
        placeholder_map[placeholder] = r
        replaced_text = replaced_text.replace(r, placeholder, 1)
    return replaced_text, placeholder_map

PLACEHOLDER_REGEX = re.compile(r"\[\s*\[\s*REF_(\d+)\s*\]\s*\]")

def restore_citations(text, placeholder_map):
    def replace_placeholder(match):
        idx = match.group(1)
        key = f"[[REF_{idx}]]"
        return placeholder_map.get(key, match.group(0))
    restored = PLACEHOLDER_REGEX.sub(replace_placeholder, text)
    return restored

########################################
# Step 2: Expansions, Synonyms, & Transitions
########################################
WHOLE_CONTRACTIONS = {
    "can't": "cannot",
    "won't": "will not",
    "shan't": "shall not",
    "ain't": "is not",
    "i'm": "i am",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "you're": "you are",
    "he's": "he is",
    "she's": "she is",
    "we've": "we have",
    "they've": "they have",
    "i've": "i have",
    "you've": "you have",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "doesn't": "does not",
    "don't": "do not",
    "didn't": "did not",
    "wouldn't": "would not",
    "shouldn't": "should not",
    "couldn't": "could not",
    "mightn't": "might not",
    "mustn't": "must not",
    "needn't": "need not",
}

REGEX_CONTRACTIONS = [
    (r"n't\b", " not"),
    (r"'ll\b", " will"),
    (r"'ve\b", " have"),
    (r"'re\b", " are"),
    (r"'d\b", " would"),
    (r"'m\b", " am"),
]

# Contraction reintroduction map (formal → contraction)
CONTRACTION_MAP = [
    (r"\bdo not\b", "don't"),
    (r"\bdoes not\b", "doesn't"),
    (r"\bdid not\b", "didn't"),
    (r"\bcan not\b|\bcannot\b", "can't"),
    (r"\bwill not\b", "won't"),
    (r"\bwould not\b", "wouldn't"),
    (r"\bshould not\b", "shouldn't"),
    (r"\bcould not\b", "couldn't"),
    (r"\bmight not\b", "mightn't"),
    (r"\bmust not\b", "mustn't"),
    (r"\bis not\b", "isn't"),
    (r"\bare not\b", "aren't"),
    (r"\bwas not\b", "wasn't"),
    (r"\bwere not\b", "weren't"),
    (r"\bI am\b", "I'm"),
    (r"\bit is\b", "it's"),
    (r"\bwe are\b", "we're"),
    (r"\bthey are\b", "they're"),
    (r"\byou are\b", "you're"),
    (r"\bI have\b", "I've"),
    (r"\byou have\b", "you've"),
    (r"\bwe have\b", "we've"),
    (r"\bthey have\b", "they've"),
]

# Academic transition phrases are intentionally neutralized to avoid detector flags.
ACADEMIC_TRANSITIONS = []

HUMAN_PHRASES = [
    "Honestly,",
    "Frankly,",
    "To be fair,",
    "From experience,",
    "In everyday terms,",
    "If we think about it,",
    "Put simply,",
    "In plain language,",
    "In real-world practice,",
    "From a human standpoint,",
    "Speaking from experience,",
    "Basically,",
    "To put it another way,",
    "In simple terms,",
    "Looking at it practically,",
    "From what I understand,",
    "As far as I know,",
    "In my view,",
    "The way I see it,",
    "If you ask me,",
    "Generally speaking,",
]

BRIDGE_PHRASES = [
    "and in practice",
    "which means",
    "so in real terms",
    "put together",
    "taken together",
    "from a practical angle",
    "with this perspective",
    "from day-to-day experience",
    "and this",
    "which is why",
    "meaning",
    "because",
    "since",
    "and that's because",
    "which explains why",
]

CASUAL_FILLERS = [
    "basically,",
    "like,",
    "you know,",
    "I mean,",
    "right?",
    "sort of",
    "kind of",
    "pretty much",
    "honestly",
    "well,",
    "actually,",
    "really,",
]

def expand_contractions(text):
    tokens = word_tokenize(text)
    expanded = []
    for tok in tokens:
        lower_tok = tok.lower()
        if lower_tok in WHOLE_CONTRACTIONS:
            replacement = WHOLE_CONTRACTIONS[lower_tok]
            if tok[0].isupper():
                replacement = replacement.capitalize()
            expanded.append(replacement)
        else:
            replaced = tok
            for pattern, repl in REGEX_CONTRACTIONS:
                replaced = re.sub(pattern, repl, replaced, flags=re.IGNORECASE)
            expanded.append(replaced)
    return " ".join(expanded)

def get_synonym(word):
    """Radical vocabulary replacement for extreme AI evasion."""
    SAFE_MAP = {
        "utilize": ["use", "employ", "apply", "leverage", "tap into", "work with", "get the most from"],
        "obtain": ["get", "acquire", "gain", "pick up", "snag", "grab", "land"],
        "assistance": ["help", "support", "aid", "a hand", "backing"],
        "assist": ["help", "support", "aid", "back up", "give a hand"],
        "demonstrate": ["show", "illustrate", "prove", "display", "make clear", "reveal", "spell out"],
        "indicate": ["show", "suggest", "point to", "reveal", "hint at", "signal"],
        "methodology": ["method", "approach", "way", "technique", "process", "strategy"],
        "objective": ["goal", "aim", "target", "purpose", "what we're after", "end game"],
        "approximately": ["about", "around", "roughly", "nearly", "something like", "in the ballpark of"],
        "prior": ["before", "earlier", "previously", "beforehand"],
        "subsequent": ["after", "later", "following", "next", "then"],
        "terminate": ["end", "stop", "finish", "wrap up", "call it quits"],
        "commence": ["start", "begin", "kick off", "get going"],
        "therefore": ["so", "thus", "hence", "that's why", "as a result", "meaning", "which is why"],
        "however": ["but", "though", "yet", "still", "mind you", "then again"],
        "furthermore": ["also", "plus", "moreover", "besides", "on top of that", "and another thing"],
        "nevertheless": ["still", "even so", "nonetheless", "but", "yet"],
        "consequently": ["so", "as a result", "therefore", "meaning", "thus"],
        "significant": ["important", "major", "key", "notable", "big", "substantial"],
        "essential": ["crucial", "vital", "necessary", "key", "a must", "critical"],
        "fundamental": ["basic", "core", "key", "essential", "at its root", "ground level"],
        "comprehensive": ["complete", "thorough", "full", "detailed", "all-encompassing", "extensive"],
        "numerous": ["many", "several", "various", "lots of", "tons of", "heaps of"],
        "sufficient": ["enough", "adequate", "plenty", "ample"],
        "adequate": ["enough", "sufficient", "okay", "acceptable"],
        "implement": ["use", "apply", "put in place", "carry out", "execute", "make happen"],
        "facilitate": ["help", "enable", "make easier", "allow", "permit"],
        "maintain": ["keep", "preserve", "sustain", "hold onto", "stick with"],
        "ensure": ["make sure", "guarantee", "secure", "check that", "verify"],
        "establish": ["set up", "create", "form", "build", "get going"],
        "provide": ["give", "offer", "supply", "furnish", "hand over"],
        "identify": ["find", "spot", "recognize", "locate", "pick out"],
        "determine": ["find", "figure out", "decide", "work out", "establish"],
        "examine": ["look at", "check", "study", "analyze", "inspect", "size up"],
        "analyze": ["study", "examine", "look at", "break down", "dig into", "parse"],
        "evaluate": ["assess", "judge", "review", "size up", "gauge"],
        "illustrate": ["show", "demonstrate", "explain", "spell out", "make clear"],
        "require": ["need", "call for", "demand", "ask for", "want"],
        "regarding": ["about", "concerning", "on", "as for", "with respect to"],
        "concerning": ["about", "regarding", "on", "touching on"],
        "various": ["different", "several", "many", "assorted", "mixed"],
        "additionally": ["also", "plus", "besides", "on top of that", "and another thing", "further"],
        "particularly": ["especially", "notably", "in particular", "specifically"],
        "specifically": ["in particular", "especially", "to be exact", "precisely"],
        "concept": ["idea", "notion", "thought", "theory", "thing"],
        "statement": ["claim", "declaration", "assertion", "point"],
        "provides": ["gives", "offers", "supplies", "delivers"],
        "states": ["says", "claims", "argues", "points out"],
        "implies": ["suggests", "hints", "points to", "signals"],
        "data": ["info", "details", "numbers", "stuff"],
        "information": ["details", "facts", "info", "specifics", "stuff", "intel"],
        "process": ["procedure", "steps", "way", "method", "routine"],
        "system": ["setup", "structure", "network", "mechanism"],
        "creates": ["makes", "forms", "builds", "generates"],
        "helps": ["aids", "assists", "supports", "benefits"],
        "shows": ["displays", "presents", "reveals", "indicates"],
        "makes": ["creates", "produces", "generates"],
        "important": ["critical", "significant", "key", "vital"],
        "different": ["distinct", "separate", "varied", "diverse"],
        "results": ["outcomes", "conclusions", "findings", "upshots"],
        "use": ["application", "usage", "employment", "leveraging"],
        "used": ["employed", "applied", "leveraged", "put to work"],
        "way": ["manner", "approach", "method", "technique"],
        "task": ["job", "work", "duty", "responsibility"],
        "tasks": ["jobs", "work", "duties", "responsibilities"],
        "helps": ["supports", "aids", "benefits", "facilitates"],
    }
    options = SAFE_MAP.get(word.lower(), [])
    if not options:
        return None
    if random.random() < 0.85:  # Increased from 0.75
        return random.choice(options)
    return None

def replace_synonyms(text, p_syn=0.50):  # QUALITY OVER QUANTITY - 50% conservative
    """Conservative lexical replacements - quality synonyms only, avoids manipulation patterns."""
    # Numbers are already protected at pipeline level, just handle words
    words = text.split()
    out = []
    
    for word in words:
        # Skip protected placeholders, numbers, punctuation-only, or very short tokens
        if word.startswith('__NUM') or word.startswith('[[REF') or re.match(r'[\d,.₹$€£¥]+', word) or len(word) <= 2 or not any(c.isalpha() for c in word):
            out.append(word)
            continue
            
        # Strip punctuation for lookup, then restore
        clean_word = word.strip('.,;:!?()[]{}"\'')
        if not clean_word:
            out.append(word)
            continue
            
        prefix = word[:len(word)-len(word.lstrip('.,;:!?()[]{}"\'\''))]
        suffix = word[len(clean_word)+len(prefix):]
        
        candidate = get_synonym(clean_word)
        if candidate and random.random() < p_syn:
            # Preserve capitalization
            if clean_word[:1].isupper():
                candidate = candidate.capitalize()
            out.append(prefix + candidate + suffix)
        else:
            out.append(word)
    
    return " ".join(out)

def add_academic_transitions(text, p_trans=0.0):
    """Disabled: academic transitions raise detector scores."""
    return text


def reintroduce_contractions(text: str, p: float = 0.40) -> str:  # APPROPRIATE FOR ACADEMIC - 40% only
    """Selective contractions for natural tone - only where contextually appropriate."""
    out = text
    for pattern, repl in CONTRACTION_MAP:
        if random.random() < p:
            out = re.sub(pattern, repl, out, flags=re.IGNORECASE)
    return out


def punctuation_variation(text: str, p_dash: float = 0.3, p_parenthetical: float = 0.2) -> str:
    """Disabled to prevent breaking currency and numeric formatting."""
    return text


def add_casual_fillers(text: str, p: float = 0.08) -> str:
    """Add minimal natural transitions - only at clear sentence boundaries."""
    sentences = sent_tokenize(text)
    result = []
    for idx, sent in enumerate(sentences):
        stripped = sent.strip()
        words = stripped.split()
        
        # Only add to middle sentences, very rarely, at natural transition points
        if idx > 2 and idx < len(sentences) - 1 and len(words) > 12 and random.random() < p:
            # Only natural, academic-appropriate transitions
            natural_transitions = ["Additionally,", "Furthermore,", "Moreover,", "Similarly,", "However,", "Nevertheless,"]
            filler = random.choice(natural_transitions)
            result.append(f"{filler} {stripped}")
        else:
            result.append(stripped)
    return " ".join(result)


def add_fragments_and_questions(text: str, p: float = 0.02) -> str:
    """Very rarely add natural connective phrases - mostly skip."""
    sentences = sent_tokenize(text)
    result = []
    for idx, sent in enumerate(sentences):
        stripped = sent.strip()
        result.append(stripped)
        # Almost never add - only in very casual contexts
        if idx > 2 and len(sent.split()) > 18 and random.random() < p:
            # Only the most natural, academic-appropriate
            fragments = [
                "In other words,",
            ]
            if random.random() < 0.5:  # 50% chance to skip even when triggered
                result.append(random.choice(fragments))
    return " ".join(result)


def inject_human_phrases(text, p_phrase=0.12):  # Minimal - only where truly natural
    # Skip entirely for numbered or bulleted lists - avoid "1. In plain terms," artifacts
    if re.search(r'^\s*\d+[\.\)]\s+', text, re.MULTILINE):
        return text
    if re.search(r'^\s*[•\-\*]\s+', text, re.MULTILINE):
        return text
    
    sentences = sent_tokenize(text)
    result = []
    # Only use academic-appropriate phrases
    academic_phrases = [
        "In other words,",
        "That is to say,",
        "Put simply,",
        "In simpler terms,",
    ]
    
    for idx, sent in enumerate(sentences):
        stripped = sent.strip()
        words = stripped.split()

        # Skip first, last, and short sentences
        if idx == 0 or idx >= len(sentences) - 1 or len(words) <= 6 or stripped.isupper():
            result.append(stripped)
            continue

        # Very rarely add phrase, only in explanatory sections
        if random.random() < p_phrase and len(words) > 10:
            phrase = random.choice(academic_phrases)
            result.append(f"{phrase} {stripped}")
        else:
            result.append(stripped)
    return " ".join(result)


def light_sentence_restructure(text, p_split=0.75, p_merge=0.75):  # Increased from 0.65 - EXTREME
    """Aggressively restructure sentences to break AI patterns.
    BUT: Skip this entirely for numbered/bulleted lists to avoid artifacts.
    """
    # Check if text contains numbered lists (1., 2., etc.) or bullets
    if re.search(r'^\s*\d+[\.\)]\s+', text, re.MULTILINE):
        # This is a numbered list - DON'T restructure to avoid "1 since", "2 and in practice" artifacts
        return text
    if re.search(r'^\s*[•\-\*]\s+', text, re.MULTILINE):
        # Bulleted list - skip
        return text
    
    sentences = sent_tokenize(text)
    reshaped = []

    i = 0
    while i < len(sentences):
        sent = sentences[i].strip()
        if not sent:
            i += 1
            continue

        words = sent.split()

        # Split long sentences at a comma - more aggressively
        if len(words) > 15 and "," in sent and random.random() < p_split:
            parts = sent.split(",", 1)
            first = parts[0].strip()
            second = parts[1].strip()
            # Split if both parts are meaningful
            if len(first.split()) >= 3 and len(second.split()) >= 3:
                reshaped.append(first + ".")
                follow = second[:1].upper() + second[1:]
                reshaped.append(follow)
                i += 1
                continue

        # SKIP merging with BRIDGE_PHRASES - this creates "2 and in practice" artifacts
        # These artifacts are immediately flagged by AI detectors
        # Just keep sentence as-is
        reshaped.append(sent)
        i += 1

    return " ".join(reshaped)

def add_natural_imperfections(text: str, p: float = 0.15) -> str:
    """Add subtle natural variations - humans don't write perfectly uniform text."""
    sentences = sent_tokenize(text)
    result = []
    
    for sent in sentences:
        stripped = sent.strip()
        
        # Occasionally vary "that" inclusion
        if random.random() < p:
            stripped = re.sub(r'\b(believe|think|know|understand|feel)\s+that\s+', r'\1 ', stripped)
        
        # Occasionally add "that" where optional
        if random.random() < p:
            stripped = re.sub(r'\b(shows|indicates|suggests|means|implies)\s+([a-z])', r'\1 that \2', stripped)
        
        # Natural sentence starters variation
        if random.random() < p:
            if stripped.startswith("It is important to"):
                stripped = stripped.replace("It is important to", "It's important to", 1)
            elif stripped.startswith("There are"):
                if random.random() < 0.5:
                    stripped = stripped.replace("There are", "There're", 1)
        
        result.append(stripped)
    
    return " ".join(result)


def light_word_reordering(text, p=0.10):
    """Light reordering: subtle clause reordering for variety, maintain natural flow."""
    sentences = sent_tokenize(text)
    result = []
    
    for sent in sentences:
        stripped = sent.strip()
        # Only reorder very long sentences, rarely
        if len(stripped.split()) > 18 and random.random() < p:
            # Split at comma - only swap if second part is substantial
            if ", " in stripped:
                parts = stripped.split(", ", 1)
                if random.random() < 0.3 and len(parts[1].split()) > 5:
                    result.append(f"{parts[1]}, {parts[0]}")
                else:
                    result.append(stripped)
            else:
                result.append(stripped)
        else:
            result.append(stripped)
    
    return " ".join(result)


def smart_filler_injection(text, p=0.15):
    """Smart filler: light, natural interjections only where they fit."""
    sentences = sent_tokenize(text)
    result = []
    
    # Only natural, subtle fillers
    smart_fillers = [
        "Essentially, ",
        "Really, ",
        "Notably, ",
        "Importantly, ",
        "Interestingly, ",
        "Significantly, ",
    ]
    
    for idx, sent in enumerate(sentences):
        stripped = sent.strip()
        # Only add to middle/later sentences, less frequently
        if idx > 1 and len(stripped.split()) > 8 and random.random() < p:
            filler = random.choice(smart_fillers)
            result.append(filler + stripped[0].lower() + stripped[1:])
        else:
            result.append(stripped)
    
    return " ".join(result)


def aggressive_voice_conversion(text: str, p: float = 0.60) -> str:
    """Aggressively convert between passive and active voice.
    This is one of the strongest evasion techniques - changes structure drastically.
    """
    sentences = sent_tokenize(text)
    result = []
    
    for sent in sentences:
        if random.random() < p:
            # Passive to active: "X is Verbed by Y" -> "Y Verbs X"
            passive = re.search(r'(.+?)\s+is\s+(being\s+)?(\w+(?:ed|en)?)\s+by\s+(.+?)(?:[.,;!?]|$)', sent, re.IGNORECASE)
            if passive and len(sent.split()) > 6:
                obj, _, verb, subj = passive.groups()
                # Convert to active
                active = f"{subj.strip()} {verb.strip().replace('ed', '').replace('en', '')}s {obj.strip()}"
                result.append(active)
                continue
            
            # Active to passive: "Y Verbs X" -> "X is Verbed by Y"
            active = re.search(r'^(.+?)\s+(\w+)s?\s+(.+?)(?:[.,;!?]|$)', sent)
            if active and len(sent.split()) > 6 and random.random() < 0.5:
                subj, verb, obj = active.groups()
                if verb.lower() not in ['is', 'was', 'are', 'were', 'be', 'being']:
                    passive = f"{obj.strip()} is {verb.strip()}ed by {subj.strip()}"
                    result.append(passive)
                    continue
        
        result.append(sent)
    
    return " ".join(result)


def aggressive_clause_reordering(text: str, p: float = 0.65) -> str:
    """Aggressively reorder clauses, changing sentence structure dramatically."""
    sentences = sent_tokenize(text)
    result = []
    
    for sent in sentences:
        if random.random() < p and len(sent.split()) > 10:
            # Split on conjunctions and reorder
            for conj in [', and ', ', but ', ', since ', ', because ', ', when ', ', if ']:
                if conj in sent:
                    parts = sent.split(conj)
                    if len(parts) == 2 and len(parts[0].split()) > 3 and len(parts[1].split()) > 3:
                        # Randomly reorder
                        if random.random() < 0.5:
                            reordered = f"{parts[1].strip()}{conj.rstrip()}, {parts[0].strip()}"
                        else:
                            reordered = f"{parts[1].strip()}. {parts[0].strip()}"
                        result.append(reordered)
                        break
            else:
                result.append(sent)
        else:
            result.append(sent)
    
    return " ".join(result)


def aggressive_sentence_merging(text: str, p: float = 0.55) -> str:
    """Merge short consecutive sentences to vary length distribution."""
    sentences = sent_tokenize(text)
    result = []
    i = 0
    
    while i < len(sentences):
        sent = sentences[i].strip()
        if i + 1 < len(sentences) and random.random() < p:
            next_sent = sentences[i + 1].strip()
            words_curr = len(sent.split())
            words_next = len(next_sent.split())
            
            # Merge if both are short
            if 4 < words_curr < 12 and 4 < words_next < 12:
                # Choose connector
                connector = random.choice([', and ', '; ', '. Furthermore, ', '. As a result, '])
                merged = f"{sent.rstrip('.')} {connector} {next_sent[0].lower()}{next_sent[1:]}"
                result.append(merged)
                i += 2
                continue
        
        result.append(sent)
        i += 1
    
    return " ".join(result)


def semantic_sentence_restructure(text: str, p: float = 0.50) -> str:
    """Restructure sentences semantically - change passive to active voice and vice versa.
    This breaks AI detector patterns without obvious word-level manipulation.
    """
    sentences = sent_tokenize(text)
    result = []
    
    for sent in sentences:
        if random.random() < p and len(sent.split()) > 8:
            # Try to convert passive voice to active or restructure
            # Pattern: "X is Verbed by Y" -> "Y Verbs X"
            passive_match = re.search(r'(.+?)\s+is\s+(\w+)ed?\s+by\s+(.+?)(?:[.,;!?]|$)', sent, re.IGNORECASE)
            if passive_match:
                obj, verb, subj = passive_match.groups()
                # Reconstruct as active voice
                active = f"{subj.strip()} {verb.strip()} {obj.strip()}"
                result.append(active)
                continue
        
        result.append(sent)
    
    return " ".join(result)


def multi_pass_transform(text: str, passes: int = 2) -> str:
    """Apply all transformations multiple times to drastically change text.
    Each pass applies different transforms in random order.
    """
    out = text
    
    for pass_num in range(passes):
        # Structural transformations - MINIMAL probabilities to preserve grammar for 90+ score
        out = aggressive_voice_conversion(out, p=0.15)
        out = aggressive_clause_reordering(out, p=0.15)
        out = aggressive_sentence_merging(out, p=0.10)
        
        # Paraphrasing and synonyms - reduced
        out = phrase_level_paraphrase(out, p=0.35)
        out = domain_paraphrase(out, p=0.35)
        out = replace_synonyms(out, p_syn=0.25)
        
        # Apply grammar fix in the middle of transformations
        out = grammar_post_process(out)
        
        # Contractions and variations - reduced
        out = reintroduce_contractions(out, p=0.25)
        out = add_natural_imperfections(out, p=0.08)
    
    return out
    
    return out


def advanced_phrase_restructure(text: str, p: float = 0.50) -> str:
    """Advanced phrase restructuring - reorder clauses, change emphasis, restructure meaning delivery."""
    RESTRUCTURES = [
        # Subject-first to result-first
        (r"(.+?)\s+enables\s+(.+?)", r"\2 can happen because of \1"),
        (r"(.+?)\s+allows\s+(.+?)", r"\2 is possible through \1"),
        (r"(.+?)\s+facilitates\s+(.+?)", r"\2 becomes easier with \1"),
        # Clause reordering
        (r"although\s+(.+?),\s+(.+?)", r"\2; nevertheless, \1"),
        (r"because\s+(.+?),\s+(.+?)", r"\2 as a result of \1"),
        (r"when\s+(.+?),\s+(.+?)", r"\2 happens in cases where \1"),
        # Comparison restructuring
        (r"(.+?)\s+is\s+(.+?)\s+as\s+(.+?)", r"compared to \3, \1 is \2"),
    ]
    
    out = text
    for pattern, replacement in RESTRUCTURES:
        if random.random() < p:
            out = re.sub(pattern, replacement, out, flags=re.IGNORECASE)
    
    return out



    """Smart aggressive vocabulary: meaningful synonyms only (no garbage replacements)."""
    # Only use GOOD synonyms that maintain meaning and sound natural
    smart_map = {
        'information': ['details', 'specifics', 'data', 'facts', 'insights', 'knowledge'],
        'technology': ['systems', 'tech', 'tools', 'technology', 'solutions', 'platforms', 'methods'],
        'provides': ['offers', 'delivers', 'gives', 'furnishes', 'supplies'],
        'enable': ['allow', 'facilitate', 'permit', 'make possible', 'let', 'support', 'help'],
        'resources': ['tools', 'assets', 'capabilities', 'resources', 'materials', 'means'],
        'capability': ['ability', 'capacity', 'strength', 'capability', 'potential'],
        'creation': ['formation', 'establishment', 'building', 'development', 'construction'],
        'efficiently': ['effectively', 'well', 'smoothly', 'efficiently', 'properly'],
        'important': ['key', 'vital', 'critical', 'essential', 'major', 'central', 'pivotal'],
        'various': ['multiple', 'several', 'many', 'numerous', 'varied', 'assorted'],
        'shows': ['reveals', 'indicates', 'suggests', 'points to', 'highlights', 'demonstrates'],
        'includes': ['has', 'features', 'encompasses', 'involves', 'comprises', 'contains'],
        'requires': ['calls for', 'demands', 'takes', 'needs', 'necessitates'],
        'understand': ['grasp', 'comprehend', 'get', 'see', 'know', 'realize'],
        'different': ['varied', 'diverse', 'distinct', 'separate', 'various'],
    }
    
    words = text.split()
    result = []
    
    for word in words:
        clean = word.strip('.,;:!?()[]{}"\'')
        if clean.lower() in smart_map and random.random() < p:
            options = smart_map[clean.lower()]
            replacement = random.choice(options)
            if clean[0].isupper():
                replacement = replacement.capitalize()
            result.append(replacement)
        else:
            result.append(word)
    
    return " ".join(result)


def phrase_level_paraphrase(text: str, p: float = 0.70) -> str:  # Increased from 0.60
    """Targeted academic→colloquial phrase paraphrasing to break detector patterns.
    Applies only high-confidence phrase rewrites and keeps meaning intact.
    """
    PHRASES = [
        (r"has become an integral part of", ["is now a core part of", "has become central to", "is a key part of", "is now fundamental to"]),
        (r"is essential for", ["is important for", "matters for", "is critical to", "is vital for", "is key to"]),
        (r"on\-demand computing resources", ["computing resources on demand", "resources available on demand", "resources when you need them"]),
        (r"enabling organizations to", ["so organizations can", "which lets organizations", "allowing organizations to", "helping organizations"]),
        (r"the primary benefits", ["the main benefits", "the key benefits", "what you mainly get", "the chief advantages"]),
        (r"enhancement of", ["improving", "boosting", "increase in", "bettering"]),
        (r"thereby reducing", ["which reduces", "and that reduces", "that ends up reducing", "cutting down on"]),
        (r"virtualization technology enables the creation of", ["virtualization lets you create", "with virtualization you can create", "virtualization helps create"]),
        (r"cost\-effective IT infrastructure", ["cost\-efficient IT setup", "IT infrastructure that saves money", "affordable IT infrastructure"]),
        (r"in order to", ["to", "so that", "for"]),
        (r"due to the fact that", ["because", "since", "as"]),
        (r"a number of", ["several", "some", "many"]),
        (r"at the present time", ["now", "currently", "at present"]),
        (r"in the event that", ["if", "should", "when"]),
    ]
    out = text
    for pattern, options in PHRASES:
        if random.random() < p:
            repl = random.choice(options)
            out = re.sub(pattern, repl, out, flags=re.IGNORECASE)
    return out


def domain_paraphrase(text: str, p: float = 0.70) -> str:
    """Broader domain paraphrasing for academic/business/CS content.
    Applies natural rewordings across common textbook phrasing while preserving meaning.
    Uses case-insensitive matching with smart capitalization preservation.
    """
    def smart_replace(match_obj, replacements):
        """Replace while preserving original capitalization style."""
        original = match_obj.group(0)
        replacement = random.choice(replacements)
        
        # If original starts with uppercase, capitalize replacement
        if original[0].isupper():
            replacement = replacement[0].upper() + replacement[1:] if len(replacement) > 1 else replacement.upper()
        
        return replacement
    
    PAIRS = [
        # General academic
        (r"in detail", ["in depth", "thoroughly", "with depth"]),
        (r"with suitable examples", ["with clear examples", "with fitting examples", "with relevant examples"]),
        (r"discuss(ed)? below", ["explained below", "outlined below", "covered below"]),
        (r"basic rules and assumptions", ["core rules and assumptions", "fundamental rules and assumptions"]),
        (r"ensure consistency, reliability, and comparability", ["promote consistency, reliability, and comparability", "help keep things consistent, reliable, and comparable"]),
        (r"This concept states that", ["This principle says", "This idea says", "It says"]),
        (r"According to this concept", ["Under this idea", "By this concept", "With this principle"]),
        (r"Money Measurement Concept", ["Money Measurement Principle"]),
        (r"Going Concern Concept", ["Going Concern Principle"]),
        (r"Cost Concept", ["Cost Principle"]),
        (r"Dual Aspect Concept", ["Dual Aspect Principle", "Double-entry principle"]),
        (r"Accounting Period Concept", ["Accounting Period Principle"]),
        (r"Matching Concept", ["Matching Principle"]),
        (r"Realisation Concept", ["Realization Principle"]),
        (r"Accrual Concept", ["Accrual Principle"]),
        (r"Consistency Concept", ["Consistency Principle"]),
        (r"Example:\s*", ["For instance: ", "E.g.: ", "Say: "]),
        (r"This ensures", ["This helps ensure", "This makes sure", "This helps"],),
        (r"forms the basis of", ["underpins", "is the basis of", "is foundational to"]),
        (r"divided into specific periods", ["split into set periods", "broken into defined periods"]),
        (r"Expenses should be matched with the revenue they help to generate", ["Match expenses with the revenue they bring", "Expenses should line up with related revenue"]),
        (r"Revenue should be recorded only when it is earned", ["Record revenue only once it's earned", "Record revenue when earned"]),
        (r"Revenues and expenses must be recorded when they occur", ["Record revenues and expenses when they happen", "Record them when they occur"]),
        (r"Conclusion", ["In summary", "To sum up", "In closing"]),
        # Accounting process
        (r"systematic series of steps", ["set of steps", "structured set of steps"]),
        (r"book of original entry", ["first record book", "primary entry book"]),
        (r"double\-entry system", ["double entry system"]),
        (r"Trial Balance", ["trial balance"]),
        (r"adjusting entries", ["adjustments", "adjustment entries"]),
        (r"Profit and Loss Account", ["Profit & Loss Account", "P&L Account"]),
        (r"Balance Sheet", ["balance sheet"]),
        # Shares section
        (r"Equity Shares \(Ordinary Shares\)", ["Equity shares (ordinary)"]),
        (r"Preference Shares", ["Preference shares"]),
        (r"dividends", ["payouts", "dividend payments"]),
        (r"rights shares", ["rights issue shares"]),
        # Office automation
        (r"refers to the use of", ["means using", "is about using"]),
        (r"in simpler terms", ["put simply", "in plain terms"]),
        (r"key components", ["main components", "core components"]),
        (r"increased efficiency", ["higher efficiency", "better efficiency"]),
        (r"cost savings", ["lower costs", "saving costs"]),
        (r"communication has also improved greatly", ["communication has improved a lot"]),
        # Excel sorting
        (r"Meaning of Sorting", ["What sorting means"]),
        (r"Types of Sorting", ["Kinds of sorting"]),
        (r"Single\-level sorting", ["Single level sorting"]),
        (r"Multi\-level sorting", ["Multi level sorting"]),
        (r"Importance of Sorting", ["Why sorting matters"]),
        # Input vs output
        (r"In summary, input and output devices", ["To sum up, input and output devices"]),
        # System vs application software
        (r"System Software", ["system software"]),
        (r"Application Software", ["application software"]),
        (r"Difference Between System and Application Software", ["System vs Application Software"]),
        # SDLC
        (r"Software Development Life Cycle \(SDLC\)", ["SDLC (Software Development Life Cycle)"]),
        (r"Requirement Analysis", ["Requirements analysis"]),
        (r"System Design", ["Design"]),
        (r"Implementation \(Coding\)", ["Implementation (coding)"]),
        (r"User Acceptance Testing \(UAT\)", ["user acceptance testing (UAT)"]),
        (r"Maintenance", ["maintenance"]),
    ]
    out = text
    for pattern, options in PAIRS:
        if random.random() < p:
            out = re.sub(pattern, lambda m: smart_replace(m, options), out, flags=re.IGNORECASE)
    return out


def minimal_rewriting(text, p_syn=0.50, p_trans=0.0):  # ZERO DETECTION APPROACH
    """Multi-pass aggressive transformation for near-0% AI detection.
    Uses semantic restructuring, voice conversion, and clause reordering.
    """
    # Protect numbers and citations FIRST
    protected_text, num_map = protect_numbers(text)
    core, refs = extract_citations(protected_text)

    # Apply MULTI-PASS transformation - this is key to 0% detection
    out = multi_pass_transform(core, passes=2)
    
    # Additional pass: aggressive contractions and imperfections
    out = reintroduce_contractions(out, p=0.55)
    out = add_natural_imperfections(out, p=0.20)
    out = grammar_post_process(out)
    
    # Restore in reverse order: citations then numbers
    out = restore_citations(out, refs)
    out = restore_numbers(out, num_map)
    return out

    random.shuffle(transforms)
    out = core
    for t in transforms:
        out = t(out)

    # Restore in reverse order: citations then numbers
    out = restore_citations(out, refs)
    out = restore_numbers(out, num_map)
    return out

def preserve_linebreaks_rewrite(text, p_syn=0.50, p_trans=0.0):  # ZERO DETECTION APPROACH
    """
    Multi-pass semantic rewrite with line break preservation.
    Applies aggressive semantic transformations for near-0% detection.
    """
    lines = text.split("\n")
    rewritten_lines = []
    for line in lines:
        if line.strip():
            # Check if this is a header/metadata line
            if is_header_or_metadata(line):
                rewritten_lines.append(line)
            else:
                # Protect numbers and citations FIRST
                protected_line, num_map = protect_numbers(line)
                core, refs = extract_citations(protected_line)
                
                # Multi-pass transformation on this line
                out = multi_pass_transform(core, passes=2)
                out = reintroduce_contractions(out, p=0.30)
                out = add_natural_imperfections(out, p=0.10)
                # Apply grammar fixes 4 TIMES for maximum grammar score
                out = grammar_post_process(out)
                out = grammar_post_process(out)
                out = grammar_post_process(out)
                out = grammar_post_process(out)
                
                # Restore citations and numbers
                line = restore_citations(out, refs)
                line = restore_numbers(line, num_map)
                rewritten_lines.append(line)
        else:
            rewritten_lines.append(line)
    return "\n".join(rewritten_lines)


def grammar_post_process(text: str) -> str:
    """Comprehensive grammar cleanup for 90+ grammar score.
    - Fix punctuation spacing and duplicates
    - Extensive subject–verb agreement
    - Article correction (a/an) with exceptions
    - Sentence capitalization
    - Common grammar fixes
    - Normalize quotes and whitespace
    """
    if not text:
        return text

    # Protect currency/numbers from spacing fixes
    protected_text, num_map = protect_numbers(text)

    def normalize_quotes(s: str) -> str:
        s = s.replace("\u2018", "'").replace("\u2019", "'")
        s = s.replace("\u201C", '"').replace("\u201D", '"')
        s = s.replace("\u00A0", " ")  # NBSP to space
        return s

    def fix_punct_spacing(s: str) -> str:
        # remove spaces before punctuation (but skip protected placeholders)
        s = re.sub(r"\s+([\.,;:?!])", r"\1", s)
        # ensure single space after punctuation if followed by word (not placeholder)
        s = re.sub(r"([\.,;:?!])(?![_\s]|$)", r"\1 ", s)
        # parentheses spacing cleanup
        s = re.sub(r"\(\s+", "(", s)
        s = re.sub(r"\s+\)", ")", s)
        # Fix hyphen spacing
        s = re.sub(r"(\w)\s+-\s+(\w)", r"\1-\2", s)
        # Fix quotation mark spacing
        s = re.sub(r'"\s+', '"', s)
        s = re.sub(r'\s+"', '"', s)
        return s

    def dedupe_punct(s: str) -> str:
        # reduce multiple exclamations/questions/commas
        s = re.sub(r"!{2,}", "!", s)
        s = re.sub(r"\?{2,}", "?", s)
        s = re.sub(r",{2,}", ",", s)
        # dots: keep ellipses, reduce 4+ to 3
        s = re.sub(r"\.{4,}", "...", s)
        # rare: double period to single when not ellipsis
        s = re.sub(r"(?<!\.)\.{2}(?!\.)", ".", s)
        return s

    def fix_articles(s: str) -> str:
        EX_A = {"university","user","european","one","unique","unit","unilateral","ubiquitous","use","usual","u.s.","eulogy","uniform","union"}
        EX_AN = {"hour","honest","honor","heir","herb","nba","fbi","mba"}
        def repl(m):
            art = m.group(1)
            word = m.group(2)
            lw = word.lower()
            use_an = lw[:1] in "aeiou"
            if lw in EX_A:
                use_an = False
            if lw in EX_AN:
                use_an = True
            desired = "an" if use_an else "a"
            if art[0].isupper():
                desired = desired.capitalize()
            return f"{desired} {word}"
        # swap only when clearly mismatched
        s = re.sub(r"\b([Aa]n?)\s+([A-Za-z][A-Za-z\.-]*)", repl, s)
        return s

    def fix_agreement(s: str) -> str:
        # Extensive subject-verb agreement fixes
        s = re.sub(r"\b([Hh]e|[Ss]he|[Ii]t)\s+are\b", lambda m: f"{m.group(1)} is", s)
        s = re.sub(r"\b([Hh]e|[Ss]he|[Ii]t)\s+were\b", lambda m: f"{m.group(1)} was", s)
        s = re.sub(r"\b([Hh]e|[Ss]he|[Ii]t)\s+have\b", lambda m: f"{m.group(1)} has", s)
        s = re.sub(r"\b([Hh]e|[Ss]he|[Ii]t)\s+do\b", lambda m: f"{m.group(1)} does", s)
        s = re.sub(r"\b([Tt]his|[Tt]hat)\s+are\b", lambda m: f"{m.group(1)} is", s)
        s = re.sub(r"\b([Tt]his|[Tt]hat)\s+have\b", lambda m: f"{m.group(1)} has", s)
        s = re.sub(r"\b([Tt]hey|[Ww]e|[Yy]ou)\s+was\b", lambda m: f"{m.group(1)} were", s)
        s = re.sub(r"\b([Tt]hey|[Ww]e|[Yy]ou)\s+has\b", lambda m: f"{m.group(1)} have", s)
        s = re.sub(r"\b([Tt]hey|[Ww]e)\s+does\b", lambda m: f"{m.group(1)} do", s)
        
        # Additional common patterns
        s = re.sub(r"\b([Ee]veryone|[Ee]verybody|[Ss]omeone|[Ss]omebody|[Nn]obody|[Aa]nyone|[Aa]nybody|[Ee]ach)\s+are\b", lambda m: f"{m.group(1)} is", s)
        s = re.sub(r"\b([Ee]veryone|[Ee]verybody|[Ss]omeone|[Ss]omebody|[Nn]obody|[Aa]nyone|[Aa]nybody|[Ee]ach)\s+have\b", lambda m: f"{m.group(1)} has", s)
        s = re.sub(r"\b([Ee]veryone|[Ee]verybody|[Ss]omeone|[Ss]omebody|[Nn]obody|[Aa]nyone|[Aa]nybody|[Ee]ach)\s+do\b", lambda m: f"{m.group(1)} does", s)
        
        # Fix "there is/are" patterns
        s = re.sub(r"\bthere\s+is\s+([a-z]+\s+)?(?:people|things|items|students|many|several)", "there are", s, flags=re.IGNORECASE)
        s = re.sub(r"\bthere\s+are\s+(?:a|an|one)\s+", "there is ", s, flags=re.IGNORECASE)
        
        return s
    
    def fix_common_errors(s: str) -> str:
        """Fix commonly confused words and phrases"""
        # Its vs it's
        s = re.sub(r"\bits\s+(going|been|is|was|are|were)", "it's \\1", s, flags=re.IGNORECASE)
        s = re.sub(r"\bit's\s+(own|features|benefits|advantages|disadvantages|purpose|characteristics|properties)", "its \\1", s, flags=re.IGNORECASE)
        
        # Your vs you're
        s = re.sub(r"\byour\s+(going|being|been|is|was|are|were|have|has)", "you're \\1", s, flags=re.IGNORECASE)
        
        # Their vs they're vs there
        s = re.sub(r"\btheir\s+(going|being|been|is|was|are|were|have|has)", "they're \\1", s, flags=re.IGNORECASE)
        s = re.sub(r"\bthey're\s+(own|house|car|opinion|perspective|responsibility|property)", "their \\1", s, flags=re.IGNORECASE)
        
        # Then vs than
        s = re.sub(r"\bthen\s+(more|less|better|worse|bigger|smaller|higher|lower|greater|fewer|stronger)", "than \\1", s, flags=re.IGNORECASE)
        
        # Affect vs effect (basic cases)
        s = re.sub(r"\baffect\s+(?:is|was|are|were|has|had|can|will)", "effect", s, flags=re.IGNORECASE)
        
        # Could of -> could have
        s = re.sub(r"\b(could|would|should|might|may|must)\s+of\b", "\\1 have", s, flags=re.IGNORECASE)
        
        # Double negatives
        s = re.sub(r"\bdon't\s+need\s+no\b", "don't need any", s, flags=re.IGNORECASE)
        s = re.sub(r"\bcan't\s+get\s+no\b", "can't get any", s, flags=re.IGNORECASE)
        s = re.sub(r"\bain't\s+got\s+no\b", "don't have any", s, flags=re.IGNORECASE)
        
        # Who vs whom (basic pattern)
        s = re.sub(r"\bwhom\s+(is|was|are|were|has|have|do|does|can|will)", "who \\1", s, flags=re.IGNORECASE)
        
        # Me vs I in compound subjects
        s = re.sub(r"\b(me and [A-Z]\w+|[A-Z]\w+ and me)\s+(is|are|was|were|will|can|should|have)", lambda m: m.group(0).replace("me", "I"), s)
        
        # Less vs fewer
        s = re.sub(r"\bless\s+(people|items|things|students|workers|children|cars|houses)", "fewer \\1", s, flags=re.IGNORECASE)
        
        # Good vs well
        s = re.sub(r"\b(did|done|performed|works|functions)\s+good\b", "\\1 well", s, flags=re.IGNORECASE)
        
        return s
    
    def ultra_aggressive_grammar_fix(s: str) -> str:
        """Ultra-aggressive grammar fixes for transformation artifacts"""
        if not s:
            return s
        
        # Fix common transformation artifacts
        # Fix broken sentence fragments with lowercase after period
        s = re.sub(r'\.(\s+)([a-z])', lambda m: f'.{m.group(1)}{m.group(2).upper()}', s)
        
        # Fix missing subjects (common transformation artifact)
        # "was changed the" -> "was changed the" stays same but catch weird patterns
        s = re.sub(r'(\w+)\s+(was|were|is|are)\s+(been|being)', r'\1 \2', s, flags=re.IGNORECASE)
        
        # Fix double verbs (transformation artifact)
        s = re.sub(r'\b(is|are|was|were)\s+(is|are|was|were)\b', lambda m: m.group(1), s, flags=re.IGNORECASE)
        
        # Fix dangling prepositions and incomplete phrases
        s = re.sub(r'\b(to|in|on|at|by|from|with|for|about)\s+$', '', s)
        
        # Fix multiple spaces
        s = re.sub(r'  +', ' ', s)
        
        # Fix missing articles before nouns
        s = re.sub(r'\b(many|several|some|few)\s+([A-Z])', r'\1 the \2', s)
        
        # Fix subject-verb mismatches from transformations
        s = re.sub(r'\bthey\s+(is|was|has|does|do)\b', lambda m: m.group(0).replace(m.group(1), {'is':'are','was':'were','has':'have','does':'do','do':'do'}.get(m.group(1), m.group(1))), s, flags=re.IGNORECASE)
        s = re.sub(r'\b(he|she|it)\s+(are|were|have|do|does|do)\b', lambda m: m.group(0).replace(m.group(1), {'are':'is','were':'was','have':'has','do':'does','does':'does','do':'does'}.get(m.group(2), m.group(2))), s, flags=re.IGNORECASE)
        
        # Fix incomplete or malformed comparatives
        s = re.sub(r'\b(more|less)\s+(more|less|most|least)', lambda m: m.group(1), s, flags=re.IGNORECASE)
        
        # Fix tense inconsistencies
        s = re.sub(r'\b(is|are|was|were)\s+going\s+(\w+ed)\b', lambda m: f'{m.group(1)} {m.group(2)[:-2]}', s, flags=re.IGNORECASE)
        
        # Remove trailing incomplete phrases
        s = re.sub(r'\s+(which|that|and|or|but)\s*$', '', s)
        
        # Fix weird conjunction patterns
        s = re.sub(r'\b(and|or|but)\s+(and|or|but)\b', lambda m: m.group(1), s, flags=re.IGNORECASE)
        
        return s
    
    def fix_capitalization(s: str) -> str:
        """Fix sentence capitalization"""
        # Capitalize after period, question mark, exclamation
        def cap_after_punct(m):
            return m.group(1) + m.group(2).upper() + m.group(3)
        
        s = re.sub(r'([\.\?!]\s+)([a-z])(\w*)', cap_after_punct, s)
        
        # Capitalize first letter of string if it's lowercase
        if s and s[0].islower():
            s = s[0].upper() + s[1:]
        
        # Fix lowercase "i" when used as pronoun (more comprehensive)
        s = re.sub(r"\bi\s+", "I ", s)
        s = re.sub(r"\si\s+", " I ", s)
        s = re.sub(r"\si$", " I", s)
        s = re.sub(r"^i\s+", "I ", s)
        s = re.sub(r"\s+i,", " I,", s)
        s = re.sub(r"\s+i\.", " I.", s)
        
        return s
    
    def fix_verb_forms(s: str) -> str:
        """Fix common verb form errors"""
        # Have/has + past participle corrections
        s = re.sub(r"\bhave\s+ran\b", "have run", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+ran\b", "has run", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhave\s+saw\b", "have seen", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+saw\b", "has seen", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhave\s+did\b", "have done", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+did\b", "has done", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhave\s+began\b", "have begun", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+began\b", "has begun", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhave\s+went\b", "have gone", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+went\b", "has gone", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhave\s+ate\b", "have eaten", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+ate\b", "has eaten", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhave\s+wrote\b", "have written", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+wrote\b", "has written", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhave\s+spoke\b", "have spoken", s, flags=re.IGNORECASE)
        s = re.sub(r"\bhas\s+spoke\b", "has spoken", s, flags=re.IGNORECASE)
        
        return s
    
    def fix_prepositions(s: str) -> str:
        """Fix common preposition errors"""
        # Different from/than
        s = re.sub(r"\bdifferent\s+than\b", "different from", s, flags=re.IGNORECASE)
        
        # On accident -> by accident
        s = re.sub(r"\bon\s+accident\b", "by accident", s, flags=re.IGNORECASE)
        
        # Off of -> off
        s = re.sub(r"\boff\s+of\b", "off", s, flags=re.IGNORECASE)
        
        # Where at -> where
        s = re.sub(r"\bwhere\s+at\b", "where", s, flags=re.IGNORECASE)
        
        return s

    def collapse_spaces(s: str) -> str:
        # collapse tabs and multiple spaces; preserve line breaks
        s = re.sub(r"[ \t]{2,}", " ", s)
        # trim spaces around line edges
        s = re.sub(r"[ \t]+\n", "\n", s)
        s = re.sub(r"\n[ \t]+", "\n", s)
        return s

    def reduce_adjacent_duplicate_words(s: str) -> str:
        # Remove immediate duplicate words like "stuff stuff" but preserve rare valid cases
        exceptions = {"had had", "that that"}
        def repl(m):
            pair = f"{m.group(1).lower()} {m.group(1).lower()}"
            if pair in exceptions:
                return m.group(0)
            return m.group(1)
        return re.sub(r"\b([A-Za-z]{3,})\b(?:\s+\1\b)+", repl, s, flags=re.IGNORECASE)

    def reduce_leading_filler_chains(s: str) -> str:
        # Remove awkward mid-sentence phrase injections and manipulation artifacts
        # Fix patterns like "2 from a practical angle money" or "E. g and in practice:"
        
        # CRITICAL: Fix numbered list artifacts - "3 and in practice", "1 since", "4 which is why"
        # These are obvious manipulation patterns that detectors flag immediately
        s = re.sub(r'(\d+)\s+(and in practice|since|which is why|which explains why|meaning|from a practical angle|so in real terms|and this|put together)\s+', r'\1. ', s, flags=re.IGNORECASE)
        
        # Remove mid-sentence phrase injections that break flow
        s = re.sub(r'\b(and this|so in real terms|put together|if you ask me|from a practical angle|which explains why|meaning|which means|and that\'s because)\s+', ' ', s, flags=re.IGNORECASE)
        
        # Fix broken numbering patterns: "2 from a practical angle money" → "2."
        s = re.sub(r'(\d+)\s+[a-z]+\s+[a-z]+\s+[a-z]+\s+[a-z]+\s+([A-Z])', r'\1. \2', s)
        s = re.sub(r'(\d+)\s+[a-z]+\s+[a-z]+\s+[a-z]+\s+([A-Z])', r'\1. \2', s)
        s = re.sub(r'(\d+)\s+[a-z]{3,}\s+([a-z]{3,})\s+([A-Z])', r'\1. \3', s)  # "1 since office" → "1. Office"
        
        # Fix broken examples: "E. g and in practice:" → "Example:"
        s = re.sub(r'E\.\s*g\.?\s+and\s+[a-z\s,]+:', 'Example:', s, flags=re.IGNORECASE)
        s = re.sub(r'E\.\s*g\.?\s*[a-z\s,]+:', 'Example:', s, flags=re.IGNORECASE)
        s = re.sub(r'E\.\s*g\.?\s+[a-z\s,]+', 'For example,', s, flags=re.IGNORECASE)
        
        # Fix capital letter after period mid-word: ". Software" → ", software"
        s = re.sub(r'\.(\s+)([A-Z])([a-z]+,)', r',\1\2\3', s)
        
        # Clean up awkward phrase remnants
        s = re.sub(r'\s+(since|meaning)\s+([A-Z])', r'. \2', s)
        
        # Clean up space before commas/periods that shouldn't be there
        s = re.sub(r'\s+([,.])', r'\1', s)
        
        return s

    # Process per line to preserve line breaks and human quirks
    lines = protected_text.split("\n")
    out_lines = []
    for ln in lines:
        s = normalize_quotes(ln)
        s = fix_punct_spacing(s)
        s = dedupe_punct(s)
        s = fix_articles(s)
        s = fix_agreement(s)
        s = fix_common_errors(s)
        s = fix_verb_forms(s)
        s = fix_prepositions(s)
        s = fix_capitalization(s)
        s = ultra_aggressive_grammar_fix(s)  # NEW: aggressive artifact removal
        s = collapse_spaces(s)
        s = reduce_adjacent_duplicate_words(s)
        s = reduce_leading_filler_chains(s)
        out_lines.append(s)

    result = "\n".join(out_lines)
    # Restore numbers at the end
    return restore_numbers(result, num_map)
