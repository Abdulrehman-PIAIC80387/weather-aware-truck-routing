import { useCallback, useEffect, useRef, useState } from "react";
import { CheckpointList } from "./components/CheckpointList";
import { HeatmapSlider } from "./components/HeatmapSlider";
import { PlanForm } from "./components/PlanForm";
import { RouteCards } from "./components/RouteCards";
import { UnsafeBanner } from "./components/UnsafeBanner";
import { RouteMap, type RouteMapHandle } from "./components/map/RouteMap";
import { usePlan } from "./hooks/usePlan";

export default function App() {
  const { state, requestPlan } = usePlan();
  const plan = state.status === "success" ? state.plan : null;
  const [selected, setSelected] = useState(0);
  const map = useRef<RouteMapHandle>(null);
  const setHour = useCallback((hour: number) => map.current?.setHour(hour), []);

  useEffect(() => {
    if (plan) setSelected(plan.recommended);
  }, [plan]);

  return (
    <div className="layout">
      <aside className="panel">
        <header>
          <h1>Weather-Aware Truck Routing</h1>
          <p className="muted">
            Three truck routes, weather risk at each checkpoint's ETA, and the safest pick.{" "}
            <a href="/api/docs/" target="_blank" rel="noreferrer">
              API docs
            </a>
          </p>
        </header>
        <PlanForm isLoading={state.status === "loading"} onSubmit={requestPlan} />

        {state.status === "loading" && (
          <div className="loading" aria-live="polite">
            <span className="spinner" /> Routing and checking the forecast along each route…
          </div>
        )}
        {state.status === "error" && (
          <p className="error" role="alert">
            {state.message}
          </p>
        )}
        {plan && (
          <>
            {plan.unsafe && <UnsafeBanner />}
            <h2>Routes</h2>
            <RouteCards plan={plan} selected={selected} onSelect={setSelected} />
            {plan.routes[selected] && (
              <CheckpointList route={plan.routes[selected]} intervalMiles={plan.interval_miles} />
            )}
          </>
        )}
      </aside>
      <main className="map-area">
        <RouteMap ref={map} plan={plan} selected={selected} onSelect={setSelected} />
        {plan && <HeatmapSlider departure={plan.departure} onChange={setHour} />}
      </main>
    </div>
  );
}
