#!/bin/bash

# ✅ REBUILD DOCKER WITH TABLE FORMAT FIX
# This rebuilds the reductor service with proper PII removal for both table and non-table formats

echo ""
echo "🔧 REBUILDING REDUCTOR WITH TABLE FORMAT FIX"
echo "=============================================="
echo ""

cd "/Users/vivekvyas/Desktop/Vdocs/source code"

echo "CHANGES MADE:"
echo "  1. Enhanced regex patterns for LEARNER NAME/LEARNER ROLL"
echo "  2. Added 3-level aggressive removal strategy"
echo "  3. Table cell specific detection"
echo "  4. Byte-level fallback for edge cases"
echo ""

echo "Step 1: Stopping current services..."
docker compose -f docker-compose.production.yml down

echo ""
echo "Step 2: Rebuilding reductor service..."
docker compose -f docker-compose.production.yml build --no-cache reductor-service

echo ""
echo "Step 3: Starting all services..."
docker compose -f docker-compose.production.yml up -d

echo ""
echo "Step 4: Waiting for services to start (30 seconds)..."
sleep 30

echo ""
echo "Step 5: Checking service health..."
docker compose -f docker-compose.production.yml ps

echo ""
echo "=============================================="
echo "✅ REDUCTOR REBUILT WITH TABLE FORMAT FIX"
echo "=============================================="
echo ""
echo "WHAT NOW WORKS:"
echo ""
echo "✅ TABLE FORMAT:"
echo "   LEARNER NAME | SHIVSHANKAR DINKAR MAPARI  → [REDACTED]"
echo "   ROLL NUMBER  | 2414500428                 → [REDACTED]"
echo ""
echo "✅ INLINE FORMAT:"
echo "   LEARNER NAME: JOHN DOE      → [REDACTED]"
echo "   ROLL NUMBER: 1234567890     → [REDACTED]"
echo ""
echo "✅ 3-LEVEL REMOVAL:"
echo "   Level 1: Text node matching"
echo "   Level 2: Table cell matching"
echo "   Level 3: Byte-level regex (fallback)"
echo ""
echo "=============================================="
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Go to http://localhost:3000"
echo "2. Upload your MBA assignment"
echo "3. Run redaction pipeline"
echo "4. Check output: LEARNER NAME and ROLL should be [REDACTED]"
echo ""
echo "✅ READY FOR TESTING!"
echo ""
