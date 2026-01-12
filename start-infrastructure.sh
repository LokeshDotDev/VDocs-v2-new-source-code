#!/bin/bash
# Start only PostgreSQL and MinIO locally
# These are the only infrastructure services you need

echo "🚀 Starting Infrastructure Services..."
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not installed. Installing..."
    brew install postgresql@15
fi

# Check if MinIO is installed
if ! command -v minio &> /dev/null; then
    echo "❌ MinIO not installed. Installing..."
    brew install minio/stable/minio
fi

# Start PostgreSQL
echo "📊 Starting PostgreSQL on port 5433..."
if [ -d "/opt/homebrew/var/postgresql@15" ]; then
    # M1/M2 Mac
    POSTGRES_PORT=5433 /opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15 -p 5433 > /tmp/postgres.log 2>&1 &
else
    # Intel Mac
    POSTGRES_PORT=5433 /usr/local/opt/postgresql@15/bin/postgres -D /usr/local/var/postgresql@15 -p 5433 > /tmp/postgres.log 2>&1 &
fi
sleep 2

# Create database if it doesn't exist
psql -h localhost -p 5433 -U $USER -d postgres -c "CREATE DATABASE wedocs;" 2>/dev/null || echo "Database 'wedocs' already exists"

# Start MinIO
echo "💾 Starting MinIO on ports 9000/9001..."
mkdir -p ~/minio-data
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin minio server ~/minio-data --address ":9000" --console-address ":9001" > /tmp/minio.log 2>&1 &

sleep 3

echo ""
echo "✅ Infrastructure Started!"
echo ""
echo "PostgreSQL: postgresql://postgres@localhost:5433/wedocs"
echo "MinIO API: http://localhost:9000"
echo "MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "To stop: killall postgres minio"
