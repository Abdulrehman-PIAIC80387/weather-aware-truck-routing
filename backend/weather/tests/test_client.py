from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from weather.client import Forecast, WeatherError, get_forecasts

START = datetime(2026, 10, 21, 8, tzinfo=UTC)

MEMORY_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


def hourly(**overrides) -> dict:
    values = {
        "wind_speed_10m": [10.0, 20.0, 30.0],
        "wind_gusts_10m": [15.0, 25.0, 35.0],
        "rain": [0.0, 0.1, 0.4],
        "showers": [0.0, 0.05, 0.0],
        "snowfall": [0.0, 0.0, 1.2],
    }
    return values | overrides


class ForecastAtTests(SimpleTestCase):
    def test_wind_is_interpolated_and_hourly_totals_use_the_hour_ending_after(self):
        conditions = Forecast(START, hourly()).at(START + timedelta(minutes=30))
        self.assertEqual(conditions.wind_mph, 15.0)  # halfway between 10 and 20
        self.assertEqual(conditions.gust_mph, 25.0)  # stamped 09:00 covers 08:00-09:00
        self.assertAlmostEqual(conditions.rain_in_hr, 0.15)  # rain + showers
        self.assertEqual(conditions.snow_in_hr, 0.0)

    def test_on_the_hour_uses_that_hour(self):
        conditions = Forecast(START, hourly()).at(START + timedelta(hours=2))
        self.assertEqual((conditions.wind_mph, conditions.snow_in_hr), (30.0, 1.2))

    def test_outside_the_forecast_is_unknown(self):
        forecast = Forecast(START, hourly())
        self.assertIsNone(forecast.at(START - timedelta(minutes=1)))
        self.assertIsNone(forecast.at(START + timedelta(hours=2, minutes=1)))

    def test_missing_values_are_unknown(self):
        forecast = Forecast(START, hourly(rain=[0.0, None, 0.0]))
        self.assertIsNone(forecast.at(START + timedelta(minutes=30)))


@override_settings(CACHES=MEMORY_CACHE)
@patch("weather.client.requests.get")
class GetForecastsTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_one_location_response_is_not_a_list(self, get):
        get.return_value = Mock(
            status_code=200, ok=True, json=Mock(return_value={"hourly": hourly()})
        )
        forecasts = get_forecasts([(40.0, -100.0)], START, START + timedelta(hours=2))
        self.assertEqual(forecasts[0].hourly["snowfall"], [0.0, 0.0, 1.2])

    def test_batches_and_caches(self, get):
        get.side_effect = lambda url, params, timeout: Mock(
            status_code=200,
            ok=True,
            json=Mock(return_value=[{"hourly": hourly()}] * len(params["latitude"].split(","))),
        )
        points = [(40.0, -100.0 + i * 0.25) for i in range(200)]
        self.assertEqual(len(get_forecasts(points, START, START)), 200)
        self.assertEqual(get.call_count, 2)  # 150 + 50
        get_forecasts(points, START, START)
        self.assertEqual(get.call_count, 2)

    def test_rate_limit_has_a_clear_message(self, get):
        get.return_value = Mock(status_code=429, ok=False)
        with self.assertRaisesMessage(WeatherError, "retry in a minute"):
            get_forecasts([(40.0, -100.0)], START, START)
