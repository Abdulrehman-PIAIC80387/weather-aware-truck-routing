"""Hourly forecasts from Open-Meteo for many locations, fetched in parallel batches.

Open-Meteo stamps rain, showers, snowfall and gusts with the END of the hour they cover,
so a reading at time t uses the value stamped ceil(t). Only the instantaneous sustained
wind speed is interpolated between hours.
"""

import hashlib
import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta

import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import APIException

VARIABLES = ("wind_speed_10m", "wind_gusts_10m", "rain", "showers", "snowfall")
BATCH_SIZE = 150  # keeps the GET URL well under Open-Meteo's length limit
HOUR = timedelta(hours=1)


class WeatherError(APIException):
    status_code = 502
    default_detail = "The weather service is unavailable. Please try again."


@dataclass(frozen=True)
class Conditions:
    wind_mph: float
    gust_mph: float
    rain_in_hr: float
    snow_in_hr: float


@dataclass(frozen=True)
class Forecast:
    start: datetime  # UTC, on the hour, the time of index 0
    hourly: dict[str, list[float | None]]

    def at(self, when: datetime) -> Conditions | None:
        """Conditions at `when`, or None outside the forecast or when values are missing."""
        offset = (when - self.start) / HOUR
        lower, upper = math.floor(offset), math.ceil(offset)
        if lower < 0 or upper >= len(self.hourly["wind_speed_10m"]):
            return None
        wind = self.hourly["wind_speed_10m"]
        ending = {name: self.hourly[name][upper] for name in VARIABLES[1:]}
        if wind[lower] is None or wind[upper] is None or None in ending.values():
            return None
        return Conditions(
            wind_mph=wind[lower] + (wind[upper] - wind[lower]) * (offset - lower),
            gust_mph=ending["wind_gusts_10m"],
            rain_in_hr=ending["rain"] + ending["showers"],
            snow_in_hr=ending["snowfall"],
        )


def get_forecasts(points: list[tuple[float, float]], start: datetime, end: datetime) -> list:
    """One Forecast per (latitude, longitude) point, hourly from `start` to `end` (UTC)."""
    batches = [points[i : i + BATCH_SIZE] for i in range(0, len(points), BATCH_SIZE)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = pool.map(lambda batch: _cached_batch(batch, start, end), batches)
    return [Forecast(start, hourly) for batch in results for hourly in batch]


def _cached_batch(points: list[tuple[float, float]], start: datetime, end: datetime) -> list:
    key = hashlib.sha256(repr((points, start, end)).encode()).hexdigest()
    hourly = cache.get(key)
    if hourly is None:
        hourly = _fetch_batch(points, start, end)
        cache.set(key, hourly, settings.WEATHER["CACHE_SECONDS"])
    return hourly


def _fetch_batch(points: list[tuple[float, float]], start: datetime, end: datetime) -> list:
    params = {
        "latitude": ",".join(f"{latitude:.3f}" for latitude, _ in points),
        "longitude": ",".join(f"{longitude:.3f}" for _, longitude in points),
        "hourly": ",".join(VARIABLES),
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "start_hour": start.strftime("%Y-%m-%dT%H:%M"),
        "end_hour": end.strftime("%Y-%m-%dT%H:%M"),
    }
    try:
        response = requests.get(
            settings.WEATHER["OPEN_METEO_URL"],
            params=params,
            timeout=settings.WEATHER["TIMEOUT_SECONDS"],
        )
    except requests.RequestException as error:
        raise WeatherError() from error
    if response.status_code == 429:
        raise WeatherError("The weather service is busy. Please retry in a minute.")
    if not response.ok:
        raise WeatherError()
    body = response.json()
    locations = body if isinstance(body, list) else [body]  # one location is not a list
    return [location["hourly"] for location in locations]
