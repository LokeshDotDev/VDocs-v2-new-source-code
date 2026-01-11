#!/bin/bash

# 🔧 REBUILD AND TEST FIXES
# Run this to apply the fixes to your Docker containers

echo ""
echo "🔧 REBUILDING DOCKER SERVICES WITH FIXES"
echo "=========================================="
echo ""

cd "/Users/vivekvyas/Desktop/Vdocs/source code"

echo "Step 1: Stopping all services..."
docker compose -f docker-compose.production.yml down

echo ""
echo "Step 2: Rebuilding all services with new code..."
docker compose -f docker-compose.production.yml up --build -d

echo ""
echo "Step 3: Waiting for services to start (30 seconds)..."
sleep 30

echo ""
echo "Step 4: Checking service health..."
docker compose -f docker-compose.production.yml ps

echo ""
echo "=========================================="
echo "✅ SERVICES REBUILT"
echo "=========================================="
echo ""
echo "WHAT WAS FIXED:"
echo ""
echo "1. HUMANIZER (Aggressiveness: 50% AI → Target 30%)"
echo "   - Synonym replacement: 18% → 75%"
echo "   - Transition phrases: 8% → 45%"
echo "   - Attempts: 6 → 25"
echo "   - Similarity: 75% → 35% (stricter)"
echo ""
echo "2. REDUCTOR (PII Detection)"
echo "   - Now catches: LEARNER NAME"
echo "   - Now catches: LEARNER ROLL"
echo "   - All other PII patterns included"
echo ""
echo "=========================================="
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Go to http://localhost:3000"
echo "2. Upload your test document"
echo "3. Run redaction + humanization"
echo "4. Check ZeroGPT: should be ~30%"
echo "5. Check PII: LEARNER NAME & ROLL should be [REDACTED]"
echo ""
echo "✅ READY FOR TESTING!"
echo ""
