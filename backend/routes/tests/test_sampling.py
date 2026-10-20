from datetime import UTC, datetime, timedelta

from django.test import SimpleTestCase

from routes.domain import Route
from routes.sampling import checkpoint_miles, position_at, sample_checkpoints

DEPARTURE = datetime(2026, 10, 21, 8, tzinfo=UTC)
# 120 miles: 60 miles of highway in 1 h, then 60 slow miles in 2 h.
ROUTE = Route(
    points=[(40.0, -100.0), (40.0, -99.0), (40.0, -98.0)],
    miles=[0.0, 60.0, 120.0],
    seconds=[0.0, 3600.0, 3 * 3600.0],
)


class CheckpointMilesTests(SimpleTestCase):
    def test_every_interval_plus_destination(self):
        self.assertEqual(checkpoint_miles(120, 50), [0, 50, 100, 120])

    def test_no_duplicate_when_destination_is_on_an_interval(self):
        self.assertEqual(checkpoint_miles(100, 25), [0, 25, 50, 75, 100])

    def test_trip_shorter_than_interval(self):
        self.assertEqual(checkpoint_miles(7.5, 10), [0, 7.5])


class PositionTests(SimpleTestCase):
    def test_interpolates_position_and_time(self):
        self.assertEqual(position_at(ROUTE, 90), (40.0, -98.5, 2 * 3600.0))

    def test_ends(self):
        self.assertEqual(position_at(ROUTE, 0), (40.0, -100.0, 0.0))
        self.assertEqual(position_at(ROUTE, 120), (40.0, -98.0, 3 * 3600.0))


class SampleCheckpointsTests(SimpleTestCase):
    def test_eta_follows_the_routes_own_driving_time(self):
        checkpoints = sample_checkpoints(ROUTE, 50, DEPARTURE)
        # Mile 100 is 40 miles into the slow stretch: 1 h + 40/60 * 2 h.
        self.assertEqual(checkpoints[2].eta, DEPARTURE + timedelta(hours=1, minutes=80))
        self.assertEqual(checkpoints[-1].eta, DEPARTURE + timedelta(hours=3))

    def test_represented_miles_cover_the_whole_route(self):
        for interval in (10, 25, 50):
            with self.subTest(interval=interval):
                checkpoints = sample_checkpoints(ROUTE, interval, DEPARTURE)
                total = sum(c.represented_miles for c in checkpoints)
                self.assertAlmostEqual(total, ROUTE.total_miles)

    def test_represented_miles_split_halfway(self):
        checkpoints = sample_checkpoints(ROUTE, 50, DEPARTURE)  # miles 0, 50, 100, 120
        self.assertEqual([c.represented_miles for c in checkpoints], [25, 50, 35, 10])
