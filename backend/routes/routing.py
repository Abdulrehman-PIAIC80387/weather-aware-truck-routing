"""Truck routes from the TomTom Routing API.

TomTom's `progress` table gives distance and driving time at some route points; the
points between them are filled in by their straight-line distance along the road.

No `departAt` is sent: with a future departure TomTom returns a single route on long
trips, so routes use current conditions and the departure only shifts the ETAs.
"""

import math

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

from .domain import Route

KG_PER_LB = 0.45359237
EMPTY_TRUCK_LB = 35_000  # typical tractor + trailer; TomTom wants gross weight
METERS_PER_MILE = 1609.344
ROUTE_COUNT = 3
MAX_OVERLAP = 0.9  # an alternative sharing more of its road than this is a duplicate


class RoutingError(APIException):
    status_code = 502
    default_detail = "The routing service is unavailable. Please try again."


class NoRouteError(APIException):
    status_code = 422
    default_detail = "No truck route was found between these places."


def get_routes(origin, destination, load_lb: int) -> list[Route]:
    """Up to 3 distinct truck routes, fastest first. Points are (latitude, longitude)."""
    key = settings.ROUTING["TOMTOM_API_KEY"]
    if not key:
        raise RoutingError("TOMTOM_API_KEY is not set.")
    locations = f"{origin[0]},{origin[1]}:{destination[0]},{destination[1]}"
    params = {
        "key": key,
        "travelMode": "truck",
        "vehicleCommercial": "true",
        "vehicleWeight": round((EMPTY_TRUCK_LB + load_lb) * KG_PER_LB),
        "maxAlternatives": ROUTE_COUNT - 1,  # more alternatives makes TomTom 3x slower
        "extendedRouteRepresentation": ["distance", "travelTime"],
    }
    try:
        response = requests.get(
            f"{settings.ROUTING['TOMTOM_URL']}/{locations}/json",
            params=params,
            timeout=settings.ROUTING["TIMEOUT_SECONDS"],
        )
    except requests.RequestException as error:
        raise RoutingError() from error
    if response.status_code == 400:
        raise NoRouteError()
    if not response.ok:
        raise RoutingError()
    routes = [to_route(data) for data in response.json().get("routes", [])]
    if not routes:
        raise NoRouteError()
    return distinct(routes)


def to_route(data: dict) -> Route:
    points = [(p["latitude"], p["longitude"]) for leg in data["legs"] for p in leg["points"]]
    along = [0.0]
    for a, b in zip(points, points[1:], strict=False):
        along.append(along[-1] + haversine_miles(a, b))
    miles, seconds = [0.0] * len(points), [0.0] * len(points)
    anchors = data["progress"]
    for start, end in zip(anchors, anchors[1:], strict=False):
        first, last = start["pointIndex"], end["pointIndex"]
        span = along[last] - along[first]
        for index in range(first, last + 1):
            share = (along[index] - along[first]) / span if span else 1.0
            miles[index] = _between(start, end, "distanceInMeters", share) / METERS_PER_MILE
            seconds[index] = _between(start, end, "travelTimeInSeconds", share)
    return Route(points, miles, seconds)


def _between(start: dict, end: dict, field: str, share: float) -> float:
    return start[field] + (end[field] - start[field]) * share


def haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat_a, lon_a, lat_b, lon_b = map(math.radians, (*a, *b))
    h = (
        math.sin((lat_b - lat_a) / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin((lon_b - lon_a) / 2) ** 2
    )
    return 2 * 3958.8 * math.asin(math.sqrt(h))


def distinct(routes: list[Route]) -> list[Route]:
    """The first ROUTE_COUNT routes, in TomTom's order, that are not near-duplicates."""
    chosen, roads = [], []
    for route in routes:
        road = {(round(lat, 2), round(lon, 2)) for lat, lon in route.points}  # ~1 km cells
        if all(len(road & other) / len(road) <= MAX_OVERLAP for other in roads):
            chosen.append(route)
            roads.append(road)
        if len(chosen) == ROUTE_COUNT:
            break
    return chosen
