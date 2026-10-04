#!/bin/bash
# Dump the production database and keep the last 14 copies.
set -euo pipefail

APP_ENV="/root/apps/sorryangelina/server/.env"
BACKUP_DIR="/var/backups/sorryangelina"
KEEP=14

if [ -z "${DATABASE_URL:-}" ] && [ -f "$APP_ENV" ]; then
  DATABASE_URL=$(grep -E '^[[:space:]]*DATABASE_URL=' "$APP_ENV" | head -1 | cut -d= -f2-)
  DATABASE_URL=${DATABASE_URL%\"}
  DATABASE_URL=${DATABASE_URL#\"}
  export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
stamp=$(date +%Y%m%d_%H%M)
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db_${stamp}.sql.gz"

ls -1t "$BACKUP_DIR"/db_*.sql.gz | awk "NR>${KEEP}" | while read -r old; do
  rm -f "$old"
done

echo "Backup written to $BACKUP_DIR/db_${stamp}.sql.gz"
