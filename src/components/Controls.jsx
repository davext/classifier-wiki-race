export default function Controls({
  apiKey,
  setApiKey,
  start,
  setStart,
  dest,
  setDest,
  running,
  startBusy,
  destBusy,
  onStart,
  onStop,
  onRandom,
  onRandomStart,
  onRandomDest,
}) {
  return (
    <section className="controls">
      <div className="field key-field">
        <label htmlFor="apiKey">Your Jev (TypeSafe) API key</label>
        <input
          id="apiKey"
          type="password"
          placeholder="apikey_…  (kept in memory only — never stored)"
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
          <div className="input-wrap">
            <input
              id="start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={running || startBusy}
              spellCheck={false}
            />
            <button
              type="button"
              className="dice"
              onClick={onRandomStart}
              disabled={running || startBusy}
              title="Random valid start article"
              aria-label="Random start article"
            >
              {startBusy ? "…" : "🎲"}
            </button>
          </div>
        </div>

        <span className="arrow" aria-hidden="true">→</span>

        <div className="field">
          <label htmlFor="dest">Destination article</label>
          <div className="input-wrap">
            <input
              id="dest"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              disabled={running || destBusy}
              spellCheck={false}
            />
            <button
              type="button"
              className="dice"
              onClick={onRandomDest}
              disabled={running || destBusy}
              title="Random valid destination article"
              aria-label="Random destination article"
            >
              {destBusy ? "…" : "🎲"}
            </button>
          </div>
        </div>

        <div className="buttons">
          <button
            type="button"
            className="btn ghost"
            onClick={onRandom}
            disabled={running || startBusy || destBusy}
          >
            🎲 Random both
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
