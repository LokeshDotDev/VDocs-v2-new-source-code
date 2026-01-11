#!/bin/bash

# ✅ QUICK RESTART FOR LOCAL TESTING

echo ""
echo "🔄 RESTARTING REDUCTOR SERVICE WITH FIX"
echo "=========================================="
echo ""

# Kill any running reductor process on port 5018
echo "Step 1: Stopping any running reductor processes..."
lsof -i :5018 | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true

sleep 2

# Start the reductor service
echo ""
echo "Step 2: Starting reductor service with new code..."
echo ""

cd "/Users/vivekvyas/Desktop/Vdocs/source code/reductor-module/reductor-service-v2"
python3 ./main.py

echo ""
echo "✅ Service started. Test by uploading a document with PII."
echo ""
