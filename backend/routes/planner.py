"""Plans a weather-aware trip: routes → checkpoints → weather at each ETA → risk → ranking."""

import math
from datetime import UTC, datetime, timedelta

from weather.client import get_forecasts
from weather.risk import Assessment, classify

from .domain import Checkpoint
from .grid import corridor_grid
from .recommend import rank, summarize
from .response import PlannedRoute, plan_response
from .routing import get_routes
from .sampling import sample_checkpoints

HEATMAP_HOURS = 48
HOUR = timedelta(hours=1)


def plan_trip(origin, destination, departure: datetime, load_lb: int, interval: int) -> dict:
    departure = departure.astimezone(UTC)
    routes = get_routes(origin, destination, load_lb)
    grid = corridor_grid(routes)

    start = departure.replace(minute=0, second=0, microsecond=0)
    longest_hours = math.ceil(max(route.total_seconds for route in routes) / 3600)
    end = start + HOUR * (max(HEATMAP_HOURS, longest_hours) + 1)
    centers = [grid.center(cell) for cell in grid.cells]
    forecasts = dict(zip(grid.cells, get_forecasts(centers, start, end), strict=True))

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


def _segments(assessed: list[tuple[Checkpoint, object, Assessment | None]]):
    return [(c.represented_miles, risk.level if risk else None) for c, _, risk in assessed]


def _digit(risk: Assessment | None) -> str:
    return "9" if risk is None else str(int(risk.level))
