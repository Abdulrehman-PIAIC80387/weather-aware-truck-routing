import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-secret-key-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "drf_spectacular",
    "drf_spectacular_sidecar",  # serves Swagger/ReDoc assets locally (no CDN)
    "corsheaders",
    # local
    "weather",  # weather forecasts and hazard rules
    "routes",  # routing and the route plan API
]

MIDDLEWARE = [
    "django.middleware.gzip.GZipMiddleware",  # plan responses shrink ~85%
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": ["django.template.context_processors.request"],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# SQLite — path is configurable so Docker can keep it on a volume
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("SQLITE_PATH", BASE_DIR / "db.sqlite3"),
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS — lets the Vite dev server (localhost:5173) call the API directly
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

# Django REST Framework — a public API with no users or sessions
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
}

# Forecasts and plans; a file cache is shared by every gunicorn worker.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": os.environ.get("CACHE_DIR", BASE_DIR / ".cache"),
    }
}
PLAN_CACHE_SECONDS = int(os.environ.get("PLAN_CACHE_SECONDS", "3600"))

# Swagger / OpenAPI (drf-spectacular)
SPECTACULAR_SETTINGS = {
    "TITLE": "Weather-Aware Truck Routing API",
    "DESCRIPTION": "Recommends the safest of three US truck routes from the weather at the "
    "time the truck reaches each checkpoint and its load weight.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_DIST": "SIDECAR",
    "SWAGGER_UI_FAVICON_HREF": "SIDECAR",
    "REDOC_DIST": "SIDECAR",
}

# TomTom truck routing (free key: https://developer.tomtom.com)
ROUTING = {
    "TOMTOM_URL": "https://api.tomtom.com/routing/1/calculateRoute",
    "TOMTOM_API_KEY": os.environ.get("TOMTOM_API_KEY", ""),
    "TIMEOUT_SECONDS": (5, 30),  # (connect, read)
}

# Free weather API (no key): https://open-meteo.com
WEATHER = {
    "OPEN_METEO_URL": os.environ.get("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"),
    "TIMEOUT_SECONDS": (5, 30),
    "CACHE_SECONDS": int(os.environ.get("WEATHER_CACHE_SECONDS", "3600")),
}
