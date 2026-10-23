import type { Map as MapLibreMap } from "maplibre-gl";

const STYLES = "https://tiles.openfreemap.org/styles";

export type BasemapId = "navy" | "dark" | "light";

/** Paint overrides for OpenFreeMap's near-black "dark" style, plus the label colours. */
interface Palette {
  paint: Record<string, Record<string, string>>;
  label: string;
  halo: string;
}

const NAVY: Palette = {
  paint: {
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
  },
  label: "#a9c0d1",
  halo: "#1c3a4f",
};

// Charcoal rather than the style's pure black, so land, water and roads stay readable.
const CHARCOAL: Palette = {
  paint: {
    background: { "background-color": "#2a2e33" },
    water: { "fill-color": "#16191c" },
    waterway: { "line-color": "#16191c" },
    landuse_residential: { "fill-color": "#30353b" },
    landcover_wood: { "fill-color": "#2d3237" },
    landuse_park: { "fill-color": "#2d3237" },
    building: { "fill-color": "#363c43", "fill-outline-color": "#40474f" },
    highway_minor: { "line-color": "#3b4148" },
    highway_major_subtle: { "line-color": "#464d55" },
    highway_motorway_subtle: { "line-color": "#525a63" },
    boundary_state: { "line-color": "#626b75" },
    "boundary_country_z0-4": { "line-color": "#848e99" },
    "boundary_country_z5-": { "line-color": "#848e99" },
  },
  label: "#c4cbd3",
  halo: "#2a2e33",
};

interface Basemap {
  label: string;
  url: string;
  labelLayer: string; // first place-name layer: the risk grid is drawn beneath it
  casing: string; // outline around route lines
  palette?: Palette; // recolours the style after it loads
}

export const BASEMAPS: Record<BasemapId, Basemap> = {
  // Navy and Dark share one style: switching between them only repaints (no reload).
  navy: {
    label: "Navy",
    url: `${STYLES}/dark`,
    labelLayer: "water_name",
    casing: "#0b1620",
    palette: NAVY,
  },
  dark: {
    label: "Dark",
    url: `${STYLES}/dark`,
    labelLayer: "water_name",
    casing: "#15181b",
    palette: CHARCOAL,
  },
  light: {
    label: "Light",
    url: `${STYLES}/positron`,
    labelLayer: "waterway_line_label",
    casing: "#ffffff",
  },
};

export const isBasemap = (value: unknown): value is BasemapId =>
  typeof value === "string" && value in BASEMAPS;

/** Repaints the loaded "dark" style; does nothing while another style is loaded. */
export function applyPalette(map: MapLibreMap, { paint, label, halo }: Palette): void {
  if (!map.getLayer("water_name")) return; // not the "dark" style (yet)
  for (const layer of map.getStyle().layers) {
    for (const [property, color] of Object.entries(paint[layer.id] ?? {})) {
      map.setPaintProperty(layer.id, property, color);
    }
    if (layer.type === "symbol" && map.getLayoutProperty(layer.id, "text-field")) {
      map.setPaintProperty(layer.id, "text-color", label);
      map.setPaintProperty(layer.id, "text-halo-color", halo);
    }
  }
}
