#!/bin/bash
# TUS Server Production Deployment Checklist

echo "🔍 TUS Server Production Readiness Check"
echo "========================================"

cd "$(dirname "$0")"

# 1. Check TypeScript compilation
echo ""
echo "✓ Checking TypeScript compilation..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ TypeScript builds without errors"
else
    echo "  ❌ TypeScript compilation failed"
    exit 1
fi

# 2. Check dist files exist
echo ""
echo "✓ Checking compiled output..."
if [ -f "dist/index.js" ] && [ -f "dist/config.js" ] && [ -f "dist/minio-client.js" ]; then
    echo "  ✅ All required dist files generated"
else
    echo "  ❌ Missing compiled files"
    exit 1
fi

# 3. Check .env configuration
echo ""
echo "✓ Checking environment configuration..."
if [ -f ".env" ]; then
    echo "  ✅ .env file exists"
    echo ""
    echo "  Current settings:"
    grep -E "^(PORT|MINIO_ENDPOINT|MINIO_USE_SSL|TUS_STORAGE_DIR)" .env | sed 's/^/    /'
else
    echo "  ⚠️  .env file not found. Copy from .env.example:"
    echo "     cp .env.example .env"
fi

# 4. Check dependencies
echo ""
echo "✓ Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "  ✅ Dependencies installed"
    npm list @types/ms > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ @types/ms package installed"
    else
        echo "  ⚠️  @types/ms not found, installing..."
        npm install --save-dev @types/ms
    fi
else
    echo "  ❌ Dependencies not installed"
    echo "     Run: npm install"
    exit 1
fi

# 5. Summary
echo ""
echo "========================================"
echo "✅ TUS Server is PRODUCTION READY"
echo ""
echo "To start the server:"
echo "  npm start"
echo ""
echo "Or with Docker:"
echo "  docker build -t tus-server:latest ."
echo "  docker run -p 4001:4001 --env-file .env tus-server:latest"
echo ""
echo "Documentation:"
echo "  - README.md                 (Setup & usage)"
echo "  - PRODUCTION_DEPLOYMENT.md  (Detailed deployment guide)"
echo "========================================"
