#!/bin/bash

echo "🚀 Starting One-Click Pipeline Services..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are already running
check_port() {
    lsof -i:$1 > /dev/null 2>&1
    return $?
}

echo "📋 Checking services..."
echo ""

# Check MinIO (9000)
if check_port 9000; then
    echo -e "${GREEN}✅ MinIO (9000) - Running${NC}"
else
    echo -e "${RED}❌ MinIO (9000) - Not running${NC}"
    echo "   Start with: docker-compose up -d minio"
fi

# Check TUS Server (4000)
if check_port 4000; then
    echo -e "${GREEN}✅ TUS Server (4000) - Running${NC}"
else
    echo -e "${RED}❌ TUS Server (4000) - Not running${NC}"
    echo "   Start with: cd tus-server && npm start"
fi

# Check Python Manager (5000)
if check_port 5000; then
    echo -e "${GREEN}✅ Python Manager (5000) - Running${NC}"
else
    echo -e "${RED}❌ Python Manager (5000) - Not running${NC}"
    echo "   Start with: cd python-manager && python main.py"
fi

# Check Frontend (3001)
if check_port 3001; then
    echo -e "${GREEN}✅ Frontend (3001) - Running${NC}"
else
    echo -e "${RED}❌ Frontend (3001) - Not running${NC}"
    echo "   Start with: cd frontend && npm run dev"
fi

# Check Postgres (5433)
if check_port 5433; then
    echo -e "${GREEN}✅ PostgreSQL (5433) - Running${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL (5433) - Not running (optional for one-click)${NC}"
fi

echo ""
echo "🎯 One-Click Pipeline URL: http://localhost:3001/one-click"
echo ""
echo "📝 Quick Start Commands:"
echo "  1. cd tus-server && npm start &"
echo "  2. cd python-manager && python main.py &"
echo "  3. cd frontend && npm run dev"
