# ──────────────────────────────────────────────────────────────
# Territory Runner — Backend Dockerfile (Railway-ready)
#
# Deploy to Railway:
#   1. Push this repo / connect Railway to GitHub
#   2. Railway will auto-detect the Dockerfile and build it
#   3. Set your environment variables in Railway's dashboard
#      (DATABASE_URL, JWT_SECRET_KEY, GOOGLE_OAUTH_CLIENT_ID, etc.)
#   4. Railway injects PORT automatically — no need to set it yourself
# ──────────────────────────────────────────────────────────────

FROM python:3.12-slim AS builder

WORKDIR /app

# Install build-time dependencies
# Note: libgeos-dev NOT needed — shapely ships pre-built wheels (manylinux)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
# --only-binary shapely prevents source compilation (avoids libgeos-dev + OOM)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --only-binary shapely --prefix=/install -r requirements.txt

# ─── Production image ────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgeos-c1v5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY backend/ ./

# Non-root user for security
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Railway injects $PORT at runtime (default 8000 for local Docker)
ENV PORT=8000
EXPOSE $PORT

# Use shell form so $PORT is expanded at container start time.
# Workers=2 is safe for Railway's starter plan (512 MB RAM).
CMD gunicorn main:app \
    -k uvicorn.workers.UvicornWorker \
    -b "0.0.0.0:${PORT}" \
    --workers 1 \
    --worker-connections 500 \
    --threads 2 \
    --timeout 120 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --max-requests 10000 \
    --max-requests-jitter 1000 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
