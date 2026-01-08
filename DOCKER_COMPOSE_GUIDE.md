# Docker Compose Setup Guide for Vdocs Application

This guide will help you deploy the complete Vdocs application using Docker Compose on any system.

## Prerequisites

- **Docker**: 20.10+ ([Download](https://docs.docker.com/get-docker/))
- **Docker Compose**: 1.29+ (usually comes with Docker Desktop)
- **System Requirements**:
  - Minimum 8GB RAM
  - 20GB free disk space
  - Supported OS: Linux, macOS, Windows (WSL2)

### Verify Installation

```bash
docker --version
docker compose version
```

## Quick Start (5 minutes)

### Step 1: Clone or Copy Repository

If you're on a new system, ensure you have the entire project structure:
```bash
# Copy project to desired location
cp -r /path/to/vdocs /target/location/vdocs
cd /target/location/vdocs
```

### Step 2: Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# (Optional) Edit .env for custom settings
nano .env
```

Common customizations:
- `DB_PASSWORD`: Change PostgreSQL password
- `MINIO_ROOT_PASSWORD`: Change MinIO admin password
- `JWT_SECRET`: Set a strong secret for production
- `CORS_ORIGIN`: Update if not using localhost

### Step 3: Start All Services

```bash
# Build and start all containers
docker compose -f docker-compose.production.yml up -d

# Monitor startup progress
docker compose -f docker-compose.production.yml logs -f
```

Expected startup time: **2-3 minutes** (longer on first run due to image builds)

### Step 4: Verify All Services

```bash
# Check all containers are running
docker compose -f docker-compose.production.yml ps

# Expected output: All services should show "Up"
```

### Step 5: Access the Application

Once all services show `Up`:

- **Frontend**: http://localhost:3000
- **API Server**: http://localhost:4000
- **MinIO Console**: http://localhost:9001 (admin / admin)
- **PostgreSQL**: localhost:5432 (postgres / postgres)

## Service Details

| Service | Port | Purpose | Health Check |
|---------|------|---------|--------------|
| **Frontend** | 3000 | Web UI | http://localhost:3000 |
| **Server** | 4000 | Node.js API | http://localhost:4000/health |
| **TUS Server** | 4001 | File Upload | http://localhost:4001 |
| **Reductor** | 5018 | PII Detection | http://localhost:5018/health |
| **PDF Converter** | 5000 | PDF Processing | http://localhost:5000/health |
| **Humanizer** | 8000 | Text Paraphrase | http://localhost:8000/health |
| **Spell/Grammar** | 8001 | Grammar Check | http://localhost:8001/health |
| **MinIO** | 9000 | Object Storage | http://localhost:9000 |
| **MinIO Console** | 9001 | Storage UI | http://localhost:9001 |
| **PostgreSQL** | 5432 | Database | Port only |

## Common Operations

### View Logs

```bash
# All services
docker compose -f docker-compose.production.yml logs -f

# Specific service
docker compose -f docker-compose.production.yml logs -f server
docker compose -f docker-compose.production.yml logs -f humanizer-service
docker compose -f docker-compose.production.yml logs -f reductor-service
```

### Stop Services

```bash
# Stop without removing
docker compose -f docker-compose.production.yml stop

# Stop and remove containers
docker compose -f docker-compose.production.yml down

# Stop and remove all data (WARNING: removes volumes)
docker compose -f docker-compose.production.yml down -v
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.production.yml restart

# Restart specific service
docker compose -f docker-compose.production.yml restart server
```

### Scale Services (if needed)

```bash
# Scale reducer service to handle more load
docker compose -f docker-compose.production.yml up -d --scale reductor-service=2
```

### Update a Single Service

```bash
# Rebuild and restart
docker compose -f docker-compose.production.yml up -d --build server
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env and restart
```

### Service Keeps Restarting

```bash
# Check service logs for errors
docker compose -f docker-compose.production.yml logs server

# Common causes:
# - Database not ready yet (wait 10-15 seconds)
# - Environment variable missing in .env
# - Port conflict with another service
```

### Database Connection Error

```bash
# Reset database
docker compose -f docker-compose.production.yml down -v
docker compose -f docker-compose.production.yml up -d postgres

# Wait for postgres to be healthy
docker compose -f docker-compose.production.yml ps

# Start other services
docker compose -f docker-compose.production.yml up -d
```

### MinIO Access Issues

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Reset MinIO data
docker compose -f docker-compose.production.yml down -v minio
docker compose -f docker-compose.production.yml up -d minio
```

### Humanizer Not Paraphrasing Enough

Edit `.env` and increase:
```bash
HUMANIZER_P_SYN_HIGH=0.60
HUMANIZER_P_TRANS_HIGH=0.35
HUMANIZER_ATTEMPTS=20
```

Then restart:
```bash
docker compose -f docker-compose.production.yml restart humanizer-service
```

## Performance Tuning

### For High Load

Modify `.env`:
```bash
# Increase workers for parallel processing
REDUCTOR_MAX_WORKERS=8

# Increase humanizer attempts for better quality
HUMANIZER_ATTEMPTS=20

# Increase attempt for similarity match
HUMANIZER_SIMILARITY_MAX=0.50
```

### For Limited Resources

Modify `.env`:
```bash
# Reduce workers to save memory
REDUCTOR_MAX_WORKERS=2

# Reduce attempts for speed
HUMANIZER_ATTEMPTS=8

# Scale down if needed
docker-compose -f docker-compose.production.yml up -d --scale humanizer-service=1
```

## Backup & Restore

### Backup Data

```bash
# Create backup of all volumes
docker run --rm \
  -v wedocs_postgres_data:/postgres_data \
  -v wedocs_minio_data:/minio_data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/wedocs-backup-$(date +%Y%m%d).tar.gz \
  -C / postgres_data minio_data
```

### Restore Data

```bash
# Extract backup to volumes
docker run --rm \
  -v wedocs_postgres_data:/postgres_data \
  -v wedocs_minio_data:/minio_data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/wedocs-backup-YYYYMMDD.tar.gz -C /
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Change all default passwords in `.env`
  - [ ] `DB_PASSWORD`
  - [ ] `MINIO_ROOT_PASSWORD`
  - [ ] `JWT_SECRET`
- [ ] Update `CORS_ORIGIN` to your domain
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (use Nginx reverse proxy or Let's Encrypt)
- [ ] Set up automated backups
- [ ] Configure resource limits in docker-compose
- [ ] Set up monitoring and logging
- [ ] Test disaster recovery

### Production-Ready Environment

```bash
# Example production .env
DB_PASSWORD=<STRONG_PASSWORD>
MINIO_ROOT_PASSWORD=<STRONG_PASSWORD>
JWT_SECRET=<STRONG_SECRET>
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

## Advanced: Custom Configuration

### Use Different Port

```bash
# Change frontend port to 8080
docker compose -f docker-compose.production.yml up -d -p 8080:3000 frontend

# Or modify .env
FRONTEND_PORT=8080
```

### Custom Network

```bash
# Deploy with custom network name
docker network create vdocs-network
docker compose -f docker-compose.production.yml --network vdocs-network up -d
```

### Health Checks

```bash
# Detailed health status
docker compose -f docker-compose.production.yml ps

# Check specific service health
curl http://localhost:4000/health
curl http://localhost:5018/health
curl http://localhost:8000/health
```

## Support & Issues

If you encounter issues:

1. **Check logs**: `docker compose -f docker-compose.production.yml logs -f <service>`
2. **Verify .env**: Ensure all required variables are set
3. **Check ports**: Ensure no conflicts with existing services
4. **Restart services**: `docker compose -f docker-compose.production.yml restart`
5. **Clean rebuild**: `docker compose -f docker-compose.production.yml down -v && docker compose -f docker-compose.production.yml up -d`

## Next Steps

1. Access frontend at http://localhost:3000
2. Create an account or login
3. Upload documents for processing
4. Monitor processing via status checks
5. Download processed files with reduced AI detection

Enjoy using Vdocs! 🎉
