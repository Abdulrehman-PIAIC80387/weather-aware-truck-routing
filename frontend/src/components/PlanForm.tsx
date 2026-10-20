import { type FormEvent, useState } from "react";
import type { Interval, Place, PlanRequest } from "../types/plan";
import { toLocalInput } from "../utils/format";
import { LocationInput } from "./LocationInput";

const INTERVALS: Interval[] = [10, 25, 50];
const MAX_LOAD_LB = 80_000;

interface PlanFormProps {
  isLoading: boolean;
  onSubmit: (request: PlanRequest) => void;
}

export function PlanForm({ isLoading, onSubmit }: PlanFormProps) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(() => toLocalInput(new Date()));
  const [loadLb, setLoadLb] = useState(40_000);
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
        <label>
          Load (lb)
          <input
            type="number"
            min={0}
            max={MAX_LOAD_LB}
            step={500}
            value={loadLb}
            required
            onChange={(event) => setLoadLb(Number(event.target.value))}
          />
        </label>
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
