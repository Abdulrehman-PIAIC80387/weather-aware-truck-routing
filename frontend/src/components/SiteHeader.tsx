import { API_BASE } from "../api";
import { LogoMark } from "./LogoMark";

const REPO_URL = "https://github.com/Abdulrehman-PIAIC80387/weather-aware-truck-routing";

interface SiteHeaderProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export function SiteHeader({ panelOpen, onTogglePanel }: SiteHeaderProps) {
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
      {/* Mobile only: the planner panel opens as a drawer from here */}
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
