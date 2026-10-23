import { type FormEvent, useId, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import type { Interval, Place, PlanRequest } from "../types/plan";
import { toLocalInput } from "../utils/format";
import { LocationInput } from "./LocationInput";

const INTERVALS: Interval[] = [10, 25, 50];
// The API and the risk rules work in pounds; kilograms are only for entry and display.
const UNITS = {
  lb: { perLb: 1, max: 80_000 },
  kg: { perLb: 0.45359237, max: 36_287 }, // 36,287 kg = 80,000 lb
};
type Unit = keyof typeof UNITS;
const isUnit = (value: unknown): value is Unit => value === "lb" || value === "kg";

interface PlanFormProps {
  isLoading: boolean;
  onSubmit: (request: PlanRequest) => void;
}

export function PlanForm({ isLoading, onSubmit }: PlanFormProps) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(() => toLocalInput(new Date()));
  const [loadLb, setLoadLb] = useState(40_000);
  const [unit, setUnit] = usePersistentState<Unit>("loadUnit", "lb", isUnit);
  const loadId = useId();
  const { perLb, max } = UNITS[unit];
  const [interval, setIntervalMiles] = useState<Interval>(25);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!origin || !destination) return;
    const departureIso = new Date(departure).toISOString();
    onSubmit({ origin, destination, departure: departureIso, loadLb, interval });
  }

  return (
    <form className="plan-form" onSubmit={handleSubmit}>
      <LocationInput
        label="Origin"
        placeholder="e.g. Chicago, IL"
        value={origin}
        onChange={setOrigin}
      />
      <LocationInput
        label="Destination"
        placeholder="e.g. Denver, CO"
        value={destination}
        onChange={setDestination}
      />
      <div className="form-row">
        <label>
          Departure
          <input
            type="datetime-local"
            value={departure}
            required
            onChange={(event) => setDeparture(event.target.value)}
          />
        </label>
        <div className="load-field">
          <div className="load-head">
            <label htmlFor={loadId}>Load</label>
            <span className="unit-toggle" role="radiogroup" aria-label="Load unit">
              {(Object.keys(UNITS) as Unit[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={unit === option}
                  className={unit === option ? "active" : ""}
                  onClick={() => setUnit(option)}
                >
                  {option}
                </button>
              ))}
            </span>
          </div>
          <input
            id={loadId}
            type="number"
            min={0}
            max={max}
            step={1} // converted values are not round numbers, so no coarser step
            value={Math.round(loadLb * perLb)}
            required
            onChange={(event) => setLoadLb(Math.round(Number(event.target.value) / perLb))}
          />
        </div>
      </div>
      <fieldset className="interval">
        <legend>Weather checkpoint every</legend>
        {INTERVALS.map((miles) => (
          <label key={miles} className={interval === miles ? "active" : ""}>
            <input
              type="radio"
              name="interval"
              checked={interval === miles}
              onChange={() => setIntervalMiles(miles)}
            />
            {miles} mi
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={isLoading || !origin || !destination}>
        {isLoading ? "Planning routes…" : "Find safest route"}
      </button>
      {(!origin || !destination) && (
        <small className="muted">Pick both places from the suggestions.</small>
      )}
    </form>
  );
}
