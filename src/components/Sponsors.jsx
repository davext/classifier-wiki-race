const REPO_URL = "https://github.com/davext/classifier-wiki-race";

export default function Sponsors() {
  return (
    <footer className="site-footer">
      <div className="blooio-card">
        <div className="blooio-head">
          <img
            src="https://bucket.blooio.com/assets/Logo/LogoSQ-sm.png"
            alt="Blooio"
            className="blooio-logo"
            width="40"
            height="40"
            loading="lazy"
          />
          <div>
            <h3>Need to send messages at scale? Blooio.</h3>
            <p>One HTTP API for iMessage, SMS, RCS &amp; WhatsApp.</p>
          </div>
          <a className="btn primary" href="https://blooio.com" target="_blank" rel="noopener noreferrer">
            Explore Blooio
          </a>
        </div>
        <p className="blooio-sub">
          This race is powered by classifiers — the same idea behind{" "}
          <strong>Bloobability</strong>, Blooio's calibrated gauge that scores how likely a policy
          applies to a conversation.{" "}
          <a
            href="https://blooio.com/inference/bloobability/playground"
            target="_blank"
            rel="noopener noreferrer"
          >
            Try the Bloobability playground →
          </a>
        </p>
      </div>

      <div className="footer-meta">
        <p className="privacy">
          🔒 <strong>Your API key is never stored.</strong> It's sent per-request through a
          stateless Cloudflare Worker straight to TypeSafe and immediately discarded — nothing is
          saved, logged, or persisted. Wikipedia pages are fetched directly by your browser.
        </p>
        <p className="credits">
          Built by{" "}
          <a href="https://x.com/dave_xt" target="_blank" rel="noopener noreferrer">
            David Harvey (@dave_xt)
          </a>{" "}
          · Open source on{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>{" "}
          · Classifier by{" "}
          <a href="https://typesafe.ai" target="_blank" rel="noopener noreferrer">
            TypeSafe
          </a>
        </p>
      </div>
    </footer>
  );
}
