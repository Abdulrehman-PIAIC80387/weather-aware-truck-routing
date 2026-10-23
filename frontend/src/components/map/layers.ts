import type { ExpressionSpecification, RasterLayerSpecification } from "maplibre-gl";
import type { LayerProps } from "react-map-gl/maplibre";
import { LEVELS, UNKNOWN, UNKNOWN_DIGIT } from "../../utils/risk";

/** ["match", <level>, 0, low, 1, moderate, …, 9, unknown, fallback] */
function levelColor(level: ExpressionSpecification, fallback = UNKNOWN.color) {
  const stops = LEVELS.flatMap((info, index) => [index, info.color]);
  const expression = ["match", level, ...stops, UNKNOWN_DIGIT, UNKNOWN.color, fallback];
  return expression as unknown as ExpressionSpecification;
}

const isSelected = (selected: number): ExpressionSpecification => [
  "==",
  ["get", "route"],
  selected,
];

/** Opacity that dims everything except the legend level in focus. */
function focusOpacity(level: ExpressionSpecification, focus: number | null, normal: unknown) {
  if (focus === null) return normal as ExpressionSpecification;
  return ["case", ["==", level, focus], 1, 0.12] as ExpressionSpecification;
}

export function routeCasing(color: string, focus: number | null): LayerProps {
  return {
    id: "route-casing",
    type: "line",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": color,
      "line-width": 9,
      "line-opacity": focusOpacity(["get", "level"], focus, 1),
    },
  };
}

export function routeLines(selected: number, focus: number | null): LayerProps {
  return {
    id: "route-lines",
    type: "line",
    layout: {
      "line-join": "round",
      "line-cap": "round",
      "line-sort-key": ["case", isSelected(selected), 1, 0], // selected route on top
    },
    paint: {
      "line-color": levelColor(["get", "level"]),
      "line-width": ["case", isSelected(selected), 6, 3],
      "line-opacity": focusOpacity(["get", "level"], focus, [
        "case",
        isSelected(selected),
        1,
        0.65,
      ]),
    },
  };
}

export function checkpointCircles(selected: number): LayerProps {
  return {
    id: "checkpoints",
    type: "circle",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": levelColor(["get", "level"]),
      "circle-radius": ["case", isSelected(selected), 5, 3],
      "circle-stroke-color": "#0b1620",
      "circle-stroke-width": ["case", isSelected(selected), 1.5, 0.5],
      "circle-opacity": ["case", isSelected(selected), 1, 0.5],
    },
  };
}

/** Zoomed-out checkpoints merge into clusters coloured by their worst level. */
export const checkpointClusters: LayerProps = {
  id: "clusters",
  type: "circle",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": levelColor(["get", "worst"]), // worst = -1 (all unknown) → grey
    "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 40, 22],
    "circle-stroke-color": "#0b1620",
    "circle-stroke-width": 2,
  },
};

export const clusterCounts: LayerProps = {
  id: "cluster-counts",
  type: "symbol",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font": ["Noto Sans Regular"], // available in every OpenFreeMap style we use
    "text-size": 12,
    "text-allow-overlap": true,
  },
  paint: { "text-color": "#ffffff", "text-halo-color": "#0b1620", "text-halo-width": 1.5 },
};

/** The smooth risk curves, drawn opaque on a canvas and shown here at one opacity. */
export const riskAreas: RasterLayerSpecification = {
  id: "risk-areas",
  type: "raster",
  source: "grid",
  paint: { "raster-opacity": 0.45, "raster-fade-duration": 0 },
};

export function truckDots(selected: number): LayerProps {
  return {
    id: "trucks",
    type: "circle",
    paint: {
      "circle-color": "#ffffff",
      "circle-radius": ["case", isSelected(selected), 7, 4],
      "circle-stroke-color": "#111827",
      "circle-stroke-width": ["case", isSelected(selected), 3, 2],
    },
  };
}

export const INTERACTIVE_LAYERS = ["clusters", "checkpoints", "route-lines"];
