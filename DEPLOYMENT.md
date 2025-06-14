# Chess.com Helper Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Chess.com Helper application with email notifications on AWS EC2.

## Features Implemented

- ✅ User subscription system for email notifications
- ✅ Live match detection using Chess.com API
- ✅ Email notifications when subscribed players start live matches
- ✅ REST API endpoints for subscription management
- ✅ Background job for checking player status

## Prerequisites

- AWS account with EC2 access
- Domain name (optional but recommended)
- Email service provider (Gmail, SendGrid, etc.)

## Part 1: EC2 Instance Setup

### 1.1 Launch EC2 Instance

1. Launch an Ubuntu 22.04 LTS t3.medium instance
2. Configure security group:
   ```
   - SSH (22): Your IP
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0
   - Custom (8000): 0.0.0.0/0 (for development)
   ```
3. Create or use existing key pair
4. Launch instance

### 1.2 Connect and Update System

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Logout and login again for Docker permissions
exit
# Reconnect via SSH
```

### 1.3 Clone Repository

```bash
git clone https://github.com/your-username/chesscom-helper.git
cd chesscom-helper
```

## Part 2: Environment Configuration

### 2.1 Create Production Environment File

```bash
cp .env .env.production
```

Edit `.env.production` with production settings:

```bash
# Database Configuration
POSTGRES_USER=chesscom_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=chesscom_helper
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Django Configuration
DJANGO_SETTINGS_MODULE=config.settings.prod
DEBUG=False
SECRET_KEY=your_very_secure_secret_key_here
ALLOWED_HOSTS=your-domain.com,your-ec2-ip

# Email Configuration (Gmail example)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=Chess.com Helper <your-email@gmail.com>

# Static files
STATIC_ROOT=/app/static

# Security settings
SECURE_SSL_REDIRECT=True
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
```

### 2.2 Create Production Settings

Create `chesscom_helper/config/settings/prod.py`:

```python
from .base import *

DEBUG = False
ALLOWED_HOSTS = get_env_variable('ALLOWED_HOSTS', '').split(',')

# Security settings
SECURE_SSL_REDIRECT = get_env_variable('SECURE_SSL_REDIRECT', True)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': get_env_variable('POSTGRES_DB'),
        'USER': get_env_variable('POSTGRES_USER'),
        'PASSWORD': get_env_variable('POSTGRES_PASSWORD'),
        'HOST': get_env_variable('POSTGRES_HOST'),
        'PORT': get_env_variable('POSTGRES_PORT'),
    }
}

# Logging
LOGGING['handlers']['file']['filename'] = '/app/logs/production.log'
```

## Part 3: Application Deployment

### 3.1 Build and Start Services

```bash
# Use production environment
cp .env.production .env

# Create logs directory
mkdir -p logs

# Build and start services
sudo docker compose -f docker-compose.yml build
sudo docker compose -f docker-compose.yml up -d
```

### 3.2 Run Database Migrations

```bash
# Run migrations
sudo docker compose -f docker-compose.yml exec web python manage.py migrate

# Create superuser
sudo docker compose -f docker-compose.yml exec web python manage.py createsuperuser

# Collect static files
sudo docker compose -f docker-compose.yml exec web python manage.py collectstatic --noinput
```

### 3.3 Test the Application

```bash
# Check if services are running
sudo docker compose -f docker-compose.yml ps

# Test API endpoints
curl http://localhost:8000/api/chesscom-app/users/
```

## Part 4: Nginx Configuration

### 4.1 Create Nginx Configuration

Create `/etc/nginx/sites-available/chesscom-helper`:

```nginx
server {
    listen 80;
    server_name your-domain.com your-ec2-ip;
    
    client_max_body_size 100M;
    
    # Serve static files
    location /static/ {
        alias /home/ubuntu/chesscom-helper/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Proxy to Django
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 4.2 Enable Site and Start Nginx

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chesscom-helper /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4.3 SSL Certificate (Optional but Recommended)

```bash
# Install SSL certificate
sudo certbot --nginx -d your-domain.com

# Test renewal
sudo certbot renew --dry-run
```

## Part 5: Background Job Setup

### 5.1 Create Systemd Service for Live Match Checking

Create `/etc/systemd/system/chesscom-checker.service`:

```ini
[Unit]
Description=Chess.com Live Match Checker
After=docker.service

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/home/ubuntu/chesscom-helper
ExecStart=/usr/bin/docker compose -f docker-compose.yml exec -T web python manage.py check_live_matches --verbose
```

### 5.2 Create Timer for Regular Execution

Create `/etc/systemd/system/chesscom-checker.timer`:

```ini
[Unit]
Description=Run Chess.com checker every 5 minutes
Requires=chesscom-checker.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
```

### 5.3 Enable and Start Timer

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start timer
sudo systemctl enable chesscom-checker.timer
sudo systemctl start chesscom-checker.timer

# Check timer status
sudo systemctl status chesscom-checker.timer
```

## Part 6: API Usage

### 6.1 Available Endpoints

```bash
# Add a user to track
curl -X POST http://your-domain.com/api/chesscom-app/add-user/ \
  -H "Content-Type: application/json" \
  -d '{"username": "magnuscarlsen"}'

# Subscribe to notifications
curl -X POST http://your-domain.com/api/chesscom-app/subscribe/ \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "username": "magnuscarlsen"}'

# Get user's subscriptions
curl http://your-domain.com/api/chesscom-app/user/magnuscarlsen/subscriptions/

# Unsubscribe
curl -X POST http://your-domain.com/api/chesscom-app/unsubscribe/ \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "username": "magnuscarlsen"}'
```

### 6.2 Manual Live Match Check

```bash
# Run manual check
sudo docker compose -f docker-compose.yml exec web python manage.py check_live_matches --verbose
```

## Part 7: Monitoring and Maintenance

### 7.1 View Logs

```bash
# Application logs
sudo docker compose -f docker-compose.yml logs -f web

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u chesscom-checker.service -f
```

### 7.2 Database Backup

```bash
# Create backup
sudo docker compose -f docker-compose.yml exec db pg_dump -U chesscom_user chesscom_helper > backup.sql

# Restore backup
sudo docker compose -f docker-compose.yml exec -T db psql -U chesscom_user chesscom_helper < backup.sql
```

### 7.3 Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
sudo docker compose -f docker-compose.yml down
sudo docker compose -f docker-compose.yml build
sudo docker compose -f docker-compose.yml up -d

# Run migrations if needed
sudo docker compose -f docker-compose.yml exec web python manage.py migrate
```

## Troubleshooting

### Common Issues

1. **Port 8000 already in use**: Kill existing processes with `sudo lsof -ti:8000 | xargs kill -9`
2. **Database connection issues**: Check PostgreSQL container logs
3. **Email not sending**: Verify SMTP settings and app passwords
4. **Static files not loading**: Run `collectstatic` and check Nginx configuration

### Health Checks

```bash
# Check Docker containers
sudo docker compose -f docker-compose.yml ps

# Check services
sudo systemctl status nginx
sudo systemctl status chesscom-checker.timer

# Test API
curl -I http://your-domain.com/api/chesscom-app/users/
```

## Security Considerations

1. Change default passwords
2. Use environment variables for sensitive data
3. Enable SSL/TLS
4. Configure firewall rules
5. Regular security updates
6. Monitor application logs

## Performance Optimization

1. Configure PostgreSQL for production
2. Use Redis for caching (optional)
3. Implement rate limiting
4. Monitor resource usage
5. Set up proper logging rotation

---

Your Chess.com Helper application with email notifications is now deployed and ready to use!