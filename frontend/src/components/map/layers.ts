import type { ExpressionSpecification } from "maplibre-gl";
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

export const routeCasing: LayerProps = {
  id: "route-casing",
  type: "line",
  layout: { "line-join": "round", "line-cap": "round" },
  paint: { "line-color": "#0b1620", "line-width": 9 },
};

export function routeLines(selected: number): LayerProps {
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
      "line-opacity": ["case", isSelected(selected), 1, 0.65],
    },
  };
}

export function checkpointCircles(selected: number): LayerProps {
  return {
    id: "checkpoints",
    type: "circle",
    paint: {
      "circle-color": levelColor(["get", "level"]),
      "circle-radius": ["case", isSelected(selected), 5, 3],
      "circle-stroke-color": "#0b1620",
      "circle-stroke-width": ["case", isSelected(selected), 1.5, 0.5],
      "circle-opacity": ["case", isSelected(selected), 1, 0.5],
    },
  };
}

/** Risk at the slider hour, from each cell's feature state; Low cells stay clear. */
export const riskGrid: LayerProps = {
  id: "risk-grid",
  type: "fill",
  paint: {
    "fill-color": levelColor(["coalesce", ["feature-state", "r"], 0], "rgba(0, 0, 0, 0)"),
    "fill-opacity": ["match", ["coalesce", ["feature-state", "r"], 0], 0, 0, 0.42],
    "fill-outline-color": "rgba(0, 0, 0, 0)",
  },
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

export const INTERACTIVE_LAYERS = ["checkpoints", "route-lines"];
