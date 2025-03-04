# ===== Stage 1: Base (shared code) =====
FROM python:3.12.8-slim-bookworm AS base
WORKDIR /app

# Install system dependencies required for the Python backend
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install Poetry for dependency management
RUN pip install --upgrade pip && pip install poetry

# Copy dependency descriptors (adjust paths if needed)
COPY chesscom_helper/pyproject.toml chesscom_helper/poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-root

# Copy entire application code
COPY chesscom_helper/ /app/

# ===== Stage 2: Backend Development =====
FROM base AS backend
EXPOSE 8000
# Migrate then start the Django development server
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]

# ===== Stage 3: Frontend Development =====
FROM node:20-alpine AS frontend-dev
WORKDIR /app/frontend

# Copy package.json files and install Node dependencies
COPY chesscom_helper/frontend/package*.json ./
RUN npm ci --legacy-peer-deps

# Copy entire frontend source code (and .env if required)
COPY chesscom_helper/frontend/ ./
# COPY chesscom_helper/.env .env  # Uncomment if your frontend needs environment variables

EXPOSE 5173
# Run the Vite (or similar) dev server binding to all interfaces
CMD ["sh", "-c", "npm run dev -- --host"]

# ===== Stage 4: Frontend Production Builder =====
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Increase Node memory limit for building if necessary
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files and install dependencies
COPY chesscom_helper/frontend/package*.json ./
RUN npm ci --legacy-peer-deps

# Copy frontend source and build
COPY chesscom_helper/frontend/ ./
# COPY chesscom_helper/.env .env  # Uncomment if needed for the build

RUN npm run build

# ===== Stage 5: Frontend Production (Nginx) =====
FROM nginx:alpine AS frontend-prod

# Copy the built frontend assets from the builder stage into Nginx’s public directory
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy your custom Nginx configuration (adjust the path as needed)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
# Nginx will automatically start, serving your static frontend

# ===== Stage 6: Production Backend (Django) =====
FROM base AS backend-prod
EXPOSE 8000
# Migrate and run the Django app in production mode
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
