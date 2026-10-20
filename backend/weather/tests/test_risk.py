from django.test import SimpleTestCase

from weather.risk import RAIN_IN_HR, SNOW_IN_HR, WIND_MPH, Level, classify, wind_level

L, M, H, S, N = Level


class BandBoundaryTests(SimpleTestCase):
    def assert_levels(self, bands, cases):
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(bands.level(value), expected)

    def test_wind(self):
        self.assert_levels(
            WIND_MPH,
            [(0, L), (24.99, L), (25, M), (34.6, M), (34.99, M), (35, H), (44.5, H),
             (44.99, H), (45, S), (54.99, S), (55, N), (80, N)],
        )  # fmt: skip

    def test_rain(self):
        self.assert_levels(
            RAIN_IN_HR,
            [(0, L), (0.0999, L), (0.10, M), (0.2499, M), (0.25, H), (0.4999, H),
             (0.50, S), (1.00, S), (1.01, N)],
        )  # fmt: skip

    def test_snow(self):
        self.assert_levels(
            SNOW_IN_HR,
            [(0, L), (0.49, L), (0.5, M), (0.99, M), (1.0, H), (1.99, H), (2.0, S),
             (3.0, S), (3.01, N)],
        )  # fmt: skip


class LoadRuleTests(SimpleTestCase):
    def test_load_rules(self):
        cases = [
            (55, 0, N),  # >= 55 mph is No Travel for any load
            (45, 30_000, S),
            (45, 30_001, N),  # 45-54 mph + > 30,000 lb
            (54.99, 30_001, N),
            (35, 40_000, H),
            (35, 40_001, S),  # 35-44 mph + > 40,000 lb
            (44.99, 40_001, S),
            (34.99, 80_000, M),  # below the load rule bands, load does not matter
        ]
        for wind, load, expected in cases:
            with self.subTest(wind=wind, load=load):
                self.assertEqual(wind_level(wind, load), expected)


class ClassifyTests(SimpleTestCase):
    def test_worst_condition_wins(self):
        result = classify(wind_mph=30, rain_in_hr=0.6, snow_in_hr=0, load_lb=10_000)
        self.assertEqual(result.level, S)
        self.assertEqual(result.reasons, ("Rain 0.60 in/hr",))

    def test_reason_names_the_load_rule(self):
        result = classify(wind_mph=47, rain_in_hr=0, snow_in_hr=0, load_lb=36_000)
        self.assertEqual(result.level, N)
        self.assertEqual(result.reasons, ("Wind 47 mph + 36,000 lb load",))

    def test_ties_list_every_condition(self):
        result = classify(wind_mph=36, rain_in_hr=0.3, snow_in_hr=1.5, load_lb=0)
        self.assertEqual(result.level, H)
        self.assertEqual(len(result.reasons), 3)

    def test_calm_weather_is_low_without_reasons(self):
        result = classify(wind_mph=5, rain_in_hr=0, snow_in_hr=0, load_lb=80_000)
        self.assertEqual((result.level, result.reasons), (L, ()))

    def test_missing_data_is_unknown_not_low(self):
        self.assertIsNone(classify(wind_mph=None, rain_in_hr=0, snow_in_hr=0, load_lb=0))
