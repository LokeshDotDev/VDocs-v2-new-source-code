# Vdocs Docker Deployment

Complete Docker Compose setup to run the entire Vdocs application with a single command.

## 📋 What's Included

This Docker setup includes all services needed for the complete Vdocs pipeline:

### Services
- **Frontend** (Next.js) - Web UI on port 3000
- **Node Server** - API backend on port 4000
- **TUS Server** - File upload service on port 4001
- **PostgreSQL** - Database on port 5432
- **MinIO** - Object storage on ports 9000/9001
- **Reductor Service** - PII detection & anonymization on port 5018
- **Humanizer Service** - Text paraphrasing on port 8000
- **Spell & Grammar Service** - Grammar checking on port 8001
- **PDF Converter** - PDF processing on port 5000

### Total Services: 9

## 🚀 Quick Start

### Option 1: Using the Script (Recommended)

```bash
# Navigate to project directory
cd /path/to/vdocs

# Make script executable (if needed)
chmod +x docker-compose.sh

# Start services
./docker-compose.sh up

# View logs
./docker-compose.sh logs

# Check health
./docker-compose.sh health

# Stop services
./docker-compose.sh down
```

### Option 2: Manual Docker Compose

```bash
# Copy environment template
cp .env.example .env

# Start all services
docker compose -f docker-compose.production.yml up -d

# View status
docker compose -f docker-compose.production.yml ps

# View logs
docker compose -f docker-compose.production.yml logs -f

# Stop services
docker compose -f docker-compose.production.yml down
```

## 📝 Configuration

### Environment Variables

Edit `.env` to customize:

```bash
# Database
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=wedocs

# MinIO (Object Storage)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=your_secure_password
MINIO_BUCKET=wedocs

# Humanizer Tuning
HUMANIZER_P_SYN_HIGH=0.50         # Synonym replacement (0.0-1.0)
HUMANIZER_P_TRANS_HIGH=0.28       # Transition insertion (0.0-1.0)
HUMANIZER_ATTEMPTS=14             # Paraphrase attempts
HUMANIZER_INCLUDE_TABLES=1        # Include table text

# Security
JWT_SECRET=your_very_strong_secret_key_here
JWT_EXPIRE=24h
CORS_ORIGIN=http://localhost:3000
```

## 🌐 Access Points

Once services are running:

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Sign up/Login |
| API | http://localhost:4000 | N/A |
| MinIO Console | http://localhost:9001 | minioadmin / (from .env) |
| Health Check API | http://localhost:4000/health | N/A |

## 📊 File Processing Pipeline

1. **Upload** - TUS Server (4001) handles file uploads
2. **Conversion** - PDF Converter (5000) converts PDFs to DOCX
3. **Redaction** - Reductor (5018) detects and redacts PII
4. **Humanization** - Humanizer (8000) paraphrases text to reduce AI detection
5. **Grammar Check** - Spell/Grammar (8001) corrects grammar
6. **Storage** - MinIO stores all versions
7. **Download** - Frontend serves processed files as ZIP

## 🔍 Monitoring & Debugging

### Check Service Status

```bash
# View all services
docker compose -f docker-compose.production.yml ps

# View specific service logs
docker compose -f docker-compose.production.yml logs server
docker compose -f docker-compose.production.yml logs humanizer-service
docker compose -f docker-compose.production.yml logs reductor-service

# Follow logs in real-time
docker compose -f docker-compose.production.yml logs -f
```

### Health Checks

```bash
# Check all services at once
./docker-compose.sh health

# Or manually
curl http://localhost:4000/health
curl http://localhost:5018/health
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:5000/health
```

### Database

```bash
# Connect to PostgreSQL
docker compose -f docker-compose.production.yml exec postgres psql -U postgres -d wedocs

# List tables
\dt

# Query sample data
SELECT * FROM users LIMIT 5;

# Exit
\q
```

### MinIO

```bash
# Access MinIO Console
# http://localhost:9001
# Username: minioadmin
# Password: (from .env)

# Or use MinIO CLI
docker compose -f docker-compose.production.yml exec minio mc ls minio/wedocs
```

## ⚙️ Common Tasks

### Restart a Service

```bash
docker compose -f docker-compose.production.yml restart server
docker compose -f docker-compose.production.yml restart humanizer-service
```

### View Full Logs

```bash
# All services
docker compose -f docker-compose.production.yml logs --tail=100 -f

# Last 50 lines
docker compose -f docker-compose.production.yml logs --tail=50
```

### Rebuild Services

```bash
# Rebuild all
docker compose -f docker-compose.production.yml up -d --build

# Rebuild specific service
docker compose -f docker-compose.production.yml up -d --build humanizer-service
```

