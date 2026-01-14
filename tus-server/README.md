# TUS Node Server (Express + MinIO)

Production-ready TUS endpoint using Express with streaming finalization to MinIO.

## Quick start

```bash
cd tus-server
cp .env.example .env
npm install
npm run build
npm start
```

The server listens on `PORT` (default 4001) and exposes the TUS path at `TUS_PATH` (default `/files`).

## Environment Configuration

Copy `.env.example` to `.env` and update for your environment:

```bash
# Server
PORT=4001
HOST=0.0.0.0
TUS_PATH=/files
TUS_STORAGE_DIR=/var/tus/data

# MinIO/S3 Settings
MINIO_ENDPOINT=your-minio-host
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=wedocs
```

### Key Settings:
- `TUS_STORAGE_DIR`: temporary staging directory for uploads (requires sufficient disk space)
- `MAX_UPLOAD_SIZE_BYTES`: maximum allowed upload size (default 20GB)
- `MINIO_*`: MinIO/S3 connection and bucket settings

## Production Deployment

### Docker
The server includes a `Dockerfile` for containerized deployment:

```bash
docker build -t tus-server:latest .
docker run -p 4001:4001 \
  -e MINIO_ENDPOINT=minio \
  -e MINIO_PORT=9000 \
  -e MINIO_ACCESS_KEY=your-key \
  -e MINIO_SECRET_KEY=your-secret \
  -e MINIO_BUCKET=wedocs \
  -v /var/tus/data:/var/tus/data \
  tus-server:latest
```

### Docker Compose
Configure in your docker-compose.yml:

```yaml
services:
  tus-server:
    build: ./tus-server
    ports:
      - "4001:4001"
    environment:
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
      MINIO_BUCKET: wedocs
    volumes:
      - tus-data:/var/tus/data
    depends_on:
      - minio

volumes:
  tus-data:
```

## API Endpoints

- `POST/PATCH ${TUS_PATH}/*` - TUS protocol endpoints
- `GET /health` - Service health check (returns `{ status: 'ok' }`)
- `GET /health/minio` - MinIO connectivity check
- `GET /debug/failed-uploads` - List failed uploads (debug only)
- `POST /debug/retry-upload/:uploadId` - Retry a failed upload (debug only)

## MinIO Behavior

- Completed uploads stream from local staging to MinIO using `putObject`
- Object keys: `jobs/{jobId}/{stage}/{relativePath}`
- After successful streaming, local temp files are deleted
- If MinIO streaming fails, TUS response still succeeds; retry via debug endpoint or retry worker
- Multipart uploads are supported with part tracking

## Architecture Notes

- TUS server performs **no database writes**
- All large file operations use **streaming only**
- Validation checks ensure MinIO configuration before startup
- Proper type safety with environment variable validation
- All localhost references removed for production compatibility

## Health & Monitoring

- `GET /health` - Basic health check
- `GET /health/minio` - MinIO connection status
- Structured logging with error context
- Graceful handling of MinIO unavailability

## Next Steps (Future Work)

- Emit RabbitMQ events on `POST_FINISH` for orchestration
- Add JWT auth and tenant scoping with per-tenant buckets
- Add automatic cleanup job for stale partial uploads
- Add Prometheus metrics and structured logging
- Add comprehensive test suite for TUS pipeline and MinIO streaming
