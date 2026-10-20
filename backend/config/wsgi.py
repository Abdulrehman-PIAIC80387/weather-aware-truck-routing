import os

from django.core.wsgi import get_wsgi_application
from django.urls import get_resolver

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()

# Import the URLconf (and so every view) now rather than on the first request. With
# gunicorn --preload this happens once before forking, so no worker starts cold.
get_resolver().url_patterns  # noqa: B018
