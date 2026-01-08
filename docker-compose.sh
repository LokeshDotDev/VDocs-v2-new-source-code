#!/bin/bash

# =========================================
# Vdocs Docker Compose Startup Script
# =========================================
# This script helps you quickly start the Vdocs application using Docker Compose

set -e

COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install it first."
    exit 1
fi

print_info "Docker: $(docker --version)"
print_info "Docker Compose: $(docker compose version)"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    print_warning "$ENV_FILE not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example "$ENV_FILE"
        print_info "Created $ENV_FILE from .env.example"
        print_warning "Please review and update $ENV_FILE with your configuration"
    else
        print_error ".env.example not found. Cannot create $ENV_FILE"
        exit 1
    fi
fi

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Docker compose file not found: $COMPOSE_FILE"
    exit 1
fi

print_info "Starting Vdocs Application with Docker Compose..."
print_info "Compose file: $COMPOSE_FILE"

# Parse command line arguments
case "${1:-up}" in
    up)
        print_info "Building and starting all services..."
        docker compose -f "$COMPOSE_FILE" up -d
        
        print_info "Waiting for services to start..."
        sleep 5
        
        print_info "Checking service status..."
        docker compose -f "$COMPOSE_FILE" ps
        
        print_info ""
        print_info "=========================================="
        print_info "✅ Vdocs Services Started Successfully!"
        print_info "=========================================="
        print_info ""
        print_info "Access the application:"
        print_info "  Frontend:     http://localhost:3000"
        print_info "  API Server:   http://localhost:4000"
        print_info "  MinIO Console: http://localhost:9001"
        print_info ""
        print_info "Default MinIO credentials:"
        print_info "  Username: minioadmin"
        print_info "  Password: minioadmin"
        print_info ""
        print_info "To view logs:"
        print_info "  docker compose -f $COMPOSE_FILE logs -f"
        print_info ""
        ;;
        
    down)
        print_info "Stopping all services..."
        docker compose -f "$COMPOSE_FILE" down
        print_info "All services stopped."
        ;;
        
    restart)
        print_info "Restarting all services..."
        docker compose -f "$COMPOSE_FILE" restart
        print_info "All services restarted."
        ;;
        
    logs)
        print_info "Showing logs for all services (Ctrl+C to exit)..."
        docker compose -f "$COMPOSE_FILE" logs -f
        ;;
        
    logs-server)
        docker compose -f "$COMPOSE_FILE" logs -f server
        ;;
        
    logs-reductor)
        docker compose -f "$COMPOSE_FILE" logs -f reductor-service
        ;;
        
    logs-humanizer)
        docker compose -f "$COMPOSE_FILE" logs -f humanizer-service
        ;;
        
    ps)
        print_info "Current service status:"
        docker compose -f "$COMPOSE_FILE" ps
        ;;
        
    health)
        print_info "Checking health of services..."
        echo ""
        echo "Frontend:        http://localhost:3000"
        curl -s http://localhost:3000 > /dev/null && echo "  ✅ Running" || echo "  ❌ Not responding"
        
        echo "API Server:      http://localhost:4000/health"
        curl -s http://localhost:4000/health > /dev/null && echo "  ✅ Healthy" || echo "  ❌ Not responding"
        
        echo "TUS Server:      http://localhost:4001"
        curl -s http://localhost:4001 > /dev/null && echo "  ✅ Running" || echo "  ❌ Not responding"
        
        echo "Reductor:        http://localhost:5018/health"
        curl -s http://localhost:5018/health > /dev/null && echo "  ✅ Healthy" || echo "  ❌ Not responding"
        
        echo "PDF Converter:   http://localhost:5000/health"
        curl -s http://localhost:5000/health > /dev/null && echo "  ✅ Healthy" || echo "  ❌ Not responding"
        
        echo "Humanizer:       http://localhost:8000/health"
        curl -s http://localhost:8000/health > /dev/null && echo "  ✅ Healthy" || echo "  ❌ Not responding"
        
        echo "Spell/Grammar:   http://localhost:8001/health"
        curl -s http://localhost:8001/health > /dev/null && echo "  ✅ Healthy" || echo "  ❌ Not responding"
        
        echo "MinIO:           http://localhost:9000/minio/health/live"
        curl -s http://localhost:9000/minio/health/live > /dev/null && echo "  ✅ Healthy" || echo "  ❌ Not responding"
        
        echo ""
        ;;
        
    clean)
        print_warning "This will remove all containers, networks, and volumes (data will be lost)!"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            print_info "Cleaning up..."
            docker compose -f "$COMPOSE_FILE" down -v
            print_info "Cleanup complete."
        else
            print_info "Cleanup cancelled."
        fi
        ;;
        
    rebuild)
        print_info "Rebuilding all images..."
        docker compose -f "$COMPOSE_FILE" down
        docker compose -f "$COMPOSE_FILE" up -d --build
        print_info "Rebuild complete. Services are starting..."
        ;;
        
    *)
        print_info "Vdocs Docker Compose Management Script"
        echo ""
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  up              - Start all services (default)"
        echo "  down            - Stop all services"
        echo "  restart         - Restart all services"
        echo "  logs            - View logs for all services"
        echo "  logs-server     - View logs for API server"
        echo "  logs-reductor   - View logs for reductor service"
        echo "  logs-humanizer  - View logs for humanizer service"
        echo "  ps              - Show service status"
        echo "  health          - Check health of all services"
        echo "  clean           - Remove all containers, networks, volumes (WARNING: removes data)"
        echo "  rebuild         - Rebuild all Docker images and start"
        echo ""
        echo "Examples:"
        echo "  $0 up"
        echo "  $0 logs"
        echo "  $0 health"
        ;;
esac
