FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libreoffice \
    libfreetype6 \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Copy application code
COPY . .

# Copy local services directory into /app/services for import
COPY services ./services

# Patch pdf2docx for Python 3.11 compatibility (Iterable import)
RUN sed -i 's/from collections import Iterable/from collections.abc import Iterable/g' /usr/local/lib/python3.11/site-packages/pdf2docx/text/Line.py

# Create tmp directory
RUN mkdir -p tmp

# Health check
HEALTHCHECK --interval=15s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:5018/health || exit 1

# Run the application
CMD ["python", "main.py"]
