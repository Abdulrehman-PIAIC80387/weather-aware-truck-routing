"""Route summaries and the recommendation order.

Fewest No Travel miles, then fewest Severe miles, fewest High miles, lowest average risk,
shortest travel time. Average risks within AVERAGE_RISK_TOLERANCE count as equal, so a
much longer route cannot win on a meaningless difference.
"""

from dataclasses import dataclass
from functools import cmp_to_key

from weather.risk import Level

AVERAGE_RISK_TOLERANCE = 0.10
MILE_KEYS = (
    ("no_travel_miles", "No Travel"),
    ("severe_miles", "Severe"),
    ("high_miles", "High"),
)


@dataclass(frozen=True)
class RouteSummary:
    no_travel_miles: float
    severe_miles: float
    high_miles: float
    unknown_miles: float
    average_risk: float | None  # distance-weighted mean level, None when all unknown
    duration_seconds: float


def summarize(segments: list[tuple[float, Level | None]], duration_seconds: float) -> RouteSummary:
    """segments: (represented miles, level or None when the weather is unknown)."""

    def miles_at(level: Level | None) -> float:
        return sum(miles for miles, at in segments if at is level)

    known = [(miles, level) for miles, level in segments if level is not None]
    known_miles = sum(miles for miles, _ in known)
    average = sum(miles * level for miles, level in known) / known_miles if known_miles else None
    return RouteSummary(
        no_travel_miles=miles_at(Level.NO_TRAVEL),
        severe_miles=miles_at(Level.SEVERE),
        high_miles=miles_at(Level.HIGH),
        unknown_miles=miles_at(None),
        average_risk=average,
        duration_seconds=duration_seconds,
    )


def _sign(value: float) -> int:
    return (value > 0) - (value < 0)


def _average(summary: RouteSummary) -> float:
    return float("inf") if summary.average_risk is None else summary.average_risk


def compare(a: RouteSummary, b: RouteSummary) -> int:
    """Negative when `a` is the better route."""
    for key, _ in MILE_KEYS:
        difference = round(getattr(a, key), 1) - round(getattr(b, key), 1)
        if difference:
            return _sign(difference)
    if abs(_average(a) - _average(b)) > AVERAGE_RISK_TOLERANCE:
        return _sign(_average(a) - _average(b))
    return _sign(a.duration_seconds - b.duration_seconds)


def rank(summaries: list[RouteSummary]) -> list[int]:
    """Indexes of `summaries`, best route first."""
    return sorted(
        range(len(summaries)), key=cmp_to_key(lambda i, j: compare(summaries[i], summaries[j]))
    )


def reason(best: RouteSummary, runner_up: RouteSummary) -> str:
    """Why `best` beats `runner_up`, naming the first deciding criterion."""
    for key, label in MILE_KEYS:
        ours, theirs = round(getattr(best, key), 1), round(getattr(runner_up, key), 1)
        if ours != theirs:
            return f"Fewest {label} miles ({ours:g} vs {theirs:g})"
    if abs(_average(best) - _average(runner_up)) > AVERAGE_RISK_TOLERANCE:
        return f"Lowest average risk ({best.average_risk:.2f} vs {runner_up.average_risk:.2f})"
    minutes = round((runner_up.duration_seconds - best.duration_seconds) / 60)
    if minutes:
        return f"Similar weather risk, {minutes} min faster"
    return "Same weather risk and travel time"
