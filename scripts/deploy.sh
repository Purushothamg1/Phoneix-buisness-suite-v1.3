#!/bin/bash
# ============================================================
# Phoneix Business Suite — Production Deploy / Update Script
# Usage: ./scripts/deploy.sh
# ============================================================

set -e

echo "========================================="
echo " Phoneix Business Suite — Deploy"
echo " $(date)"
echo "========================================="

# Run backup before deploying
echo "[1/5] Running pre-deploy backup..."
bash ./scripts/backup.sh ./backups/pre-deploy

# Pull latest changes
echo "[2/5] Pulling latest changes..."
git pull origin main

# Rebuild containers
echo "[3/5] Rebuilding containers..."
docker compose pull
docker compose up -d --build

# Wait for backend to be healthy
echo "[4/5] Waiting for services to be healthy..."
max_attempts=30
attempt=0
until docker compose exec -T backend curl -sf http://localhost:5000/health > /dev/null 2>&1; do
  attempt=$((attempt+1))
  if [ $attempt -ge $max_attempts ]; then
    echo "ERROR: Backend failed to become healthy after $max_attempts attempts"
    docker compose logs --tail=30 backend
    exit 1
  fi
  echo "      Waiting... ($attempt/$max_attempts)"
  sleep 3
done

# Run migrations
echo "[5/5] Running database migrations..."
docker compose exec backend npx prisma migrate deploy

echo ""
echo "✓ Deployment complete!"
echo ""
docker compose ps
