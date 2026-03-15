#!/bin/bash
# ============================================================
# Phoneix Business Suite — Database + Files Backup Script
# Usage: ./scripts/backup.sh [backup-dir]
# ============================================================

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_BACKUP="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
FILES_BACKUP="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"

# Load env
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

POSTGRES_DB="${POSTGRES_DB:-phoneix}"
POSTGRES_USER="${POSTGRES_USER:-phoneix}"

echo "========================================="
echo " Phoneix Business Suite — Backup"
echo " Timestamp: $TIMESTAMP"
echo "========================================="

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
echo "[1/3] Backing up database..."
docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" \
  "$POSTGRES_DB" | gzip > "$DB_BACKUP"
echo "      Database backup: $DB_BACKUP ($(du -sh $DB_BACKUP | cut -f1))"

# Uploads backup
if [ -d "./uploads" ]; then
  echo "[2/3] Backing up uploaded files..."
  tar -czf "$FILES_BACKUP" ./uploads/
  echo "      Files backup: $FILES_BACKUP ($(du -sh $FILES_BACKUP | cut -f1))"
else
  echo "[2/3] No uploads directory found, skipping."
fi

# Cleanup old backups (keep last 7 days)
echo "[3/3] Cleaning up backups older than 7 days..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +7 -delete

echo ""
echo "✓ Backup complete!"
echo ""
echo "To restore database:"
echo "  gunzip -c $DB_BACKUP | docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB"
