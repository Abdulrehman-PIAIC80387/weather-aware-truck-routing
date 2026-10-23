import type { Map as MapLibreMap } from "maplibre-gl";

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

/** Recolours OpenFreeMap's near-black "dark" style to the app's navy palette. */
const NAVY_PAINT: Record<string, Record<string, string>> = {
  background: { "background-color": "#1c3a4f" },
  water: { "fill-color": "#0d2131" },
  waterway: { "line-color": "#0d2131" },
  landuse_residential: { "fill-color": "#21425a" },
  landcover_wood: { "fill-color": "#1f3f53" },
  landuse_park: { "fill-color": "#1f3f53" },
  building: { "fill-color": "#24465d", "fill-outline-color": "#2c5068" },
  highway_minor: { "line-color": "#2a4c63" },
  highway_major_subtle: { "line-color": "#33576f" },
  highway_motorway_subtle: { "line-color": "#3a5f78" },
  boundary_state: { "line-color": "#4d7590" },
  "boundary_country_z0-4": { "line-color": "#6d93ab" },
  "boundary_country_z5-": { "line-color": "#6d93ab" },
};
const LABEL_COLOR = "#a9c0d1";

export function applyNavyBasemap(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers) {
    for (const [property, color] of Object.entries(NAVY_PAINT[layer.id] ?? {})) {
      map.setPaintProperty(layer.id, property, color);
    }
    if (layer.type === "symbol" && map.getLayoutProperty(layer.id, "text-field")) {
      map.setPaintProperty(layer.id, "text-color", LABEL_COLOR);
      map.setPaintProperty(layer.id, "text-halo-color", "#1c3a4f");
    }
  }
}
