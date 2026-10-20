import { useEffect, useState } from "react";
import { searchPlaces } from "../api";
import type { Place } from "../types/plan";

const MIN_CHARACTERS = 3;
const TYPING_DELAY_MS = 300;

/** Place suggestions for `text`, searched once typing pauses. */
export function useGeocode(text: string, enabled: boolean) {
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");

  useEffect(() => {
    const query = text.trim();
    if (!enabled || query.length < MIN_CHARACTERS) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("searching");
      searchPlaces(query, controller.signal)
        .then((places) => {
          setResults(places);
          setStatus("idle");
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    }, TYPING_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, enabled]);

  return { results, status, clear: () => setResults([]) };
}
