from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from routes.domain import Route
from routes.response import simplify
from weather.client import Forecast, WeatherError

CHICAGO, DENVER = [41.8781, -87.6298], [39.7392, -104.9903]

MEMORY_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


def straight(miles: float, hours: float, latitude: float) -> Route:
    points = [(latitude, -100.0 + i * 0.1) for i in range(31)]
    return Route(
        points, [miles * i / 30 for i in range(31)], [hours * 3600 * i / 30 for i in range(31)]
    )


def calm_forecasts(points, start, end):
    hours = int((end - start) / timedelta(hours=1)) + 1
    values = {"wind_speed_10m": [5.0] * hours, "wind_gusts_10m": [8.0] * hours}
    values |= {name: [0.0] * hours for name in ("rain", "showers", "snowfall")}
    return [Forecast(start, values) for _ in points]


@override_settings(CACHES=MEMORY_CACHE)
@patch("routes.planner.get_forecasts", side_effect=calm_forecasts)
@patch("routes.planner.get_routes")
class PlanViewTests(TestCase):
    url = reverse("plan")

    def setUp(self):
        cache.clear()

    def body(self, **overrides):
        departure = (timezone.now() + timedelta(hours=2)).isoformat()
        data = {"origin": CHICAGO, "destination": DENVER, "departure": departure}
        return data | {"load_lb": 42_000, "interval": 25} | overrides

    def test_recommends_the_faster_route_when_weather_is_equal(self, get_routes, _):
        get_routes.return_value = [straight(200, 6, 40.0), straight(180, 4, 41.0)]
        response = self.client.post(self.url, self.body(), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        plan = response.json()
        self.assertEqual(plan["recommended"], 1)
        self.assertEqual(plan["reason"], "Similar weather risk, 120 min faster")
        self.assertFalse(plan["unsafe"])
        route = plan["routes"][1]
        self.assertEqual(
            [c["mile"] for c in route["checkpoints"]], [0, 25, 50, 75, 100, 125, 150, 175, 180]
        )
        self.assertEqual(len(route["segments"]), 9)
        self.assertTrue(
            all(len(risk) == 49 and set(risk) == {"0"} for risk in plan["grid"]["risk"])
        )

    def test_repeated_request_is_cached(self, get_routes, _):
        get_routes.return_value = [straight(100, 2, 40.0)]
        body = self.body()
        for _ in range(2):
            self.client.post(self.url, body, content_type="application/json")
        self.assertEqual(get_routes.call_count, 1)

    def test_invalid_input(self, get_routes, _):
        cases = {
            "origin": self.body(origin=[51.5, -0.12]),  # London
            "destination": self.body(destination=CHICAGO),
            "departure": self.body(departure=(timezone.now() - timedelta(hours=3)).isoformat()),
            "load_lb": self.body(load_lb=90_000),
            "interval": self.body(interval=30),
        }
        for field, body in cases.items():
            with self.subTest(field=field):
                response = self.client.post(self.url, body, content_type="application/json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())
        get_routes.assert_not_called()

    def test_provider_failure_is_502(self, get_routes, get_forecasts):
        get_routes.return_value = [straight(100, 2, 40.0)]
        get_forecasts.side_effect = WeatherError()
        response = self.client.post(self.url, self.body(), content_type="application/json")
        self.assertEqual(response.status_code, 502)
        self.assertIn("detail", response.json())


@override_settings(CACHES=MEMORY_CACHE)
@patch("routes.planner.get_forecasts")
@patch("routes.planner.get_routes")
class BrowserWeatherTests(TestCase):
    """The two-step flow where the browser fetches Open-Meteo with its own quota."""

    def setUp(self):
        cache.clear()

    def post(self, name, **extra):
        departure = (timezone.now() + timedelta(hours=2)).isoformat()
        body = {"origin": CHICAGO, "destination": DENVER, "departure": departure}
        body |= {"load_lb": 42_000, "interval": 25} | extra
        return self.client.post(reverse(name), body, content_type="application/json")

    def test_points_then_plan_with_browser_forecasts(self, get_routes, get_forecasts):
        get_routes.return_value = [straight(100, 2, 40.0)]
        window = self.post("weather-points").json()
        self.assertEqual(len(window["start_hour"]), 16)  # Open-Meteo's yyyy-mm-ddThh:mm
        hours = 60
        stormy = {"wind_speed_10m": [50.0] * hours, "wind_gusts_10m": [60.0] * hours}
        stormy |= {name: [0.0] * hours for name in ("rain", "showers", "snowfall")}

        response = self.post("plan", hourly=[stormy] * len(window["points"]))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["unsafe"])  # 50 mph + 42,000 lb is No Travel
        get_forecasts.assert_not_called()  # the server never called Open-Meteo
        self.assertEqual(get_routes.call_count, 1)  # routes were cached between the steps

    def test_wrong_number_of_forecasts_is_rejected(self, get_routes, _):
        get_routes.return_value = [straight(100, 2, 40.0)]
        response = self.post("plan", hourly=[{}])
        self.assertEqual(response.status_code, 400)
        self.assertIn("hourly", response.json())


class SimplifyTests(TestCase):
    def test_drops_points_on_a_straight_line_and_keeps_corners(self):
        line = [(0.0, i / 10) for i in range(11)] + [(1.0, 1.0)]
        self.assertEqual(simplify(line, 0.0005), [(0.0, 0.0), (0.0, 1.0), (1.0, 1.0)])
