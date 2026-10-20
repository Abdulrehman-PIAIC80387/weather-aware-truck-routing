import type { Plan } from "../types/plan";
import { formatDuration, formatMiles, formatTime } from "../utils/format";
import { LEVELS, UNKNOWN } from "../utils/risk";

interface RouteCardsProps {
  plan: Plan;
  selected: number;
  onSelect: (route: number) => void;
}

export function RouteCards({ plan, selected, onSelect }: RouteCardsProps) {
  return (
    <div className="route-cards">
      {plan.routes.map((route, index) => {
        const { summary } = route;
        const miles = [
          { label: LEVELS[4].label, color: LEVELS[4].color, value: summary.no_travel_miles },
          { label: LEVELS[3].label, color: LEVELS[3].color, value: summary.severe_miles },
          { label: LEVELS[2].label, color: LEVELS[2].color, value: summary.high_miles },
          { label: UNKNOWN.label, color: UNKNOWN.color, value: summary.unknown_miles },
        ];
        return (
          <button
            key={route.id}
            type="button"
            className={`route-card ${index === selected ? "selected" : ""}`}
            onClick={() => onSelect(index)}
            aria-pressed={index === selected}
          >
            <header>
              <strong>Route {route.id}</strong>
              {index === plan.recommended && <span className="badge">★ Recommended</span>}
            </header>
            <div className="route-stats">
              <span>{formatMiles(route.distance_miles)}</span>
              <span>{formatDuration(route.duration_seconds)}</span>
              <span>Arrive {formatTime(route.arrival)}</span>
            </div>
            <dl>
              {miles.map((item) => (
                <div key={item.label} className={item.value ? "" : "zero"}>
                  <dt>
                    <i style={{ background: item.color }} />
                    {item.label}
                  </dt>
                  <dd>{formatMiles(item.value)}</dd>
                </div>
              ))}
              <div>
                <dt>Avg risk</dt>
                <dd>{summary.average_risk === null ? "—" : summary.average_risk.toFixed(2)}</dd>
              </div>
            </dl>
            {index === plan.recommended && <p className="reason">{plan.reason}</p>}
          </button>
        );
      })}
    </div>
  );
}
