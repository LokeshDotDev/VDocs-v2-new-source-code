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
from nltk.corpus import wordnet
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
    print("⚠️  Some humanization features will be limited without spaCy")

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

ACADEMIC_TRANSITIONS = [
    "Moreover,", "Furthermore,", "In addition,", "Additionally,",
    "Nevertheless,", "Nonetheless,", "However,", "Conversely,",
    "On the other hand,", "In contrast,", "Similarly,", "Likewise,",
    "Consequently,", "Therefore,", "Thus,", "Hence,",
    "For instance,", "For example,", "In particular,", "Notably,",
    "It is worth noting that", "Significantly,", "Interestingly,",
    "As a matter of fact,", "Indeed,", "In fact,", "Evidently,",
    "To illustrate,", "To clarify,", "Specifically,", "In essence,",
    "Broadly speaking,", "Generally speaking,", "By and large,",
    "To put it differently,", "In other words,", "That is to say,",
    "With this in mind,", "Given this,", "Accordingly,", "As such,",
]

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
    """Get a synonym with better selection strategy for more natural text."""
    synsets = wordnet.synsets(word)
    all_syns = []
    
    # Try multiple synsets for more variety (up to 3)
    for synset in synsets[:3]:
        lemmas = synset.lemmas()
        syns = [
            lemma.name().replace("_", " ") 
            for lemma in lemmas 
            if lemma.name().lower() != word.lower() and "_" not in lemma.name()
        ]
        all_syns.extend(syns)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_syns = []
    for syn in all_syns:
        if syn.lower() not in seen:
            seen.add(syn.lower())
            unique_syns.append(syn)
    
    if unique_syns:
        return random.choice(unique_syns)
    return None

def replace_synonyms(text, p_syn=0.2):
    if nlp is None:
        return text
    doc = nlp(text)
    replaced = []
    for token in doc:
        # Preserve original whitespace from spacy token
        ws = token.whitespace_  # Correct spacy attribute for trailing whitespace
        
        # More aggressive replacement for adjectives and adverbs
        should_replace = False
        if token.pos_ in ("ADJ", "ADV"):
            should_replace = random.random() < (p_syn * 1.3)  # 30% more likely
        elif token.pos_ in ("NOUN", "VERB"):
            should_replace = random.random() < p_syn
        
        if should_replace and len(token.text) > 3:  # Skip very short words
            syn = get_synonym(token.text)
            text_out = syn if syn else token.text
        else:
            text_out = token.text
        replaced.append(text_out + ws)  # Use original whitespace, not forced spacer

    # Join directly; whitespace already preserved from original
    return "".join(replaced)

def add_academic_transitions(text, p_trans=0.2):
    sentences = sent_tokenize(text)
    result = []
    for sent in sentences:
        if random.random() < p_trans:
            trans = random.choice(ACADEMIC_TRANSITIONS)
            result.append(f"{trans} {sent}")
        else:
            result.append(sent)
    return " ".join(result)


def reintroduce_contractions(text: str, p: float = 0.5) -> str:
    """Randomly convert formal phrases back to contractions for a human tone."""
    out = text
    for pattern, repl in CONTRACTION_MAP:
        if random.random() < p:
            out = re.sub(pattern, repl, out, flags=re.IGNORECASE)
    return out


def punctuation_variation(text: str, p_dash: float = 0.3, p_parenthetical: float = 0.2) -> str:
    """Introduce mild punctuation variety: em-dashes and small parentheticals."""
    # Replace some ", and" / ", but" with an em-dash
    out = re.sub(r",\s+(and|but)\s+", lambda m: (" — " + m.group(1) + " ") if random.random() < p_dash else m.group(0), text)

    # Parenthetical aside: wrap short clause of 3-7 words in parentheses occasionally
    def add_parenthetical(match):
        clause = match.group(1)
        if 8 <= len(clause.split()) <= 14 and random.random() < p_parenthetical:
            return f" ({clause}), "
        return f" {clause}, "

    out = re.sub(r"\s([a-zA-Z][^,]{10,50}),\s", add_parenthetical, out)
    return out


def add_casual_fillers(text: str, p: float = 0.4) -> str:
    """Inject casual filler words to sound more conversational."""
    sentences = sent_tokenize(text)
    result = []
    for sent in sentences:
        stripped = sent.strip()
        if len(stripped.split()) > 3 and random.random() < p:
            filler = random.choice(CASUAL_FILLERS)
            if filler.endswith(","):
                result.append(f"{filler} {stripped}")
            else:
                result.append(f"{stripped.rstrip('.')} {filler}.")
        else:
            result.append(stripped)
    return " ".join(result)


