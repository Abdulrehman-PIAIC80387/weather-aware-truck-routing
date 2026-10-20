FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5

WORKDIR /app

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt


# Lint + test image: `docker build --target dev -t backend-dev .`
FROM base AS dev

COPY requirements-dev.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements-dev.txt
COPY . .


FROM base AS runtime

COPY . .

# The SQLite database lives here (a volume in docker-compose)
RUN mkdir -p /app/data
ENV SQLITE_PATH=/app/data/db.sqlite3

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
# --preload imports the app once before forking, so no worker serves a cold first request
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60", "--preload"]
