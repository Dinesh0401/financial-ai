FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY finna/backend /app

RUN pip install --no-cache-dir --upgrade pip uv \
    && uv pip install --system ".[dev]"

WORKDIR /workspace/finna/backend
