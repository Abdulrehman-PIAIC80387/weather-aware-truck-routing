"""The weather grid shared by the checkpoints and the risk heatmap.

Cells are square in degrees. They start at 0.25° (about the forecast model resolution)
and grow until the corridor around all routes fits the weather API budget.
"""

import math
from dataclasses import dataclass

from .domain import Route
from .sampling import position_at

CELL_SIZES = (0.25, 0.5, 0.75, 1.0, 1.5, 2.0)
MILES_PER_DEGREE_LATITUDE = 69.0
Cell = tuple[int, int]  # (row, column)


@dataclass(frozen=True)
class Grid:
    size: float  # degrees
    cells: list[Cell]

    def cell_of(self, latitude: float, longitude: float) -> Cell:
        return math.floor(latitude / self.size), math.floor(longitude / self.size)

    def center(self, cell: Cell) -> tuple[float, float]:
        row, column = cell
        return (row + 0.5) * self.size, (column + 0.5) * self.size


def corridor_grid(routes: list[Route], radius_miles: float = 30, max_cells: int = 250) -> Grid:
    """Cells within about `radius_miles` of any route, at the finest size that fits."""
    for size in CELL_SIZES:
        cells = _corridor(routes, size, radius_miles)
        if len(cells) <= max_cells:
            break
    return Grid(size, sorted(cells))


def _corridor(routes: list[Route], size: float, radius_miles: float) -> set[Cell]:
    grid = Grid(size, [])
    step_miles = size * MILES_PER_DEGREE_LATITUDE / 2  # no cell is skipped between samples
    cells = set()
    for route in routes:
        steps = math.ceil(route.total_miles / step_miles)
        for step in range(steps + 1):
            latitude, longitude, _ = position_at(route, min(step * step_miles, route.total_miles))
            row, column = grid.cell_of(latitude, longitude)
            rows = math.ceil(radius_miles / (size * MILES_PER_DEGREE_LATITUDE))
            columns = math.ceil(rows / math.cos(math.radians(latitude)))
            cells.update(
                (row + dr, column + dc)
                for dr in range(-rows, rows + 1)
                for dc in range(-columns, columns + 1)
            )
    return cells
