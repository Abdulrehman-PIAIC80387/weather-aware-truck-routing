import { contours } from "d3-contour";
import type { Plan } from "../../types/plan";
import { LEVELS, UNKNOWN_DIGIT } from "../../utils/risk";
import type { LngLat } from "./geojson";

const HOURS = 49;
const UPSAMPLE = 4; // interpolated samples per forecast cell, so curves come out smooth
const PIXELS_PER_SAMPLE = 6;
const OUTSIDE = -1; // no forecast here (outside the corridor, or unknown)
// Band k holds values >= k - 0.5: index 0 is the whole corridor (Low), 1..4 are the risk levels.
const THRESHOLDS = [-0.5, 0.5, 1.5, 2.5, 3.5];

export interface RiskRaster {
  canvas: HTMLCanvasElement;
  coordinates: [LngLat, LngLat, LngLat, LngLat]; // NW, NE, SE, SW corners, as MapLibre wants
  draw: (hour: number, focus: number | null) => void;
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * Smooth risk areas: contour curves traced through the forecast grid and painted opaque,
 * highest level last, onto a canvas the map shows at one opacity — so bands never blend.
 */
export function riskRaster(plan: Plan): RiskRaster {
  const { size, cells, risk } = plan.grid;
  const index = cells.map(([lat, lon]) => [Math.round(lat / size - 0.5), Math.round(lon / size - 0.5)]);
  const rowMin = Math.min(...index.map(([row]) => row)) - 1; // one empty cell of padding
  const colMin = Math.min(...index.map(([, col]) => col)) - 1;
  const rows = Math.max(...index.map(([row]) => row)) - rowMin + 2;
  const cols = Math.max(...index.map(([, col]) => col)) - colMin + 2;

  const lonOf = (col: number) => (colMin + col + 0.5) * size; // col in cell units, may be fractional
  const latOf = (row: number) => (rowMin + row + 0.5) * size;
  const [west, east, south, north] = [lonOf(0), lonOf(cols - 1), latOf(0), latOf(rows - 1)];

  const width = (cols - 1) * UPSAMPLE + 1;
  const height = (rows - 1) * UPSAMPLE + 1;
  const canvas = document.createElement("canvas");
  canvas.width = width * PIXELS_PER_SAMPLE;
  canvas.height = height * PIXELS_PER_SAMPLE;
  const context = canvas.getContext("2d")!;
  const generator = contours().size([width, height]).thresholds(THRESHOLDS);
  const top = mercatorY(north);
  const span = top - mercatorY(south);

  function samples(hour: number): number[] {
    const coarse = new Float64Array(rows * cols).fill(OUTSIDE);
    risk.forEach((hours, i) => {
      const level = Number(hours[hour]);
      coarse[(index[i][0] - rowMin) * cols + (index[i][1] - colMin)] =
        level === UNKNOWN_DIGIT ? OUTSIDE : level;
    });
    // Bilinear interpolation between cell centres.
    const fine: number[] = new Array(width * height);
    for (let y = 0; y < height; y++) {
      const row = Math.min(Math.floor(y / UPSAMPLE), rows - 2);
      const dy = y / UPSAMPLE - row;
      for (let x = 0; x < width; x++) {
        const col = Math.min(Math.floor(x / UPSAMPLE), cols - 2);
        const dx = x / UPSAMPLE - col;
        const at = (r: number, c: number) => coarse[r * cols + c];
        fine[y * width + x] =
          at(row, col) * (1 - dx) * (1 - dy) +
          at(row, col + 1) * dx * (1 - dy) +
          at(row + 1, col) * (1 - dx) * dy +
          at(row + 1, col + 1) * dx * dy;
      }
    }
    return fine;
  }

  // d3 places sample i at x = i + 0.5; convert to canvas pixels (Mercator, like the map).
  const toPixel = ([x, y]: number[]): [number, number] => {
    const lon = lonOf((x - 0.5) / UPSAMPLE);
    const lat = latOf((y - 0.5) / UPSAMPLE);
    return [
      ((lon - west) / (east - west)) * canvas.width,
      ((top - mercatorY(lat)) / span) * canvas.height,
    ];
  };

  function paint(band: ReturnType<typeof generator>[number], color: string) {
    context.beginPath();
    for (const polygon of band.coordinates) {
      for (const ring of polygon) {
        ring.forEach((point, i) => {
          const [px, py] = toPixel(point);
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.closePath();
      }
    }
    context.fillStyle = color;
    context.fill("evenodd");
  }

  const cache = new Map<number, ReturnType<typeof generator>>();

  function draw(hour: number, focus: number | null) {
    const clamped = Math.max(0, Math.min(HOURS - 1, hour));
    if (!cache.has(clamped)) cache.set(clamped, generator(samples(clamped)));
    const bands = cache.get(clamped)!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (focus === null) {
      for (let level = 1; level < bands.length; level++) paint(bands[level], LEVELS[level].color);
    } else if (focus < bands.length) {
      paint(bands[focus], LEVELS[focus].color); // only this level: its band minus the next one
      if (focus + 1 < bands.length) {
        context.globalCompositeOperation = "destination-out";
        paint(bands[focus + 1], "#000");
        context.globalCompositeOperation = "source-over";
      }
    }
  }

  return {
    canvas,
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
    draw,
  };
}
