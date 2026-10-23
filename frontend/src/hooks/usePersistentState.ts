import { useEffect, useState } from "react";

/** State remembered in localStorage; falls back to `initial` when storage is unavailable. */
export function usePersistentState<T>(key: string, initial: T, isValid: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "null");
      return isValid(stored) ? stored : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode or blocked storage: the choice just isn't remembered.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
