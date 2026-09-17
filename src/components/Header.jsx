const REPO_URL = "https://github.com/davext/classifier-wiki-race";

export default function Header() {
  return (
    <header className="site-header">
      <div className="brand">
        <span className="flag" aria-hidden="true">🏁</span>
        <div>
          <h1>Classifier Wiki Race</h1>
          <p className="tagline">
            Watch <strong>Jev</strong> — TypeSafe's ultrafast classifier — race across Wikipedia
            with <em>no LLM in the loop</em>.
          </p>
        </div>
      </div>

      <div className="header-links">
        <a
          className="pill"
          href="https://x.com/dave_xt"
          target="_blank"
          rel="noopener noreferrer"
        >
          Built by David Harvey · @dave_xt
        </a>
        <a className="pill ghost" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          ★ Open source
        </a>
      </div>
    </header>
  );
}
