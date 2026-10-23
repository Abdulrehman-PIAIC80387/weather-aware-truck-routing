import { API_BASE } from "../api";
import { LogoMark } from "./LogoMark";

const REPO_URL = "https://github.com/Abdulrehman-PIAIC80387/weather-aware-truck-routing";

export function SiteHeader() {
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
      <a className="header-button" href={REPO_URL} target="_blank" rel="noreferrer">
        GitHub repo
      </a>
    </header>
  );
}
