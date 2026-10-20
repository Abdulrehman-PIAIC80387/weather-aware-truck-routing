import { LEVELS, UNKNOWN } from "../utils/risk";

export function Legend() {
  return (
    <div className="legend" aria-label="Risk legend">
      {[...LEVELS, UNKNOWN].map((level) => (
        <span key={level.label}>
          <i style={{ background: level.color }} />
          {level.label}
        </span>
      ))}
      <small className="muted">Shaded cells: risk at the slider hour. ○ truck position.</small>
    </div>
  );
}
