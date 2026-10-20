import type { FeatureCollection, LineString, Point, Polygon } from "geojson";
import type { Plan, PlannedRoute } from "../../types/plan";
import { UNKNOWN_DIGIT } from "../../utils/risk";

export type LngLat = [number, number];

/** Every checkpoint stretch of every route, tagged with its route index and risk level. */
export function routeSegments(plan: Plan): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: plan.routes.flatMap((route, index) =>
      route.segments.map((segment) => ({
        type: "Feature",
        properties: { route: index, level: segment.level ?? UNKNOWN_DIGIT },
        geometry: { type: "LineString", coordinates: segment.path },
      })),
    ),
  };
}

export function checkpointPoints(plan: Plan): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: plan.routes.flatMap((route, index) =>
      route.checkpoints.map((checkpoint, position) => ({
        type: "Feature",
        properties: { route: index, position, level: checkpoint.level ?? UNKNOWN_DIGIT },
        geometry: { type: "Point", coordinates: [checkpoint.longitude, checkpoint.latitude] },
      })),
    ),
  };
}

/** The road position halfway along a route, for its on-map label. */
export function midpoint(route: PlannedRoute): LngLat {
  const segment = route.segments[Math.floor(route.segments.length / 2)];
  return segment.path[Math.floor(segment.path.length / 2)];
}

export function bounds(plan: Plan): [LngLat, LngLat] {
  const points = plan.routes.flatMap((route) => route.segments.flatMap((s) => s.path));
  const longitudes = points.map(([lon]) => lon);
  const latitudes = points.map(([, lat]) => lat);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

/** Grid cells as squares with numeric ids; their risk colour is set per hour as feature state. */
export function gridCells(plan: Plan): FeatureCollection<Polygon> {
  const half = plan.grid.size / 2;
  return {
    type: "FeatureCollection",
    features: plan.grid.cells.map(([lat, lon], id) => ({
      type: "Feature",
      id,
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [lon - half, lat - half],
            [lon + half, lat - half],
            [lon + half, lat + half],
            [lon - half, lat + half],
            [lon - half, lat - half],
          ],
        ],
      },
    })),
  };
}

const HOUR_MS = 3_600_000;

/** Where each truck is `hour` hours after departure, interpolated between checkpoint ETAs. */
export function truckPositions(plan: Plan, hour: number): FeatureCollection<Point> {
  const time = Date.parse(plan.departure) + hour * HOUR_MS;
  return {
    type: "FeatureCollection",
    features: plan.routes.map((route, index) => ({
      type: "Feature",
      properties: { route: index },
      geometry: { type: "Point", coordinates: positionAt(route, time) },
    })),
  };
}

function positionAt(route: PlannedRoute, time: number): LngLat {
  const stops = route.checkpoints;
  const next = stops.findIndex((stop) => Date.parse(stop.eta) > time);
  if (next === -1) return [stops.at(-1)!.longitude, stops.at(-1)!.latitude];
  if (next === 0) return [stops[0].longitude, stops[0].latitude];
  const a = stops[next - 1];
  const b = stops[next];
  const share = (time - Date.parse(a.eta)) / (Date.parse(b.eta) - Date.parse(a.eta));
  return [
    a.longitude + (b.longitude - a.longitude) * share,
    a.latitude + (b.latitude - a.latitude) * share,
  ];
}
