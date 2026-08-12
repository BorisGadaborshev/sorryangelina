#!/bin/bash

# Sorry Angelina Retro Board Deployment Script
# Run as root or with sudo

set -e

echo "🚀 Starting Sorry Angelina deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="insretro.ru"
APP_DIR="/var/www/sorryangelina"
DB_NAME="sorryangelina"
DB_USER="sorryangelina"
DB_PASS="sorryangelina"

echo -e "${GREEN}📋 Configuration:${NC}"
echo "Domain: $DOMAIN"
echo "App directory: $APP_DIR"
echo "Database: $DB_NAME"

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required packages
echo -e "${YELLOW}📦 Installing required packages...${NC}"
apt install -y curl wget git build-essential certbot python3-certbot-nginx

# Install Node.js 18.x
echo -e "${YELLOW}📦 Installing Node.js 18.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PostgreSQL
echo -e "${YELLOW}📦 Installing PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib

# Create database and user
echo -e "${YELLOW}🗄️ Setting up PostgreSQL...${NC}"
sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF

# Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
mkdir -p $APP_DIR
chown www-data:www-data $APP_DIR

# Clone or copy project files
echo -e "${YELLOW}📥 Setting up project files...${NC}"
# If you have the project locally, copy it:
# cp -r . $APP_DIR/
# Or clone from git:
# git clone https://github.com/yourusername/sorryangelina.git $APP_DIR

# Set proper permissions
chown -R www-data:www-data $APP_DIR

# Install dependencies and build
echo -e "${YELLOW}🔨 Building application...${NC}"
cd $APP_DIR

# Build client
echo "Building React client..."
cd client
npm install --production
npm run build
cd ..

# Build server
echo "Building Node.js server..."
cd server
npm install --production
npm run build
cd ..

# Create logs directory
mkdir -p $APP_DIR/server/logs
chown www-data:www-data $APP_DIR/server/logs

# Setup nginx
echo -e "${YELLOW}🌐 Setting up nginx...${NC}"
cp deploy/nginx.conf /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Setup systemd service
echo -e "${YELLOW}⚙️ Setting up systemd service...${NC}"
cp deploy/sorryangelina.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable sorryangelina

# Get SSL certificate
echo -e "${YELLOW}🔒 Getting SSL certificate...${NC}"
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email your-email@example.com

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
systemctl start sorryangelina
systemctl restart nginx

# Setup firewall
echo -e "${YELLOW}🔥 Setting up firewall...${NC}"
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Create deployment script
cat > /usr/local/bin/deploy-sorryangelina << 'EOF'
#!/bin/bash
cd /var/www/sorryangelina
git pull origin main

# Build client
cd client
npm install --production
npm run build
cd ..

# Build server
cd server
npm install --production
npm run build
cd ..

# Restart service
systemctl restart sorryangelina
systemctl reload nginx

echo "Deployment completed!"
EOF

chmod +x /usr/local/bin/deploy-sorryangelina

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your application is available at: https://$DOMAIN${NC}"
echo -e "${GREEN}📊 To check service status: systemctl status sorryangelina${NC}"
echo -e "${GREEN}📝 To view logs: journalctl -u sorryangelina -f${NC}"
echo -e "${GREEN}🔄 To deploy updates: deploy-sorryangelina${NC}"

# Show service status
systemctl status sorryangelina --no-pager
