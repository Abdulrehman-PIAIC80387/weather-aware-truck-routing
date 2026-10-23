import { useCallback, useEffect, useRef, useState } from "react";
import { CheckpointList } from "./components/CheckpointList";
import { HeatmapSlider } from "./components/HeatmapSlider";
import { PlanForm } from "./components/PlanForm";
import { RouteCards } from "./components/RouteCards";
import { SiteHeader } from "./components/SiteHeader";
import { BasemapSwitcher } from "./components/map/BasemapSwitcher";
import { isBasemap } from "./components/map/basemap";
import { UnsafeBanner } from "./components/UnsafeBanner";
import { RouteMap, type RouteMapHandle } from "./components/map/RouteMap";
import { usePersistentState } from "./hooks/usePersistentState";
import { usePlan } from "./hooks/usePlan";

const MOBILE = "(max-width: 800px)"; // keep in sync with index.css

export default function App() {
  const { state, requestPlan } = usePlan();
  const plan = state.status === "success" ? state.plan : null;
  const [selected, setSelected] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [basemap, setBasemap] = usePersistentState("basemap", "navy", isBasemap);
  const map = useRef<RouteMapHandle>(null);
  const setHour = useCallback((hour: number) => map.current?.setHour(hour), []);

  useEffect(() => {
    if (!plan) return;
    setSelected(plan.recommended);
    if (window.matchMedia(MOBILE).matches) setPanelOpen(false); // show the routes
  }, [plan]);

  return (
    <div className="app">
      <SiteHeader panelOpen={panelOpen} onTogglePanel={() => setPanelOpen(!panelOpen)} />
      <div className={`layout ${panelOpen ? "" : "panel-closed"}`}>
        <div className="drawer-backdrop" onClick={() => setPanelOpen(false)} />
        <aside className="panel" aria-label="Route planner">
          <button
            type="button"
            className="drawer-close"
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
          >
            ✕
          </button>
          <header>
            <h1>Weather-Aware Truck Routing</h1>
            <p className="muted">
              Three truck routes, weather risk at each checkpoint's ETA, and the safest pick.
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
          <button
            type="button"
            className="panel-toggle"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-expanded={panelOpen}
            aria-label={panelOpen ? "Hide side panel" : "Show side panel"}
            title={panelOpen ? "Hide side panel" : "Show side panel"}
          >
            {panelOpen ? "‹" : "›"}
          </button>
          <RouteMap
            ref={map}
            plan={plan}
            basemap={basemap}
            selected={selected}
            onSelect={setSelected}
          />
          <BasemapSwitcher value={basemap} onChange={setBasemap} />
          {plan && <HeatmapSlider departure={plan.departure} onChange={setHour} />}
        </main>
      </div>
    </div>
  );
}
