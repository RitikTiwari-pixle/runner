# ──────────────────────────────────────────────────────────────
# Territory Runner — Backend Dockerfile (Railway-ready)
# ──────────────────────────────────────────────────────────────

FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir --only-binary shapely --prefix=/install -r requirements.txt

# ─── Production image ────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgeos-c1v5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

ENV PORT=8000
EXPOSE $PORT

# FIX 1: Removed --timeout flag (it kills async uvicorn workers incorrectly).
#         Uvicorn manages its own async timeouts — gunicorn timeout doesn't apply.
# FIX 2: Using shell form so $PORT expands correctly at runtime.
CMD gunicorn main:app \
    -k uvicorn.workers.UvicornWorker \
    -b "0.0.0.0:${PORT}" \
    --workers 1 \
    --worker-connections 500 \
    --threads 2 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --max-requests 10000 \
    --max-requests-jitter 1000 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
