FROM python:3.12.8-slim-bookworm

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    git \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry for dependency management
RUN pip install --upgrade pip && pip install poetry

# Install Node.js and npm for Vite frontend via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

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

EXPOSE 8000 5173

CMD ["sh", "-c", "cd /app && python manage.py runserver 0.0.0.0:8000 & cd /app/frontend && npm run dev"]
