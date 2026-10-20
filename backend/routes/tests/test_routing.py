from datetime import UTC, datetime
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from routes.domain import Route
from routes.routing import NoRouteError, RoutingError, distinct, get_routes, to_route

DEPARTURE = datetime(2030, 1, 1, tzinfo=UTC)


def tomtom_route(longitudes: list[float]) -> dict:
    """Points due east along the equator, with progress anchors at the first and last."""
    last = len(longitudes) - 1
    return {
        "legs": [{"points": [{"latitude": 0.0, "longitude": lon} for lon in longitudes]}],
        "progress": [
            {"pointIndex": 0, "distanceInMeters": 0, "travelTimeInSeconds": 0},
            {"pointIndex": last, "distanceInMeters": 160_934.4, "travelTimeInSeconds": 7200},
        ],
    }


class ToRouteTests(SimpleTestCase):
    def test_points_between_anchors_get_distance_and_time_by_position(self):
        route = to_route(tomtom_route([0.0, 0.25, 1.0]))  # second point is 1/4 of the way
        self.assertAlmostEqual(route.miles[1], 25.0)
        self.assertAlmostEqual(route.seconds[1], 1800.0)
        self.assertAlmostEqual(route.total_miles, 100.0)


class DistinctTests(SimpleTestCase):
    def test_drops_near_duplicates_and_keeps_three(self):
        def route(lats):
            return Route([(lat, 0.0) for lat in lats], [0.0] * len(lats), [0.0] * len(lats))

        main = route([i / 100 for i in range(100)])
        duplicate = route([i / 100 for i in range(99)])
        others = [route([5 + i + j / 100 for j in range(100)]) for i in range(3)]
        self.assertEqual(distinct([main, duplicate, *others]), [main, others[0], others[1]])


@override_settings(ROUTING={"TOMTOM_URL": "x", "TOMTOM_API_KEY": "key", "TIMEOUT_SECONDS": 1})
@patch("routes.routing.requests.get")
class GetRoutesTests(SimpleTestCase):
    def call(self):
        return get_routes((41.0, -87.0), (39.0, -104.0), DEPARTURE, 30_000)

    def test_sends_gross_weight_in_kg(self, get):
        get.return_value = Mock(ok=True, status_code=200, json=Mock(return_value={"routes": []}))
        with self.assertRaises(NoRouteError):
            self.call()
        params = get.call_args.kwargs["params"]
        self.assertEqual(params["vehicleWeight"], round(65_000 * 0.45359237))
        self.assertEqual(params["travelMode"], "truck")

    def test_bad_request_means_no_route(self, get):
        get.return_value = Mock(ok=False, status_code=400)
        with self.assertRaises(NoRouteError):
            self.call()

    def test_server_error(self, get):
        get.return_value = Mock(ok=False, status_code=503)
        with self.assertRaises(RoutingError):
            self.call()

    @override_settings(ROUTING={"TOMTOM_URL": "x", "TOMTOM_API_KEY": "", "TIMEOUT_SECONDS": 1})
    def test_missing_key(self, get):
        with self.assertRaisesMessage(RoutingError, "TOMTOM_API_KEY"):
            self.call()
        get.assert_not_called()
