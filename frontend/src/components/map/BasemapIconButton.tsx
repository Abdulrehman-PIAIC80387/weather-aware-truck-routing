import { BASEMAPS, type BasemapId } from "./basemap";

const ORDER: BasemapId[] = ["navy", "dark", "light"];

// Navy: half-filled circle · Dark: moon · Light: sun
const ICONS: Record<BasemapId, JSX.Element> = {
  navy: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />,
  light: (
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
  ),
};

interface BasemapIconButtonProps {
  value: BasemapId;
  onChange: (basemap: BasemapId) => void;
}

/** One icon button that cycles Navy → Dark → Light (the mobile navbar's map colour). */
export function BasemapIconButton({ value, onChange }: BasemapIconButtonProps) {
  const next = ORDER[(ORDER.indexOf(value) + 1) % ORDER.length];
  const label = `Map: ${BASEMAPS[value].label} (tap for ${BASEMAPS[next].label})`;
  return (
    <button
      type="button"
      className="basemap-icon"
      onClick={() => onChange(next)}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        {ICONS[value]}
      </svg>
    </button>
  );
}
