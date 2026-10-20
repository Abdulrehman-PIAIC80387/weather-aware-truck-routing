import hashlib

from django.conf import settings
from django.core.cache import cache
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .planner import plan_trip
from .serializers import PlanRequestSerializer


@extend_schema(
    summary="Three truck routes with weather risk at each checkpoint ETA and a 0-48 h risk grid",
    request=PlanRequestSerializer,
    responses=OpenApiTypes.OBJECT,
)
@api_view(["POST"])
def plan(request):
    serializer = PlanRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    key = "plan:" + hashlib.sha256(repr(sorted(data.items())).encode()).hexdigest()
    result = cache.get(key)
    if result is None:
        result = plan_trip(**data)
        cache.set(key, result, settings.PLAN_CACHE_SECONDS)
    return Response(result)
