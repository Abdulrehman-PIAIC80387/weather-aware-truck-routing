import type { FeatureCollection, LineString, Point } from "geojson";
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

/** Checkpoints, optionally only those at the `focus` level. `risk` (-1 when unknown)
 * lets clusters take the worst known level with a plain "max". */
export function checkpointPoints(plan: Plan, focus: number | null): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: plan.routes.flatMap((route, index) =>
      route.checkpoints.flatMap((checkpoint, position) => {
        const level = checkpoint.level ?? UNKNOWN_DIGIT;
        if (focus !== null && level !== focus) return [];
        return [
          {
            type: "Feature" as const,
            properties: { route: index, position, level, risk: checkpoint.level ?? -1 },
            geometry: {
              type: "Point" as const,
              coordinates: [checkpoint.longitude, checkpoint.latitude],
            },
          },
        ];
      }),
    ),
  };
}

/** Bounds of the stretches at `level`, preferring the selected route; null when none. */
export function levelBounds(plan: Plan, selected: number, level: number) {
  const pathsAt = (route: PlannedRoute) =>
    route.segments.filter((s) => (s.level ?? UNKNOWN_DIGIT) === level).flatMap((s) => s.path);
  const own = pathsAt(plan.routes[selected]);
  const points = own.length ? own : plan.routes.flatMap(pathsAt);
  return points.length ? boundsOf(points) : null;
}

/** Levels that appear on any route or in any grid hour, for the legend. */
export function levelsPresent(plan: Plan): Set<number> {
  const levels = new Set(plan.grid.risk.flatMap((hours) => [...hours].map(Number)));
  plan.routes.forEach((r) => r.segments.forEach((s) => levels.add(s.level ?? UNKNOWN_DIGIT)));
  return levels;
}

/** The road position halfway along a route, for its on-map label. */
export function midpoint(route: PlannedRoute): LngLat {
  const segment = route.segments[Math.floor(route.segments.length / 2)];
  return segment.path[Math.floor(segment.path.length / 2)];
}

export function bounds(plan: Plan): [LngLat, LngLat] {
  return boundsOf(plan.routes.flatMap((route) => route.segments.flatMap((s) => s.path)));
}

function boundsOf(points: LngLat[]): [LngLat, LngLat] {
  const longitudes = points.map(([lon]) => lon);
  const latitudes = points.map(([, lat]) => lat);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
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
