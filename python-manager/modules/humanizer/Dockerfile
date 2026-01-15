FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    python - <<EOF
import nltk
nltk.download("punkt", quiet=True)
nltk.download("averaged_perceptron_tagger", quiet=True)
nltk.download("wordnet", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("averaged_perceptron_tagger_eng", quiet=True)
EOF


# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY . .

# Create tmp directory
RUN mkdir -p tmp

# Expose port (important for Dokploy / Traefik)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Run the application (use env PORT)
CMD ["sh", "-c", "uvicorn api.humanize_api:app --host 0.0.0.0 --port ${PORT:-8000}"]
