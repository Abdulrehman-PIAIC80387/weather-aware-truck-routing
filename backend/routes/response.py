"""Shapes a planned trip into the compact JSON the map UI draws."""

from bisect import bisect_right
from dataclasses import dataclass
from datetime import datetime, timedelta

from weather.client import Conditions
from weather.risk import Assessment

from .domain import Checkpoint, Route
from .grid import Grid
from .recommend import RouteSummary, reason
from .sampling import position_at

SIMPLIFY_DEGREES = 0.0005  # about 50 m: invisible on the map, a fraction of the points


@dataclass(frozen=True)
class PlannedRoute:
    route: Route
    assessed: list[tuple[Checkpoint, Conditions | None, Assessment | None]]
    summary: RouteSummary


def plan_response(departure, load_lb, interval, planned, order, grid: Grid, heatmap) -> dict:
    best = planned[order[0]].summary
    why = reason(best, planned[order[1]].summary) if len(order) > 1 else "Only route found"
    return {
        "departure": departure.isoformat(timespec="seconds"),
        "load_lb": load_lb,
        "interval_miles": interval,
        "recommended": order[0],
        "reason": why,
        "unsafe": best.no_travel_miles + best.severe_miles > 0,
        "routes": [_route(index, item, departure) for index, item in enumerate(planned)],
        "grid": {
            "size": grid.size,
            "cells": [[round(lat, 4), round(lon, 4)] for lat, lon in map(grid.center, grid.cells)],
            "risk": heatmap,  # one digit per hour 0..48: level 0-4, 9 = unknown
        },
    }


def _route(index: int, item: PlannedRoute, departure: datetime) -> dict:
    route, summary = item.route, item.summary
    miles = [checkpoint.mile for checkpoint, _, _ in item.assessed]
    return {
        "id": "ABC"[index],
        "distance_miles": round(route.total_miles, 1),
        "duration_seconds": round(route.total_seconds),
        "arrival": (departure + timedelta(seconds=route.total_seconds)).isoformat(
            timespec="seconds"
        ),
        "summary": {
            "no_travel_miles": round(summary.no_travel_miles, 1),
            "severe_miles": round(summary.severe_miles, 1),
            "high_miles": round(summary.high_miles, 1),
            "unknown_miles": round(summary.unknown_miles, 1),
            "average_risk": None
            if summary.average_risk is None
            else round(summary.average_risk, 2),
        },
        "checkpoints": [_checkpoint(*assessed) for assessed in item.assessed],
        "segments": [
            {"level": _level(risk), "path": _stretch(route, miles, i)}
            for i, (_, _, risk) in enumerate(item.assessed)
        ],
    }


def _checkpoint(checkpoint: Checkpoint, conditions: Conditions | None, risk: Assessment | None):
    return {
        "mile": round(checkpoint.mile, 1),
        "latitude": round(checkpoint.latitude, 5),
        "longitude": round(checkpoint.longitude, 5),
        "eta": checkpoint.eta.isoformat(timespec="seconds"),
        "level": _level(risk),
        "reasons": list(risk.reasons) if risk else [],
        "conditions": conditions
        and {
            "wind_mph": round(conditions.wind_mph, 1),
            "gust_mph": round(conditions.gust_mph, 1),
            "rain_in_hr": round(conditions.rain_in_hr, 2),
            "snow_in_hr": round(conditions.snow_in_hr, 2),
        },
    }


def _level(risk: Assessment | None) -> int | None:
    return None if risk is None else int(risk.level)


def _stretch(route: Route, miles: list[float], index: int) -> list[list[float]]:
    """The road a checkpoint represents, as simplified [longitude, latitude] pairs."""
    low = (miles[index - 1] + miles[index]) / 2 if index else 0.0
    high = (miles[index] + miles[index + 1]) / 2 if index < len(miles) - 1 else miles[-1]
    first, last = bisect_right(route.miles, low), bisect_right(route.miles, high)
    points = [position_at(route, low)[:2], *route.points[first:last], position_at(route, high)[:2]]
    return [[round(lon, 5), round(lat, 5)] for lat, lon in simplify(points, SIMPLIFY_DEGREES)]


def simplify(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Douglas-Peucker line simplification (iterative, so long routes cannot overflow)."""
    if len(points) < 3:
        return points
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        distance, farthest = max(
            ((_offset(points[i], points[first], points[last]), i) for i in range(first + 1, last)),
            default=(0.0, None),
        )
        if farthest is not None and distance > tolerance:
            keep.add(farthest)
            stack += [(first, farthest), (farthest, last)]
    return [points[i] for i in sorted(keep)]


def _offset(point, start, end) -> float:
    """Distance in degrees from `point` to the line through `start` and `end`."""
    (y, x), (y1, x1), (y2, x2) = point, start, end
    length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    if not length:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    return abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / length
