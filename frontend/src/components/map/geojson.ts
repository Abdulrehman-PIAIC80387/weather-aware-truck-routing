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