def add_fragments_and_questions(text: str, p: float = 0.25) -> str:
    """Occasionally add sentence fragments or rhetorical questions for human voice."""
    sentences = sent_tokenize(text)
    result = []
    for idx, sent in enumerate(sentences):
        stripped = sent.strip()
        result.append(stripped)
        # After certain sentences, maybe add a fragment or question
        if idx > 0 and len(sent.split()) > 12 and random.random() < p:
            fragments = [
                "Think about it.",
                "Makes sense, right?",
                "Definitely.",
                "No surprise there.",
                "True.",
                "Absolutely.",
                "Why? Because it works.",
            ]
            result.append(random.choice(fragments))
    return " ".join(result)


def inject_human_phrases(text, p_phrase=0.65):
    sentences = sent_tokenize(text)
    result = []
    for idx, sent in enumerate(sentences):
        stripped = sent.strip()
        words = stripped.split()

        # Never add asides to the first sentence or very short/headline lines
        if idx == 0 or len(words) <= 5 or stripped.isupper():
            result.append(stripped)
            continue

        # With some probability, prepend a human-like aside
        if random.random() < p_phrase:
            phrase = random.choice(HUMAN_PHRASES)
            result.append(f"{phrase} {stripped}")
        else:
            result.append(stripped)
    return " ".join(result)


def light_sentence_restructure(text, p_split=0.6, p_merge=0.65):
    """Introduce light sentence restructuring to break AI-like cadence."""
    sentences = sent_tokenize(text)
    reshaped: List[str] = []

    i = 0
    while i < len(sentences):
        sent = sentences[i].strip()
        if not sent:
            i += 1
            continue

        words = sent.split()

        # Split long sentences at a comma if possible
        if len(words) > 20 and "," in sent and random.random() < p_split:
            parts = sent.split(",", 1)
            first = parts[0].strip()
            second = parts[1].strip()
            if first:
                reshaped.append(first + ".")
            if second:
                # add a gentle bridge
                reshaped.append("Moreover, " + second.capitalize())
            i += 1
            continue

        # Merge short consecutive sentences to sound more conversational
        if i + 1 < len(sentences) and len(words) < 8 and random.random() < p_merge:
            nxt = sentences[i + 1].strip()
            if nxt:
                bridge = random.choice(BRIDGE_PHRASES)
                merged = f"{sent.rstrip('.')} {bridge} {nxt[0].lower()}{nxt[1:]}"
                reshaped.append(merged)
                i += 2
                continue

        reshaped.append(sent)
        i += 1

    return " ".join(reshaped)

def minimal_rewriting(text, p_syn=0.2, p_trans=0.2):
    # Keep some contractions to feel more human; expand partially then reintroduce
    text = expand_contractions(text)
    text = replace_synonyms(text, p_syn=p_syn)
    text = add_academic_transitions(text, p_trans=0.3)
    text = reintroduce_contractions(text, p=0.85)
    text = add_casual_fillers(text, p=0.45)
    text = inject_human_phrases(text, p_phrase=0.6)
    text = light_sentence_restructure(text, p_split=0.55, p_merge=0.6)
    text = add_fragments_and_questions(text, p=0.3)
    text = punctuation_variation(text, p_dash=0.35, p_parenthetical=0.22)
    return text

def preserve_linebreaks_rewrite(text, p_syn=0.2, p_trans=0.2):
    """
    Rewrite text while preserving line breaks.
    SKIPS header/metadata lines (student name, roll no, semester, etc.)
    Only humanizes main content.
    """
    lines = text.split("\n")
    rewritten_lines = []
    for line in lines:
        if line.strip():
            # Check if this is a header/metadata line
            if is_header_or_metadata(line):
                # Keep header as-is, don't humanize
                rewritten_lines.append(line)
            else:
                # Humanize content lines only
                line = expand_contractions(line)
                line = replace_synonyms(line, p_syn=p_syn)
                line = add_academic_transitions(line, p_trans=0.3)
                line = reintroduce_contractions(line, p=0.85)
                line = add_casual_fillers(line, p=0.45)
                line = inject_human_phrases(line, p_phrase=0.6)
                line = light_sentence_restructure(line, p_split=0.55, p_merge=0.6)
                line = add_fragments_and_questions(line, p=0.3)
                line = punctuation_variation(line, p_dash=0.35, p_parenthetical=0.22)
                rewritten_lines.append(line)
        else:
            rewritten_lines.append(line)
    return "\n".join(rewritten_lines)
