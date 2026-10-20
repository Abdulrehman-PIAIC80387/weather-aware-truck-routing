import { useEffect, useState } from "react";
import { formatTime } from "../utils/format";

const HOURS = 48;
const PLAY_STEP_MS = 400;

interface HeatmapSliderProps {
  departure: string;
  onChange: (hour: number) => void;
}

/** 0-48 h after departure. Owns its hour, so moving it re-renders only this control. */
export function HeatmapSlider({ departure, onChange }: HeatmapSliderProps) {
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setHour(0);
    setPlaying(false);
  }, [departure]);

  useEffect(() => onChange(hour), [hour, onChange]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setHour((current) => {
        if (current >= HOURS) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, PLAY_STEP_MS);
    return () => clearInterval(timer);
  }, [playing]);

  const time = Date.parse(departure) + hour * 3_600_000;

  return (
    <div className="slider">
      <button
        type="button"
        onClick={() => {
          if (hour >= HOURS) setHour(0);
          setPlaying(!playing);
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <input
        type="range"
        min={0}
        max={HOURS}
        value={hour}
        onChange={(event) => {
          setPlaying(false);
          setHour(Number(event.target.value));
        }}
        aria-label="Forecast hour"
      />
      <output>
        {formatTime(time)} <span className="muted">(+{hour} h)</span>
      </output>
    </div>
  );
}
