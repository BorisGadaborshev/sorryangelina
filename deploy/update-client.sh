#!/bin/bash

# Update client script for Sorry Angelina
# Run as root or with sudo

set -e

APP_DIR="/var/www/sorryangelina"

echo "🔄 Updating Sorry Angelina client..."

cd $APP_DIR

# Pull latest changes
git pull origin main

# Build client
echo "🔨 Building React client..."
npm ci -w shared -w client
npm run build -w client

# Reload nginx to serve new static files
echo "🌐 Reloading nginx..."
systemctl reload nginx

echo "✅ Client update completed!"
echo "🌐 New version is now live at https://insretro.ru"
