# Docker Compose Port Configuration

Updated: 12 January 2026

## Service Port Mappings

All services are now configured to match your local development setup:

### Frontend & Backend
- **Frontend**: `3001` (http://localhost:3001)
  - Maps to internal port 3000
  - Environment: `NEXT_PUBLIC_API_BASE=http://localhost:4000`
  - Environment: `NEXT_PUBLIC_TUS_ENDPOINT=http://localhost:4001/files`

- **Backend Server (Node.js)**: `4000` (http://localhost:4000)
  - Maps to internal port 3000
  - Uses PostgreSQL for data persistence
  - Connects to all Python services internally

### File Upload
- **TUS Server**: `4001` (http://localhost:4001)
  - Handles resumable file uploads
  - Stores files in MinIO

### Python Services
- **Python Manager**: `5050` (http://localhost:5050)
  - Main AI orchestration service
  - Manages humanizer and grammar modules

- **Humanizer Module**: `8000` (http://localhost:8000)
  - Text humanization and AI detection evasion
  - Grammar score improvements

- **Spell & Grammar Checker**: `8001` (http://localhost:8001)
  - Grammar validation and correction
  - Integrated with humanizer pipeline

- **Reductor Service**: `5018` (http://localhost:5018)
  - Document anonymization and redaction
  - Integrates with MinIO storage

### Storage & Database
- **PostgreSQL**: `5433` (Internal: 5432)
  - Database: `wedocs`
  - User: `postgres` / Password: `postgres`

- **MinIO**: 
  - API: `9000` (http://localhost:9000)
  - Console: `9001` (http://localhost:9001)
  - Credentials: `minioadmin` / `minioadmin`

### Document Services
- **LibreOffice Headless**: `2002`
  - Document format conversion
  - UNO socket protocol

- **ONLYOFFICE Document Server**: `8080` (http://localhost:8080)
  - Collaborative document editing
  - JWT disabled for development

## Service-to-Service Communication

Services communicate internally using Docker network hostnames:

```
Frontend (3001) → Backend (http://node-server:3000)
Backend → Python Manager (http://python-manager:5050)
Backend → Humanizer (http://humanizer-module:8000)
Backend → Grammar Checker (http://spell-grammar-checker:8001)
Backend → Reductor (http://reductor-service:5018)
Backend → TUS Server (http://tus-server:4001)
Backend → LibreOffice (http://libreoffice:2002)
```

## Quick Start

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Health Checks

All services have health checks enabled with:
- Interval: 10 seconds
- Timeout: 5 seconds
- Retries: 3

Status: `docker-compose ps` will show `healthy` when ready.

## Network

All services connect via custom bridge network: `wedocs-net`
- Subnet: 172.28.0.0/16
- Internal DNS resolution available

## Environment Variables

Backend server environment automatically configured to connect to:
- Python Manager at port 5050
- Humanizer at port 8000
- Grammar Checker at port 8001
- Reductor at port 5018
- TUS Server at port 4001
