export default function App() {
  return (
    <div className="layout">
      <aside className="panel">
        <h1>Weather-Aware Truck Routing</h1>
        <p className="muted">
          <a href="/api/docs/" target="_blank" rel="noreferrer">
            API docs
          </a>
        </p>
      </aside>
      <main className="map-area" />
    </div>
  );
}
