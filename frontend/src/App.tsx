import { useState } from "react";
import { RouteMap } from "./components/map/RouteMap";

export default function App() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="layout">
      <aside className="panel">
        <h1>Weather-Aware Truck Routing</h1>
      </aside>
      <main className="map-area">
        <RouteMap plan={null} selected={selected} onSelect={setSelected} />
      </main>
    </div>
  );
}
