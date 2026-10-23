import { API_BASE } from "../api";
import { LogoMark } from "./LogoMark";
import { BasemapIconButton } from "./map/BasemapIconButton";
import type { BasemapId } from "./map/basemap";

const REPO_URL = "https://github.com/Abdulrehman-PIAIC80387/weather-aware-truck-routing";

interface SiteHeaderProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
  basemap: BasemapId;
  onBasemapChange: (basemap: BasemapId) => void;
}

export function SiteHeader({ panelOpen, onTogglePanel, basemap, onBasemapChange }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a className="brand" href="/">
        <LogoMark />
        weather-aware routing
      </a>
      <nav className="site-nav" aria-label="Main">
        <a className="active" href="/">
          Route planner
        </a>
        <a href={`${REPO_URL}#how-it-works`} target="_blank" rel="noreferrer">
          How it works
        </a>
        <a href={`${API_BASE}/api/docs/`} target="_blank" rel="noreferrer">
          API docs
        </a>
      </nav>
      {/* Mobile only: map colour icon and the planner drawer's single open/close button */}
      <BasemapIconButton value={basemap} onChange={onBasemapChange} />
      <button
        type="button"
        className="drawer-button"
        onClick={onTogglePanel}
        aria-expanded={panelOpen}
      >
        {panelOpen ? "✕ Close" : "☰ Plan route"}
      </button>
      <a className="header-button" href={REPO_URL} target="_blank" rel="noreferrer">
        GitHub repo
      </a>
    </header>
  );
}
