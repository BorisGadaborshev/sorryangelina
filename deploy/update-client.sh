#!/bin/bash

# Update client script for Sorry Angelina
# Run as root or with sudo

set -e

APP_DIR="/root/apps/sorryangelina"
WEB_ROOT="/var/www/sorryangelina/client/build"

echo "🔄 Updating Sorry Angelina client..."

cd $APP_DIR

# Pull latest changes
git pull origin main

# Build client. All workspaces share one node_modules, so install every one
# of them: a partial `npm ci` would drop the running server's dependencies.
echo "🔨 Building React client..."
npm ci
npm run build -w client

# Publish the build where nginx serves it from
echo "📦 Publishing build to $WEB_ROOT..."
mkdir -p "$WEB_ROOT"
rsync -a --delete "$APP_DIR/client/build/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

# Reload nginx to serve new static files
echo "🌐 Reloading nginx..."
systemctl reload nginx

echo "✅ Client update completed!"
echo "🌐 New version is now live at https://insretro.ru"
