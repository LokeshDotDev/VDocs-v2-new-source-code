#!/bin/bash

# VDocs Quick Setup Script
# This script helps set up the development environment

set -e  # Exit on error

echo "🚀 VDocs Setup Script"
echo "====================="
echo ""

# Check if PostgreSQL is running
echo "📊 Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install it first."
    exit 1
fi

# Check if Docker is running
echo "🐳 Checking Docker..."
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit frontend/.env and set:"
    echo "   - DATABASE_URL (PostgreSQL connection)"
    echo "   - NEXTAUTH_SECRET (run: openssl rand -base64 32)"
    echo "   - ADMIN_EMAIL (your email for admin access)"
    echo ""
    read -p "Press Enter after updating .env file..."
fi

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Ask to create database
echo ""
read -p "Do you want to create the database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Running database migrations..."
    npx prisma migrate dev --name init
    echo "✅ Database setup complete!"
else
    echo "⚠️  Remember to run: npx prisma migrate dev --name init"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Start Docker services: docker-compose up"
echo "2. Start backend server: cd server && npm run dev"
echo "3. Start frontend: cd frontend && npm run dev"
echo "4. Visit: http://localhost:3001"
echo ""
echo "For detailed instructions, see SETUP_INSTRUCTIONS.md"
