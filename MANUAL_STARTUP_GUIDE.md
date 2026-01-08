ai#!/bin/bash
# 
# 🚀 MANUAL STARTUP GUIDE - ONE-CLICK SYSTEM
# Run each service in a separate terminal to see live logs
# 

cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         🚀 MANUAL STARTUP GUIDE - RUN WITH LIVE LOGS                     ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

You need to run 7 services. Follow the steps below to start each one
in a SEPARATE TERMINAL so you can see all logs in real-time.

════════════════════════════════════════════════════════════════════════════

SERVICE 1: MINIO (File Storage) - Port 9000
────────────────────────────────────────────────────────────────────────────

Already running via Docker? Check:
  docker ps | grep minio

If not running, start it:
  docker-compose -f /Users/vivekvyas/Desktop/Vdocs/source\ code/docker-compose.yml up minio

Expected output:
  MinIO Object Storage Server running...
  Browser Access: http://localhost:9000/minio


════════════════════════════════════════════════════════════════════════════

SERVICE 2: PYTHON MANAGER - Port 5050
────────────────────────────────────────────────────────────────────────────

TERMINAL 1 (Python Manager):

  cd /Users/vivekvyas/Desktop/Vdocs/source\ code
  source .venv/bin/activate
  cd python-manager
  python3 ./main.py

Expected output:
  ✓ 2026-01-07 XX:XX:XX - Binoculars detector initialized
  ✓ INFO: Started server process [PID]
  ✓ INFO: Application startup complete
  ✓ INFO: Uvicorn running on http://0.0.0.0:5050


════════════════════════════════════════════════════════════════════════════

SERVICE 3: REDUCTOR V2 - Port 5018
────────────────────────────────────────────────────────────────────────────

TERMINAL 2 (Reductor V2):

  cd /Users/vivekvyas/Desktop/Vdocs/source\ code/reductor-module/reductor-service-v2
  python3 main.py

Expected output:
  ✓ INFO: Reductor service started
  ✓ INFO: Listening on 0.0.0.0:5018
  ✓ Healthy status responses


════════════════════════════════════════════════════════════════════════════

SERVICE 4: HUMANIZER - Port 8000
────────────────────────────────────────────────────────────────────────────

TERMINAL 3 (Humanizer):

  cd /Users/vivekvyas/Desktop/Vdocs/source\ code/python-manager/modules/humanizer
  source /Users/vivekvyas/Desktop/Vdocs/source\ code/.venv/bin/activate
  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

Expected output:
  ✓ INFO: Started server process [PID]
  ✓ INFO: Application startup complete
  ✓ Uvicorn running on http://0.0.0.0:8000


════════════════════════════════════════════════════════════════════════════

SERVICE 5: SPELL/GRAMMAR CHECKER - Port 5003
────────────────────────────────────────────────────────────────────────────

TERMINAL 4 (Grammar Checker):

  cd /Users/vivekvyas/Desktop/Vdocs/source\ code/python-manager/modules/spell-grammar-checker
  source /Users/vivekvyas/Desktop/Vdocs/source\ code/.venv/bin/activate
  python3 main.py

Expected output:
  ✓ Grammar checker service started
  ✓ Listening on port 5003


════════════════════════════════════════════════════════════════════════════

SERVICE 6: TUS SERVER - Port 4001
────────────────────────────────────────────────────────────────────────────

TERMINAL 5 (TUS Server):

  cd /Users/vivekvyas/Desktop/Vdocs/source\ code/tus-server
  npm install  (if needed)
  npm start

Expected output:
  ✓ TUS Server listening on http://0.0.0.0:4001
  ✓ MinIO health check passed


════════════════════════════════════════════════════════════════════════════

SERVICE 7: NODE.JS SERVER (Main API) - Port 4000
────────────────────────────────────────────────────────────────────────────

TERMINAL 6 (Node Server):

  cd /Users/vivekvyas/Desktop/Vdocs/source\ code/server
  npm install  (if needed)
  npm start

Expected output:
  ✓ Server running on http://localhost:4000
  ✓ Connected to database
  ✓ All routes registered


════════════════════════════════════════════════════════════════════════════

SERVICE 8: FRONTEND (Optional) - Port 3000
────────────────────────────────────────────────────────────────────────────

TERMINAL 7 (Frontend):

  cd /Users/vivekvyas/Desktop/Vdocs/source\ code/frontend
  npm install  (if needed)
  npm run dev

Expected output:
  ✓ Ready in XXXms
  ✓ ▲ Next.js X.X.X
  ✓ Local: http://localhost:3000


════════════════════════════════════════════════════════════════════════════

✅ VERIFICATION - After all services are running:
────────────────────────────────────────────────────────────────────────────

Test each service:

  # Test Python Manager
  curl -s http://localhost:5050/health | python3 -m json.tool

  # Test Reductor
  curl -s http://localhost:5018/health | python3 -m json.tool

  # Test Humanizer
  curl -s http://localhost:8000/health | python3 -m json.tool

  # Test Server
  curl -s http://localhost:4000/ 2>&1 | head -20

  # Test TUS
  curl -s http://localhost:4001/health | python3 -m json.tool


════════════════════════════════════════════════════════════════════════════

🧪 TEST THE COMPLETE PIPELINE:
────────────────────────────────────────────────────────────────────────────

Once all services are running, test the one-click flow:

  python3 /tmp/test_one_click_simplified.py

OR manually:

  # 1. Initialize job
  curl -X POST http://localhost:4000/api/one-click/upload \
    -H "Content-Type: application/json" \
    -d '{"fileCount": 3}'

  # 2. Upload files to MinIO
  # 3. Start processing
  # 4. Check status


════════════════════════════════════════════════════════════════════════════

📊 MONITORING LOGS:
────────────────────────────────────────────────────────────────────────────

As you run the pipeline, you'll see logs in each terminal:

  Terminal 1 (Python Manager):
    ✓ Text extraction requests
    ✓ Binoculars AI detection results
    ✓ Processing status

  Terminal 2 (Reductor V2):
    ✓ PDF anonymization progress
    ✓ PII removal status
    ✓ Output file generation

  Terminal 3 (Humanizer):
    ✓ Humanization requests
    ✓ Processing progress
    ✓ Results

  Terminal 4 (Grammar Checker):
    ✓ Grammar correction requests
    ✓ Output generation

  Terminal 5 (TUS Server):
    ✓ File upload events
    ✓ Upload completion

  Terminal 6 (Node Server):
    ✓ API request logging
    ✓ Job status updates
    ✓ Error messages

  Terminal 7 (Frontend):
    ✓ Build status
    ✓ Hot reload events


════════════════════════════════════════════════════════════════════════════

🛑 STOPPING SERVICES:
────────────────────────────────────────────────────────────────────────────

To stop any service, press: Ctrl+C in that terminal

To kill all at once:
  pkill -f "python3"
  pkill -f "npm"
  pkill -f "node"


════════════════════════════════════════════════════════════════════════════

💡 TIPS:
────────────────────────────────────────────────────────────────────────────

1. Use `tmux` or `screen` to manage multiple terminals easily
2. Check port availability: lsof -i :<PORT>
3. Kill specific process: lsof -ti:<PORT> | xargs kill -9
4. Tail logs: tail -f <logfile>
5. Monitor in real-time: watch 'curl -s http://localhost:PORT/health'


════════════════════════════════════════════════════════════════════════════

Ready to start? Run each terminal command above one by one! 🚀

EOF
