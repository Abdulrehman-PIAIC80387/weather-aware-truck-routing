"""Weather risk levels from the assessment's threshold table and load rules.

Each band includes its lower bound and excludes its upper bound, so decimal readings
have one level (34.6 mph is Moderate). No Travel starts at >= 55 mph wind, but only
above 1.00 in/hr rain and above 3.0 in/hr snow, exactly as the table is written.
"""

from dataclasses import dataclass
from enum import IntEnum


class Level(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4


@dataclass(frozen=True)
class Bands:
    moderate: float
    high: float
    severe: float
    no_travel: float
    no_travel_inclusive: bool

    def level(self, value: float) -> Level:
        if value > self.no_travel or (self.no_travel_inclusive and value == self.no_travel):
            return Level.NO_TRAVEL
        return Level(sum(value >= bound for bound in (self.moderate, self.high, self.severe)))


WIND_MPH = Bands(25, 35, 45, 55, no_travel_inclusive=True)
RAIN_IN_HR = Bands(0.10, 0.25, 0.50, 1.00, no_travel_inclusive=False)
SNOW_IN_HR = Bands(0.5, 1.0, 2.0, 3.0, no_travel_inclusive=False)

# Load rules: wind band -> (load above which the level is raised, raised level)
LOAD_RULES = {
    Level.SEVERE: (30_000, Level.NO_TRAVEL),  # 45-54 mph and > 30,000 lb
    Level.HIGH: (40_000, Level.SEVERE),  # 35-44 mph and > 40,000 lb
}


@dataclass(frozen=True)
class Assessment:
    level: Level
    reasons: tuple[str, ...]  # the condition(s) that set the level, empty when Low


def wind_level(wind_mph: float, load_lb: int) -> Level:
    level = WIND_MPH.level(wind_mph)
    max_load, raised = LOAD_RULES.get(level, (None, level))
    return raised if max_load is not None and load_lb > max_load else level


def classify(
    wind_mph: float | None, rain_in_hr: float | None, snow_in_hr: float | None, load_lb: int
) -> Assessment | None:
    """The worst level across wind (after load rules), rain and snow; None if data is missing."""
    if wind_mph is None or rain_in_hr is None or snow_in_hr is None:
        return None
    wind = wind_level(wind_mph, load_lb)
    wind_reason = f"Wind {wind_mph:.0f} mph"
    if wind != WIND_MPH.level(wind_mph):
        wind_reason += f" + {load_lb:,} lb load"
    levels = [
        (wind, wind_reason),
        (RAIN_IN_HR.level(rain_in_hr), f"Rain {rain_in_hr:.2f} in/hr"),
        (SNOW_IN_HR.level(snow_in_hr), f"Snow {snow_in_hr:.1f} in/hr"),
    ]
    worst = max(level for level, _ in levels)
    reasons = tuple(reason for level, reason in levels if level == worst > Level.LOW)
    return Assessment(worst, reasons)
