from datetime import UTC, datetime

from django.test import SimpleTestCase

from routes.domain import Route
from routes.grid import Grid, corridor_grid
from routes.sampling import sample_checkpoints


def straight_route(start: tuple[float, float], end: tuple[float, float], miles: float) -> Route:
    return Route(points=[start, end], miles=[0.0, miles], seconds=[0.0, miles * 60])


SHORT = straight_route((40.0, -100.0), (40.0, -99.0), 53)
CROSS_COUNTRY = straight_route((40.7, -74.0), (34.0, -118.2), 2800)


class GridTests(SimpleTestCase):
    def test_cell_and_center(self):
        grid = Grid(0.25, [])
        self.assertEqual(grid.cell_of(40.1, -99.9), (160, -400))
        self.assertEqual(grid.center((160, -400)), (40.125, -99.875))

    def test_short_trip_uses_the_finest_cells(self):
        grid = corridor_grid([SHORT])
        self.assertEqual(grid.size, 0.25)
        self.assertLessEqual(len(grid.cells), 250)

    def test_long_trip_grows_cells_to_fit_the_budget(self):
        grid = corridor_grid([CROSS_COUNTRY])
        self.assertGreater(grid.size, 0.25)
        self.assertLessEqual(len(grid.cells), 250)

    def test_every_checkpoint_has_a_cell(self):
        departure = datetime(2026, 10, 21, tzinfo=UTC)
        for route in (SHORT, CROSS_COUNTRY):
            grid = corridor_grid([route])
            cells = set(grid.cells)
            for checkpoint in sample_checkpoints(route, 10, departure):
                with self.subTest(route=route.total_miles, mile=checkpoint.mile):
                    cell = grid.cell_of(checkpoint.latitude, checkpoint.longitude)
                    self.assertIn(cell, cells)
