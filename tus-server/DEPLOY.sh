#!/bin/bash
# TUS Server - Complete Production Deployment Guide

echo "============================================"
echo "TUS Server Production Deployment"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}✅ Ready for Production${NC}"
echo ""

echo "1. VERIFY CONFIGURATION"
echo "   - Update .env with your settings:"
echo ""
echo "     MINIO_ENDPOINT=your-minio-host"
echo "     MINIO_PORT=9000"
echo "     MINIO_USE_SSL=true"
echo "     MINIO_ACCESS_KEY=your-key"
echo "     MINIO_SECRET_KEY=your-secret"
echo "     TUS_STORAGE_DIR=/var/tus/data"
echo ""

echo "2. BUILD DOCKER IMAGE"
echo "   docker build -t tus-server:latest ."
echo ""

echo "3. RUN WITH DOCKER"
echo "   docker run -d \\"
echo "     --name tus-server \\"
echo "     -p 4001:4001 \\"
echo "     --env-file .env \\"
echo "     -v /var/tus/data:/var/tus/data \\"
echo "     tus-server:latest"
echo ""

echo "4. RUN WITH DOCKER COMPOSE"
echo "   docker-compose up -d tus-server"
echo ""

echo "5. VERIFY DEPLOYMENT"
echo "   curl http://localhost:4001/health"
echo "   curl http://localhost:4001/health/minio"
echo ""

echo "6. VIEW LOGS"
echo "   docker logs -f tus-server"
echo ""

echo "============================================"
echo "DEPLOYMENT CHECKLIST"
echo "============================================"
echo ""
echo -e "${YELLOW}Before deploying, verify:${NC}"
echo "  ☐ .env file is configured"
echo "  ☐ MINIO_ENDPOINT is correct (not localhost)"
echo "  ☐ MINIO credentials are set"
echo "  ☐ /var/tus/data directory exists and is writable"
echo "  ☐ MinIO is running and accessible"
echo "  ☐ Firewall allows port 4001"
echo "  ☐ Docker image builds successfully"
echo ""

echo "============================================"
echo "TROUBLESHOOTING"
echo "============================================"
echo ""
echo "1. Container won't start:"
echo "   docker logs tus-server"
echo ""
echo "2. MinIO connection error:"
echo "   - Verify MINIO_ENDPOINT (use hostname, not localhost)"
echo "   - Check MINIO_ACCESS_KEY and MINIO_SECRET_KEY"
echo "   - Ensure MinIO is running: curl http://minio:9000"
echo ""
echo "3. Health check fails:"
echo "   - Wait 5-10 seconds after container start"
echo "   - Check: curl http://localhost:4001/health"
echo ""
echo "4. Storage directory permission denied:"
echo "   - Ensure /var/tus/data exists"
echo "   - Check: ls -la /var/tus/data"
echo ""

echo "============================================"
echo "PRODUCTION READY ✅"
echo "============================================"
