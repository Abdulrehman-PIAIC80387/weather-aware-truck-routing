import { useCallback, useEffect, useRef, useState } from "react";
import { planTrip } from "../api";
import type { Plan, PlanRequest } from "../types/plan";

type PlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; plan: Plan }
  | { status: "error"; message: string };

/** Plan requests; a new request cancels the one in flight. */
export function usePlan() {
  const [state, setState] = useState<PlanState>({ status: "idle" });
  const inFlight = useRef<AbortController | null>(null);

  const requestPlan = useCallback(async (request: PlanRequest) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ status: "loading" });
    try {
      setState({ status: "success", plan: await planTrip(request, controller.signal) });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Something went wrong";
      setState({ status: "error", message });
    }
  }, []);

  useEffect(() => () => inFlight.current?.abort(), []);

  return { state, requestPlan };
}
