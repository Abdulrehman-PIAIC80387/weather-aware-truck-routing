import { type KeyboardEvent, useId, useState } from "react";
import { useGeocode } from "../hooks/useGeocode";
import type { Place } from "../types/plan";

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
}

/** A search box with US place suggestions. Picking one sets `value`; typing clears it. */
export function LocationInput({ label, placeholder, value, onChange }: LocationInputProps) {
  const listId = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [active, setActive] = useState(0);
  const { results, status, clear } = useGeocode(text, !value);

  function pick(place: Place) {
    onChange(place);
    setText(place.label);
    clear();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((active + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(results[active] ?? results[0]);
    } else if (event.key === "Escape") {
      clear();
    }
  }

  return (
    <label className="location-input">
      {label}
      <input
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
          if (value) onChange(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={clear}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        autoComplete="off"
      />
      {results.length > 0 && (
        <ul id={listId} className="suggestions" role="listbox">
          {results.map((place, index) => (
            <li
              key={`${place.label}-${place.latitude}-${place.longitude}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(place)}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}
      {status === "searching" && <small className="muted">Searching…</small>}
      {status === "error" && <small className="error">Place search is unavailable.</small>}
    </label>
  );
}
