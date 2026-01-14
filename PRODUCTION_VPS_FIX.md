# 🚨 PRODUCTION VPS CONFIGURATION GUIDE

## THE PROBLEM YOU'RE FACING

Your logs show:
```
uploadUrl: 'http://localhost:4001/files'
```

**This is WRONG for production!** Here's why:

1. The **backend** sends this URL to the **frontend**
2. The **frontend** sends this URL to the **user's browser**
3. The **browser** tries to upload to `localhost:4001` on the **user's computer**
4. **Upload fails** because the TUS server is on your VPS, not the user's machine

---

## THE FIX

### Step 1: Update Server Environment Variables

Edit `/server/.env` on your **VPS** and set:

```bash
# Replace with your actual domain or VPS IP
TUS_SERVER_URL=https://yourdomain.com:4001

# Or if using IP address:
TUS_SERVER_URL=http://YOUR_VPS_IP:4001

# Or if behind nginx reverse proxy:
TUS_SERVER_URL=https://yourdomain.com/api/upload
```

### Step 2: Verify Service Names (Docker)

If using Docker Compose, services should use **service names**, not localhost:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/wedocs

# MinIO
MINIO_ENDPOINT=minio

# Python Services
PYTHON_MANAGER_URL=http://python-manager:5050
CONVERTER_MODULE_URL=http://converter:5001
REDUCTOR_V2_MODULE_URL=http://reductor:5017
REDUCTOR_V3_MODULE_URL=http://reductor:5018
AI_DETECTOR_MODULE_URL=http://ai-detector:5003
HUMANIZER_MODULE_URL=http://humanizer:8000
```

### Step 3: Update CORS

Allow your actual domain:

```env
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

### Step 4: Restart Services

```bash
docker-compose down
docker-compose up -d
```

---

## CONFIGURATION EXAMPLES

### Example 1: Production with Domain + SSL

```env
# Server .env
TUS_SERVER_URL=https://yourdomain.com/upload
CORS_ORIGIN=https://yourdomain.com

# Frontend .env.local
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

### Example 2: Production with IP Address

```env
# Server .env
TUS_SERVER_URL=http://123.45.67.89:4001
CORS_ORIGIN=http://123.45.67.89:3001

# Frontend .env.local
NEXT_PUBLIC_API_URL=http://123.45.67.89:4000
```

### Example 3: Behind Nginx Reverse Proxy

```env
# Server .env
TUS_SERVER_URL=https://yourdomain.com/api/tus
CORS_ORIGIN=https://yourdomain.com

# Nginx config
location /api/tus {
    proxy_pass http://tus-server:4001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 20G;
}
```

---

## WHAT GETS FIXED

### Before (Broken in Production):
```typescript
// Server sends to frontend:
uploadUrl: 'http://localhost:4001/files'

// Browser tries to upload to user's localhost ❌
// Upload fails!
```

### After (Working in Production):
```typescript
// Server sends to frontend:
uploadUrl: 'https://yourdomain.com:4001/files'

// Browser uploads to your VPS ✅
// Upload succeeds!
```

---

## VERIFICATION STEPS

### 1. Check Server Logs
After restart, you should see:
```
📤 Returning upload config: {
  jobId: 'job-2026-01-14-...',
  uploadUrl: 'https://yourdomain.com:4001/files',  ← NOT localhost!
  metadata: { ... }
}
```

### 2. Test Upload Endpoint
```bash
curl https://yourdomain.com:4001/health
# Should return: {"status":"ok"}
```

### 3. Test from Frontend
Open browser console and check network requests:
- Upload URL should point to your domain, not localhost
- File upload should POST to your VPS

---

## COMMON ISSUES & SOLUTIONS

### Issue 1: CORS Error
```
Access to fetch at 'https://yourdomain.com:4001' from origin 'https://yourdomain.com' 
has been blocked by CORS policy
```

**Solution**: Add to `tus-server/src/index.ts`:
```typescript
app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ],
  credentials: true,
  // ... rest of TUS headers
}));
```

### Issue 2: Mixed Content (HTTP/HTTPS)
```
Mixed Content: The page at 'https://yourdomain.com' was loaded over HTTPS, 
but requested an insecure resource 'http://yourdomain.com:4001'
```

**Solution**: Use HTTPS for TUS server or put it behind reverse proxy

### Issue 3: Port Not Accessible
```
Failed to fetch: net::ERR_CONNECTION_REFUSED
```

**Solution**: 
1. Check firewall allows port 4001
2. Check Docker port mapping: `docker ps`
3. Verify TUS server is running: `docker logs tus-server`

### Issue 4: Still Seeing localhost
```
uploadUrl: 'http://localhost:4001/files'
```

**Solution**:
1. Verify `.env` has `TUS_SERVER_URL` set
2. Restart server: `docker-compose restart server`
3. Check environment: `docker exec server env | grep TUS`

---

## DOCKER COMPOSE EXAMPLE

```yaml
version: '3.8'

services:
  server:
    build: ./server
    environment:
      - TUS_SERVER_URL=https://yourdomain.com:4001
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/wedocs
      - MINIO_ENDPOINT=minio
      - CORS_ORIGIN=https://yourdomain.com
    ports:
      - "4000:4000"
    depends_on:
      - db
      - minio
      - tus-server

  tus-server:
    build: ./tus-server
    environment:
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_BUCKET=wedocs
    ports:
      - "4001:4001"
    volumes:
      - tus-data:/var/tus/data
    depends_on:
      - minio

  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL=https://yourdomain.com
    ports:
      - "3001:3001"

  minio:
    image: minio/minio
    command: server /data
    ports:
      - "9000:9000"
    volumes:
      - minio-data:/data

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=wedocs
      - POSTGRES_PASSWORD=postgres
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  tus-data:
  minio-data:
  db-data:
```

---

## QUICK FIX CHECKLIST

- [ ] Set `TUS_SERVER_URL` in server/.env to your domain/IP
- [ ] Change `DATABASE_URL` from localhost to `db` (Docker service name)
- [ ] Change `MINIO_ENDPOINT` from localhost to `minio`
- [ ] Change all microservice URLs to use service names
- [ ] Update `CORS_ORIGIN` to your actual domain
- [ ] Restart all services
- [ ] Test upload and verify uploadUrl in logs
- [ ] Check browser console for CORS/network errors

---

**After these changes, your uploadUrl will be public and uploads will work!** 🎉
