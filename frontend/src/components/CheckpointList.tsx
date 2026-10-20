import type { PlannedRoute } from "../types/plan";
import { formatTime } from "../utils/format";
import { levelInfo } from "../utils/risk";

interface CheckpointListProps {
  route: PlannedRoute;
  intervalMiles: number;
}

/** The selected route's checkpoints in driving order. */
export function CheckpointList({ route, intervalMiles }: CheckpointListProps) {
  return (
    <section aria-label={`Route ${route.id} checkpoints`}>
      <h2>
        Route {route.id} checkpoints{" "}
        <span className="muted">(every {intervalMiles} mi, weather at ETA)</span>
      </h2>
      <ol className="timeline">
        {route.checkpoints.map((checkpoint) => {
          const level = levelInfo(checkpoint.level);
          const conditions = checkpoint.conditions;
          return (
            <li key={checkpoint.mile}>
              <i style={{ background: level.color }} />
              <div>
                <strong>
                  Mile {Math.round(checkpoint.mile)} · {formatTime(checkpoint.eta)}
                </strong>{" "}
                <span className="level-chip" style={{ borderColor: level.color }}>
                  {level.label}
                </span>
                <div className="muted">
                  {conditions
                    ? `Wind ${conditions.wind_mph} mph · Rain ${conditions.rain_in_hr} in/hr · Snow ${conditions.snow_in_hr} in/hr`
                    : "No forecast for this time"}
                </div>
                {checkpoint.reasons.length > 0 && (
                  <div className="reasons">{checkpoint.reasons.join(" · ")}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
