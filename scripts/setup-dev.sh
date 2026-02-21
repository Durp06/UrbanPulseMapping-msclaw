#!/bin/bash
set -e

echo "🌳 Urban Pulse Mapping — Development Setup"
echo "============================================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 20+ required. Install via nvm."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm required. Run: npm install -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker (or OrbStack) required."; exit 1; }

# Check Xcode CLI tools and simulator
xcode-select -p >/dev/null 2>&1 || { echo "❌ Xcode CLI tools required. Run: xcode-select --install"; exit 1; }
xcrun simctl list devices available | grep -q "iPhone" || { echo "⚠️  No iOS simulators found. Open Xcode > Settings > Platforms > install iOS 18 Simulator."; }

# 1. Install all dependencies
echo "📦 Installing dependencies..."
pnpm install

# 2. Start infrastructure
echo "🐳 Starting Docker containers..."
docker compose up -d
echo "Waiting for Postgres to be ready..."
until docker compose exec -T postgres pg_isready -U dev -d urban_pulse_dev 2>/dev/null; do
  sleep 1
done
echo "✅ Postgres ready"

# 3. Create MinIO bucket
echo "🪣 Creating S3 bucket in MinIO..."
docker compose exec -T minio mc alias set local http://localhost:9000 minioaccess miniosecret 2>/dev/null || \
  docker run --rm --network host minio/mc alias set local http://localhost:9000 minioaccess miniosecret
docker compose exec -T minio mc mb local/urban-pulse-photos --ignore-existing 2>/dev/null || \
  docker run --rm --network host minio/mc mb local/urban-pulse-photos --ignore-existing
docker compose exec -T minio mc anonymous set download local/urban-pulse-photos 2>/dev/null || \
  docker run --rm --network host minio/mc anonymous set download local/urban-pulse-photos

# 4. Copy env files
echo "📋 Setting up environment files..."
cp .env.example .env 2>/dev/null || true
cp .env.example apps/api/.env 2>/dev/null || true

# 5. Run database migrations
echo "🗄️  Running database migrations..."
pnpm --filter @urban-pulse/api run db:migrate

# 6. Seed sample data
echo "🌱 Seeding sample tree data..."
pnpm --filter @urban-pulse/api run db:seed

echo ""
echo "============================================"
echo "✅ Setup complete!"
echo ""
echo "To start developing:"
echo "  Terminal 1: docker compose up -d       (if not already running)"
echo "  Terminal 2: pnpm turbo run dev         (starts API + mobile)"
echo ""
echo "  API:     http://localhost:3000"
echo "  MinIO:   http://localhost:9001 (minioaccess/miniosecret)"
echo "  Mobile:  Opens in iOS Simulator automatically"
echo "============================================"
