import { BASEMAPS, type BasemapId } from "./basemap";

interface BasemapSwitcherProps {
  value: BasemapId;
  onChange: (basemap: BasemapId) => void;
}

export function BasemapSwitcher({ value, onChange }: BasemapSwitcherProps) {
  return (
    <div className="basemap-switcher" role="radiogroup" aria-label="Map colour">
      {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={value === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          <i className={`swatch swatch-${id}`} />
          {BASEMAPS[id].label}
        </button>
      ))}
    </div>
  );
}
