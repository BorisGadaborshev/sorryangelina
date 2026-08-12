# Sorry Angelina - VDS Deployment Guide

## Prerequisites

- Ubuntu 20.04+ VDS
- Domain name pointing to your server IP
- Root access or sudo privileges

## Quick Deployment

1. **Upload project files to server:**
   ```bash
   # On your local machine
   scp -r . root@your-server-ip:/tmp/sorryangelina
   
   # Or clone from git on server
   git clone https://github.com/yourusername/sorryangelina.git /tmp/sorryangelina
   ```

2. **Run deployment script:**
   ```bash
   # On server
   cd /tmp/sorryangelina
   chmod +x deploy/deploy.sh
   sudo ./deploy/deploy.sh
   ```

3. **Update configuration:**
   - Edit `/etc/systemd/system/sorryangelina.service` and update:
     - `DATABASE_URL` with your actual PostgreSQL connection string
     - Email in certbot command
   - Edit `/etc/nginx/sites-available/insretro.ru` if needed

4. **Restart services:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart sorryangelina
   sudo systemctl restart nginx
   ```

## Manual Setup

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install nginx and certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Setup Database

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE sorryangelina;
CREATE USER sorryangelina WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE sorryangelina TO sorryangelina;
ALTER USER sorryangelina CREATEDB;
\q
```

### 3. Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/sorryangelina
sudo chown www-data:www-data /var/www/sorryangelina

# Copy project files
sudo cp -r . /var/www/sorryangelina/
sudo chown -R www-data:www-data /var/www/sorryangelina

# Build application
cd /var/www/sorryangelina

# Build client
cd client
sudo -u www-data npm install --production
sudo -u www-data npm run build
cd ..

# Build server
cd server
sudo -u www-data npm install --production
sudo -u www-data npm run build
cd ..
```

### 4. Configure nginx

```bash
# Copy nginx config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/insretro.ru
sudo ln -sf /etc/nginx/sites-available/insretro.ru /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t
```

### 5. Setup SSL Certificate

```bash
sudo certbot --nginx -d insretro.ru -d www.insretro.ru --non-interactive --agree-tos --email your-email@example.com
```

### 6. Configure Systemd Service

```bash
# Copy service file
sudo cp deploy/sorryangelina.service /etc/systemd/system/

# Update environment variables in service file
sudo nano /etc/systemd/system/sorryangelina.service

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable sorryangelina
sudo systemctl start sorryangelina
```

### 7. Setup Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## Configuration Files

### Environment Variables

Update these in `/etc/systemd/system/sorryangelina.service`:

```ini
Environment=DATABASE_URL=postgres://sorryangelina:your-password@localhost:5432/sorryangelina
Environment=NODE_ENV=production
Environment=PORT=3001
```

### Client Configuration

Update `client/src/services/socket.ts` to use your domain:

```typescript
const serverUrl = process.env.NODE_ENV === 'production'
  ? 'https://insretro.ru'
  : 'http://localhost:3001';
```

## Management Commands

```bash
# Check service status
sudo systemctl status sorryangelina

# View logs
sudo journalctl -u sorryangelina -f

# Restart service
sudo systemctl restart sorryangelina

# Reload nginx
sudo systemctl reload nginx

# Update application
cd /var/www/sorryangelina
git pull origin main
cd client && npm run build
cd ../server && npm run build
sudo systemctl restart sorryangelina
```

## Troubleshooting

### Check nginx logs
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Check application logs
```bash
sudo journalctl -u sorryangelina -f
```

### Test database connection
```bash
sudo -u www-data psql postgres://sorryangelina:password@localhost:5432/sorryangelina
```

### Check SSL certificate
```bash
sudo certbot certificates
```

## Security Notes

1. Change default database password
2. Use strong passwords for all services
3. Keep system updated regularly
4. Monitor logs for suspicious activity
5. Consider setting up fail2ban
6. Regular backups of database and application files

## Backup Script

Create `/usr/local/bin/backup-sorryangelina`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/sorryangelina"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump sorryangelina > $BACKUP_DIR/db_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/sorryangelina

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
```

Make it executable:
```bash
sudo chmod +x /usr/local/bin/backup-sorryangelina
```

Add to crontab for daily backups:
```bash
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-sorryangelina
```
