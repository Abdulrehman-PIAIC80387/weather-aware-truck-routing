"""Plans a weather-aware trip: routes → checkpoints → weather at each ETA → risk → ranking.

The forecasts come from Open-Meteo, fetched here or (to use the visitor's own quota
instead of the server's shared IP) by the browser for the points `weather_points` lists.
"""

import hashlib
import math
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import ValidationError

from weather.client import Forecast, get_forecasts, parse_hourly
from weather.risk import Assessment, classify

from .domain import Checkpoint
from .grid import Grid, corridor_grid
from .recommend import rank, summarize
from .response import PlannedRoute, plan_response
from .routing import get_routes
from .sampling import sample_checkpoints

HEATMAP_HOURS = 48
HOUR = timedelta(hours=1)
OPEN_METEO_HOUR = "%Y-%m-%dT%H:%M"


def prepare(origin, destination, departure: datetime, load_lb: int):
    """Routes (cached, so the two-step browser flow calls TomTom once), weather grid and
    the forecast window: departure → max(departure + 48 h, the slowest arrival)."""
    key = "routes:" + hashlib.sha256(repr((origin, destination, load_lb)).encode()).hexdigest()
    routes = cache.get(key)
    if routes is None:
        routes = get_routes(origin, destination, load_lb)
        cache.set(key, routes, settings.PLAN_CACHE_SECONDS)
    grid = corridor_grid(routes)
    start = departure.replace(minute=0, second=0, microsecond=0)
    longest_hours = math.ceil(max(route.total_seconds for route in routes) / 3600)
    end = start + HOUR * (max(HEATMAP_HOURS, longest_hours) + 1)
    return routes, grid, start, end


def weather_points(origin, destination, departure: datetime, load_lb: int, **_) -> dict:
    """What the browser must fetch from Open-Meteo before calling `plan_trip`."""
    _, grid, start, end = prepare(origin, destination, departure.astimezone(UTC), load_lb)
    return {
        "points": [[round(lat, 4), round(lon, 4)] for lat, lon in map(grid.center, grid.cells)],
        "start_hour": start.strftime(OPEN_METEO_HOUR),
        "end_hour": end.strftime(OPEN_METEO_HOUR),
    }


def plan_trip(
    origin, destination, departure: datetime, load_lb: int, interval: int, hourly=None
) -> dict:
    departure = departure.astimezone(UTC)
    routes, grid, start, end = prepare(origin, destination, departure, load_lb)
    centers = [grid.center(cell) for cell in grid.cells]
    forecasts = dict(zip(grid.cells, _forecasts(grid, centers, start, end, hourly), strict=True))

    def assess(latitude: float, longitude: float, when: datetime):
        conditions = forecasts[grid.cell_of(latitude, longitude)].at(when)
        if conditions is None:
            return None, None
        risk = classify(conditions.wind_mph, conditions.rain_in_hr, conditions.snow_in_hr, load_lb)
        return conditions, risk

    planned = []
    for route in routes:
        checkpoints = sample_checkpoints(route, interval, departure)
        assessed = [(c, *assess(c.latitude, c.longitude, c.eta)) for c in checkpoints]
        planned.append(
            PlannedRoute(route, assessed, summarize(_segments(assessed), route.total_seconds))
        )

    heatmap = [
        "".join(
            _digit(assess(*center, departure + HOUR * hour)[1])
            for hour in range(HEATMAP_HOURS + 1)
        )
        for center in centers
    ]
    order = rank([p.summary for p in planned])
    return plan_response(departure, load_lb, interval, planned, order, grid, heatmap)


def _forecasts(grid: Grid, centers, start, end, hourly) -> list[Forecast]:
    """Forecasts sent by the browser (one per `weather_points` point), else fetched here."""
    if hourly is None:
        return get_forecasts(centers, start, end)
    if len(hourly) != len(grid.cells):
        raise ValidationError({"hourly": f"Expected {len(grid.cells)} forecasts."})
    try:
        return [Forecast(start, parse_hourly(data)) for data in hourly]
    except (TypeError, ValueError) as error:
        raise ValidationError({"hourly": "Forecast values must be numbers."}) from error


def _segments(assessed: list[tuple[Checkpoint, object, Assessment | None]]):
    return [(c.represented_miles, risk.level if risk else None) for c, _, risk in assessed]


def _digit(risk: Assessment | None) -> str:
    return "9" if risk is None else str(int(risk.level))
