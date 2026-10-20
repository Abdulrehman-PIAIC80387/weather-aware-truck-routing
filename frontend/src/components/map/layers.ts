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
  paint: { "line-color": "#ffffff", "line-width": 9 },
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
      "line-opacity": ["case", isSelected(selected), 1, 0.45],
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
      "circle-stroke-color": "#1f2937",
      "circle-stroke-width": ["case", isSelected(selected), 1.5, 0.5],
      "circle-opacity": ["case", isSelected(selected), 1, 0.5],
    },
  };
}

export const INTERACTIVE_LAYERS = ["checkpoints", "route-lines"];
