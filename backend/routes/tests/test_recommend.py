from django.test import SimpleTestCase

from routes.recommend import RouteSummary, rank, reason, summarize
from weather.risk import Level

HOUR = 3600


def summary(no_travel=0.0, severe=0.0, high=0.0, average=0.5, hours=5.0) -> RouteSummary:
    return RouteSummary(no_travel, severe, high, 0.0, average, hours * HOUR)


class SummarizeTests(SimpleTestCase):
    def test_miles_per_level_and_distance_weighted_average(self):
        segments = [(30, Level.LOW), (10, Level.SEVERE), (10, Level.HIGH), (20, None)]
        result = summarize(segments, 2 * HOUR)
        self.assertEqual((result.severe_miles, result.high_miles), (10, 10))
        self.assertEqual(result.unknown_miles, 20)
        self.assertEqual(result.average_risk, (3 * 10 + 2 * 10) / 50)  # unknown excluded

    def test_all_unknown_has_no_average(self):
        self.assertIsNone(summarize([(50, None)], HOUR).average_risk)


class RankTests(SimpleTestCase):
    def assert_best(self, routes, expected_index):
        self.assertEqual(rank(routes)[0], expected_index)

    def test_no_travel_miles_decide_first(self):
        self.assert_best([summary(no_travel=5), summary(severe=200)], 1)

    def test_severe_miles_beat_high_miles_and_time(self):
        self.assert_best([summary(severe=10, hours=4), summary(high=300, hours=9)], 1)

    def test_high_miles_beat_average_risk(self):
        self.assert_best([summary(high=20, average=0.1), summary(high=0, average=1.5)], 1)

    def test_lower_average_risk_beats_shorter_time(self):
        self.assert_best([summary(average=1.2, hours=4), summary(average=0.4, hours=6)], 1)

    def test_close_average_risk_lets_travel_time_decide(self):
        self.assert_best([summary(average=0.50, hours=8), summary(average=0.58, hours=5)], 1)

    def test_rounding_noise_is_a_tie(self):
        self.assert_best([summary(severe=10.04, hours=6), summary(severe=10.01, hours=5)], 1)

    def test_unknown_average_ranks_last_on_that_key(self):
        self.assert_best([summary(average=None, hours=1), summary(average=2.0, hours=9)], 1)

    def test_orders_all_routes(self):
        routes = [summary(severe=5), summary(), summary(high=5)]
        self.assertEqual(rank(routes), [1, 2, 0])


class ReasonTests(SimpleTestCase):
    def test_names_the_first_deciding_criterion(self):
        self.assertEqual(
            reason(summary(severe=0), summary(severe=42)), "Fewest Severe miles (0 vs 42)"
        )

    def test_average_risk(self):
        self.assertEqual(
            reason(summary(average=0.4), summary(average=0.9)),
            "Lowest average risk (0.40 vs 0.90)",
        )

    def test_travel_time(self):
        self.assertEqual(
            reason(summary(hours=5), summary(hours=6.5)), "Similar weather risk, 90 min faster"
        )
