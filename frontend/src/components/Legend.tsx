import { LEVELS, UNKNOWN, UNKNOWN_DIGIT } from "../utils/risk";

const ITEMS = [...LEVELS.map((info, level) => ({ ...info, level })), { ...UNKNOWN, level: UNKNOWN_DIGIT }];

interface LegendProps {
  focus: number | null;
  present: Set<number>;
  onFocus: (level: number | null) => void;
}

/** Click a level to show only its stretches, grid cells and checkpoints; click again to clear. */
export function Legend({ focus, present, onFocus }: LegendProps) {
  return (
    <div className="legend" aria-label="Risk legend">
      {ITEMS.map(({ label, color, level }) => (
        <button
          key={label}
          type="button"
          className={focus === level ? "active" : ""}
          disabled={!present.has(level)}
          aria-pressed={focus === level}
          title={present.has(level) ? `Show only ${label}` : `No ${label} on this trip`}
          onClick={() => onFocus(focus === level ? null : level)}
        >
          <i style={{ background: color }} />
          {label}
        </button>
      ))}
      <small className="muted">
        {focus === null
          ? "Click a level to show only it. Shaded cells: risk at the slider hour. ○ truck."
          : "Showing one level — click it again to show all."}
      </small>
    </div>
  );
}
