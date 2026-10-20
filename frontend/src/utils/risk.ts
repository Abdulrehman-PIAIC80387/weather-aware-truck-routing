import type { Level } from "../types/plan";

/** Colour-blind-safer ramp; every use pairs the colour with its label. */
export const LEVELS = [
  { label: "Low", color: "#4caf50" },
  { label: "Moderate", color: "#fdd835" },
  { label: "High", color: "#fb8c00" },
  { label: "Severe", color: "#e53935" },
  { label: "No Travel", color: "#6a1b9a" },
];
export const UNKNOWN = { label: "Unknown", color: "#9e9e9e" };
export const UNKNOWN_DIGIT = 9; // how the API encodes an unknown hour in the risk grid

export const levelInfo = (level: Level | null) => (level === null ? UNKNOWN : LEVELS[level]);
