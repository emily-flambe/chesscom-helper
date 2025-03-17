# Use an official Python image
FROM python:3.12.8-slim-bookworm

# Set environment variables
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    nodejs \
    npm \
    curl \
    && apt-get clean

# Install Poetry for dependency management
RUN pip install --upgrade pip && pip install poetry

# Install Node.js and npm for Vite frontend
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Copy project dependencies
COPY chesscom_helper/pyproject.toml .
COPY chesscom_helper/poetry.lock .

# Install Python dependencies
RUN poetry config virtualenvs.create false && poetry install --no-root

# Copy entire project
COPY chesscom_helper/ /app/

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci

# Expose ports
EXPOSE 8000 5173

# Start both Django and Vite servers
CMD ["sh", "-c", "cd /app && python manage.py runserver 0.0.0.0:8000 & cd /app/frontend && npm run dev"]
