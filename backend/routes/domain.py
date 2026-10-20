"""Plain data passed between the routing, sampling, weather and ranking steps."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Route:
    """A road polyline with the distance and driving time to reach each of its points."""

    points: list[tuple[float, float]]  # (latitude, longitude)
    miles: list[float]  # cumulative, starts at 0
    seconds: list[float]  # cumulative driving time, starts at 0

    @property
    def total_miles(self) -> float:
        return self.miles[-1]

    @property
    def total_seconds(self) -> float:
        return self.seconds[-1]


@dataclass(frozen=True)
class Checkpoint:
    mile: float
    latitude: float
    longitude: float
    eta: datetime
    represented_miles: float  # halfway to the previous checkpoint to halfway to the next