### Reset Everything

```bash
# Stop and remove everything (WARNING: removes data)
docker compose -f docker-compose.production.yml down -v

# Start fresh
docker compose -f docker-compose.production.yml up -d
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Or change port in docker-compose.yml or .env
```

### Service Not Starting

```bash
# Check logs
docker compose -f docker-compose.production.yml logs service-name

# Common causes:
# - Port conflict
# - Environment variable missing
# - Database not ready (wait 10-15s)
```

### Database Connection Error

```bash
# Reset database
docker compose -f docker-compose.production.yml down -v postgres
docker compose -f docker-compose.production.yml up -d postgres

# Wait for healthy status
docker compose -f docker-compose.production.yml ps postgres
```

### Humanizer Not Working

```bash
# Check humanizer logs
docker compose -f docker-compose.production.yml logs humanizer-service

# Verify it's healthy
curl http://localhost:8000/health

# If needed, rebuild
docker compose -f docker-compose.production.yml up -d --build humanizer-service
```

### Out of Memory

```bash
# Check resource usage
docker stats

# Restart with limited memory
docker compose -f docker-compose.production.yml restart --timeout=10
```

## 📈 Performance Tuning

### Increase Processing Power

Edit `.env`:

```bash
# More parallel workers
REDUCTOR_MAX_WORKERS=8

# More humanizer attempts
HUMANIZER_ATTEMPTS=20

# Stronger paraphrasing
HUMANIZER_P_SYN_HIGH=0.60
HUMANIZER_P_TRANS_HIGH=0.35
```

Then restart services:

```bash
docker compose -f docker-compose.production.yml restart humanizer-service reductor-service
```

### Reduce Memory Usage

Edit `.env`:

```bash
# Fewer workers
REDUCTOR_MAX_WORKERS=2

# Fewer attempts
HUMANIZER_ATTEMPTS=8

# Less aggressive paraphrasing
HUMANIZER_P_SYN_HIGH=0.35
HUMANIZER_P_TRANS_HIGH=0.15
```

## 🔐 Production Deployment

### Before Going Live

1. **Change all passwords** in `.env`:
   - `DB_PASSWORD`
   - `MINIO_ROOT_PASSWORD`
   - `JWT_SECRET` (use `openssl rand -base64 32`)

2. **Update CORS**:
   ```bash
   CORS_ORIGIN=https://yourdomain.com
   ```

3. **Enable HTTPS** - Use nginx reverse proxy or Let's Encrypt

4. **Set up backups**:
   ```bash
   # Create backup script
   docker compose -f docker-compose.production.yml exec postgres pg_dump -U postgres wedocs > backup.sql
   ```

5. **Configure monitoring**:
   - Set up logging aggregation
   - Monitor resource usage
   - Set up alerts

6. **Test recovery**:
   - Practice database restoration
   - Test backup recovery procedures

### Production docker-compose.yml

For production, add resource limits:

```yaml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 📚 File Structure

```
vdocs/
├── docker-compose.production.yml  # Main compose file
├── docker-compose.sh              # Management script
├── .env                           # Environment config
├── .env.example                   # Template
├── DOCKER_COMPOSE_GUIDE.md        # Full guide
├── frontend/
│   └── Dockerfile
├── server/
│   └── Dockerfile
├── tus-server/
│   └── Dockerfile
├── python-manager/
│   ├── Dockerfile
│   └── modules/
│       ├── humanizer/
│       │   └── Dockerfile
│       └── spell-grammar-checker/
│           └── Dockerfile
└── reductor-module/
    └── reductor-service-v2/
        └── Dockerfile
```

## 🆘 Getting Help

### Check Logs

```bash
# All logs
docker compose -f docker-compose.production.yml logs -f

# Service-specific
docker compose -f docker-compose.production.yml logs -f server
docker compose -f docker-compose.production.yml logs -f humanizer-service
```

### Verify Configuration

```bash
# Show environment variables
docker compose -f docker-compose.production.yml config | grep -A 20 "server:"

# Check .env file
cat .env
```

### System Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 20GB+ for data and logs
- **Network**: Good internet for pulling images

### Useful Docker Commands

```bash
# See all containers
docker ps -a

# View resource usage
docker stats

# Cleanup unused images
docker image prune

# Remove all containers and volumes
docker system prune -v
```

## 📞 Support

For issues or questions:

1. Check logs: `docker compose logs -f`
2. Review `.env` configuration
3. Verify all services are healthy
4. Check port availability
5. Ensure sufficient disk space

---

**Version**: 1.0  
**Last Updated**: January 2026  
**Maintained By**: Vdocs Team
