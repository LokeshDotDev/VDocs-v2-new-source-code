# 🚀 VDOCS - ZERO CONFIGURATION STARTUP

## This is it. Just one command.

### Prerequisites
- **Docker** installed (https://docker.com)
- **Docker Compose** (included with Docker Desktop)
- **15-20GB free disk space** (for all services + data)

### Start Everything

```bash
./start-vdocs.sh
```

That's it. Everything else is automatic.

**Wait 3-5 minutes for all services to start.**

---

## Access Your Application

Once started, open your browser:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Web App** | http://localhost:3000 | See auth settings |
| **MinIO Storage** | http://localhost:9001 | minioadmin / minioadmin |
| **API Docs** | http://localhost:4000/api/docs | N/A |

---

## Services Running (9 total)

✅ Frontend Web App (Next.js)
✅ Backend API Server (Node.js)
✅ File Upload Service (TUS)
✅ PDF Converter (Python)
✅ PostgreSQL Database (Port 5432)
✅ MinIO Object Storage (Ports 9000/9001)
✅ PII Reductor Service (Port 5018)
✅ Text Humanizer (Port 8000)
✅ Grammar Checker (Port 8001)

---

## What's Pre-Configured?

✅ All service ports defined
✅ All environment variables set with sensible defaults
✅ Database auto-initialized
✅ Storage auto-initialized
✅ Health checks configured
✅ Auto-restart on failure
✅ Persistent data volumes
✅ Service-to-service networking

**No .env files needed. No manual setup. No configuration files to edit.**

---

## Stopping the Application

Press `Ctrl+C` in the terminal where the app is running.

---

## Advanced Operations

For more commands, see:
- [QUICK_START_DOCKER.md](QUICK_START_DOCKER.md) - Quick reference
- [DOCKER_README.md](DOCKER_README.md) - Operations & monitoring
- [DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md) - Troubleshooting & details

Or use the management script:
```bash
./docker-compose.sh up       # Start
./docker-compose.sh down     # Stop
./docker-compose.sh restart  # Restart
./docker-compose.sh health   # Check status
./docker-compose.sh logs     # View logs
```

---

## Troubleshooting

### "docker: command not found"
→ Install Docker Desktop from https://docker.com

### Services not starting?
→ Run: `./docker-compose.sh health`

### Port already in use?
→ Modify `docker-compose.production.yml` and change the port mappings

### Want to use a different database password?
→ Copy `.env.example` to `.env`, modify, then run the script again

---

**That's all. You're done. The application is ready to use.**

For detailed information, see [DEPLOYMENT_READY.md](DEPLOYMENT_READY.md).
