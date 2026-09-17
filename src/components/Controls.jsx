export default function Controls({
  apiKey,
  setApiKey,
  start,
  setStart,
  dest,
  setDest,
  running,
  onStart,
  onStop,
  onRandom,
}) {
  return (
    <section className="controls">
      <div className="field key-field">
        <label htmlFor="apiKey">Your Jev (TypeSafe) API key</label>
        <input
          id="apiKey"
          type="password"
          placeholder="sk-…  (kept in memory only — never stored)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="hint">
          Get one at{" "}
          <a href="https://typesafe.ai" target="_blank" rel="noopener noreferrer">
            typesafe.ai
          </a>
          . It's sent per-request through a stateless proxy and never saved.
        </p>
      </div>

      <div className="race-row">
        <div className="field">
          <label htmlFor="start">Start article</label>
          <input
            id="start"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={running}
            spellCheck={false}
          />
        </div>

        <span className="arrow" aria-hidden="true">→</span>

        <div className="field">
          <label htmlFor="dest">Destination article</label>
          <input
            id="dest"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            disabled={running}
            spellCheck={false}
          />
        </div>

        <div className="buttons">
          <button type="button" className="btn ghost" onClick={onRandom} disabled={running}>
            🎲 Random
          </button>
          {running ? (
            <button type="button" className="btn danger" onClick={onStop}>
              ■ Stop
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={onStart}>
              ▶ Start race
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
