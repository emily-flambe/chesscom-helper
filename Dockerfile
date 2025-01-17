FROM python:3.12.8-slim-bookworm

ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    && apt-get clean

RUN pip install --upgrade pip && pip install poetry

COPY chesscom_helper/pyproject.toml .
COPY chesscom_helper/poetry.lock .

RUN poetry config virtualenvs.create false \
    && poetry install --no-root

COPY chesscom_helper/ /app/

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]