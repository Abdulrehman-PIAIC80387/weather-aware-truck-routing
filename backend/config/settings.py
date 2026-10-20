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
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# Swagger / OpenAPI (drf-spectacular)
SPECTACULAR_SETTINGS = {
    "TITLE": "Weather-Aware Truck Routing API",
    "DESCRIPTION": "Plans a US truck route and flags weather hazards at the time the truck "
    "reaches each part of the road.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_DIST": "SIDECAR",
    "SWAGGER_UI_FAVICON_HREF": "SIDECAR",
    "REDOC_DIST": "SIDECAR",
}

# Free routing API (no key). Point OSRM_URL at a self-hosted OSRM for production use.
ROUTING = {
    "OSRM_URL": os.environ.get("OSRM_URL", "https://router.project-osrm.org"),
    "TIMEOUT_SECONDS": float(os.environ.get("ROUTING_TIMEOUT_SECONDS", "60")),
}

# Free weather API (no key)
WEATHER = {
    "OPEN_METEO_URL": os.environ.get("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"),
    "TIMEOUT_SECONDS": float(os.environ.get("WEATHER_TIMEOUT_SECONDS", "30")),
}

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3020")
