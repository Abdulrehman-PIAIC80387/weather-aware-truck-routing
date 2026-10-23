import hashlib

from django.conf import settings
from django.core.cache import cache
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .planner import plan_trip, weather_points
from .serializers import PlanRequestSerializer


def _validated(request) -> dict:
    serializer = PlanRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


@extend_schema(
    summary="Forecast points and time window for a trip, for the browser to fetch",
    request=PlanRequestSerializer,
    responses=OpenApiTypes.OBJECT,
)
@api_view(["POST"])
def points(request):
    return Response(weather_points(**_validated(request)))


@extend_schema(
    summary="Three truck routes with weather risk at each checkpoint ETA and a 0-48 h risk grid",
    request=PlanRequestSerializer,
    responses=OpenApiTypes.OBJECT,
)
@api_view(["POST"])
def plan(request):
    data = _validated(request)
    trip = {name: value for name, value in data.items() if name != "hourly"}
    key = "plan:" + hashlib.sha256(repr(sorted(trip.items())).encode()).hexdigest()
    result = cache.get(key)
    if result is None:
        result = plan_trip(**data)
        cache.set(key, result, settings.PLAN_CACHE_SECONDS)
    return Response(result)
