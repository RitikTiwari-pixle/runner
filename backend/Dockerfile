# ──────────────────────────────────────────────────────────────
# Territory Runner — Backend Dockerfile
# Multi-stage build: slim Python 3.12 image
# ──────────────────────────────────────────────────────────────

FROM python:3.12-slim AS builder

WORKDIR /app

# Install system deps for PostGIS/Shapely
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─── Production image ────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 libgeos-c1v5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY . .

# Non-root user for security
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Gunicorn with Uvicorn workers for production
CMD ["gunicorn", "main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", \
     "--workers", "2", \
     "--timeout", "120", \
     "--access-logfile", "-"]
