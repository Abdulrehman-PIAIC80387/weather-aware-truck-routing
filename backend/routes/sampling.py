"""Weather checkpoints along a route, with the truck's ETA at each one."""

from bisect import bisect_right
from datetime import datetime, timedelta

from .domain import Checkpoint, Route


def checkpoint_miles(total_miles: float, interval: float) -> list[float]:
    """Mile 0, every `interval` miles, and the destination."""
    count = int(total_miles // interval)
    miles = [step * interval for step in range(count + 1)]
    return miles if miles[-1] == total_miles else [*miles, total_miles]


def position_at(route: Route, mile: float) -> tuple[float, float, float]:
    """(latitude, longitude, seconds) at `mile`, interpolated between route points."""
    index = min(max(bisect_right(route.miles, mile) - 1, 0), len(route.miles) - 2)
    span = route.miles[index + 1] - route.miles[index]
    share = (mile - route.miles[index]) / span if span else 0.0
    (lat_a, lon_a), (lat_b, lon_b) = route.points[index], route.points[index + 1]
    seconds_a, seconds_b = route.seconds[index], route.seconds[index + 1]
    return (
        lat_a + (lat_b - lat_a) * share,
        lon_a + (lon_b - lon_a) * share,
        seconds_a + (seconds_b - seconds_a) * share,
    )


def sample_checkpoints(route: Route, interval: float, departure: datetime) -> list[Checkpoint]:
    miles = checkpoint_miles(route.total_miles, interval)
    checkpoints = []
    for index, mile in enumerate(miles):
        previous = miles[max(index - 1, 0)]
        following = miles[min(index + 1, len(miles) - 1)]
        latitude, longitude, seconds = position_at(route, mile)
        checkpoints.append(
            Checkpoint(
                mile=mile,
                latitude=latitude,
                longitude=longitude,
                eta=departure + timedelta(seconds=seconds),
                represented_miles=(following - previous) / 2,
            )
        )
    return checkpoints
