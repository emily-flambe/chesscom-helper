#!/bin/bash

# Start Django backend server
export PATH="$HOME/.local/bin:$PATH"
export POSTGRES_DB=chesscom_helper
export POSTGRES_USER=chesscom_user
export POSTGRES_PASSWORD=chesscom_password
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export DJANGO_SETTINGS_MODULE=config.settings.dev

cd chesscom_helper

# Apply any pending migrations
echo "Applying migrations..."
poetry run python manage.py migrate

# Create admin user if it doesn't exist
echo "Checking for admin user..."
poetry run python manage.py shell -c "
from django.contrib.auth.models import User
import sys

if User.objects.filter(username='admin').exists():
    print('Admin user already exists')
else:
    print('Creating admin user...')
    user = User.objects.create_user('admin', 'admin@example.com', 'admin')
    user.is_superuser = True
    user.is_staff = True
    user.save()
    print('Admin user created (username: admin, password: admin)')
"

# Start the server
echo "Starting Django server on port 8002..."
poetry run python manage.py runserver 8002