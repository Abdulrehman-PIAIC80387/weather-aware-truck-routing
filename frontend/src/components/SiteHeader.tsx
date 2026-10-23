const REPO_URL = "https://github.com/Abdulrehman-PIAIC80387/weather-aware-truck-routing";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        weather-aware routing
      </a>
      <nav className="site-nav" aria-label="Main">
        <a className="active" href="/">
          Route planner
        </a>
        <a href={`${REPO_URL}#how-it-works`} target="_blank" rel="noreferrer">
          How it works
        </a>
        <a href="/api/docs/" target="_blank" rel="noreferrer">
          API docs
        </a>
      </nav>
      <a className="header-button" href={REPO_URL} target="_blank" rel="noreferrer">
        GitHub repo
      </a>
    </header>
  );
}
