#!/bin/bash

# ===============================================
# VDOCS - ONE COMMAND DEPLOY
# ===============================================
# Everything is configured and ready.
# This is the ONLY command you need to run.

echo "🚀 Starting Vdocs Application..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   VDOCS - Complete Application Stack"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Services starting:"
echo "  ✅ Frontend (3000)"
echo "  ✅ API Server (4000)"
echo "  ✅ File Upload (4001)"
echo "  ✅ PDF Converter (5000)"
echo "  ✅ Database (5432)"
echo "  ✅ PII Detection (5018)"
echo "  ✅ Text Paraphrasing (8000)"
echo "  ✅ Grammar Check (8001)"
echo "  ✅ Storage (9000 / 9001)"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Startup time: 3-5 minutes"
echo ""
echo "Stopping Docker containers? Press Ctrl+C"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Run the docker compose
docker compose -f docker-compose.production.yml up

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   Services have been stopped"
echo "═══════════════════════════════════════════════════════════"
