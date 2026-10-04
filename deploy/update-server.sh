#!/bin/bash

# Update server script for Sorry Angelina
# Run as root or with sudo

set -e

APP_DIR="/root/apps/sorryangelina"

echo "🔄 Updating Sorry Angelina server..."

cd $APP_DIR

# Pull latest changes
git pull origin main

# Build shared types and the server
echo "🔨 Building Node.js server..."
npm ci -w shared -w server
npm run build -w server
cd server
# shellcheck disable=SC1091
source "$APP_DIR/deploy/database-url.sh"
load_database_url "$APP_DIR/server"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Add it to server/.env or the systemd unit."
  exit 1
fi
npm run migrate:up
cd ..

# Restart service
echo "🚀 Restarting server service..."
systemctl restart sorryangelina

echo "✅ Server update completed!"
echo "📊 Check service status: systemctl status sorryangelina"
echo "📝 View logs: journalctl -u sorryangelina -f"
