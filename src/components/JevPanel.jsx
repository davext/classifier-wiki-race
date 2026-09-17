function ProbBars({ probs, highlight }) {
  const rows = Object.entries(probs || {}).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="muted small">No probabilities yet.</p>;
  return (
    <div className="bars">
      {rows.map(([label, value]) => (
        <div className={`bar-row${label === highlight ? " top" : ""}`} key={label}>
          <span className="bar-label" title={label}>
            {label}
          </span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.round(value * 100)}%` }} />
          </span>
          <span className="bar-value">{value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

export default function JevPanel({ decision, destination, path, stats, log, phase }) {
  return (
    <section className="pane jev-panel">
      <div className="jev-head">
        <h2>Jev · System One</h2>
        <span className={`status ${phase}`}>{phase}</span>
      </div>

      <div className="stat-grid">
        <Stat label="Hops" value={stats.hops} />
        <Stat label="Elapsed" value={`${stats.elapsedMs} ms`} />
        <Stat label="Last call" value={`${stats.last} ms`} />
        <Stat label="Avg call" value={`${stats.avg} ms`} />
      </div>

      {decision ? (
        <>
          <div className={`action-banner op-${decision.operation.toLowerCase()}`}>
            <span className="op">{decision.operation}</span>
            {decision.chosen ? <span className="arrow">→</span> : null}
            {decision.chosen ? <span className="target">{decision.chosen.name}</span> : null}
            <span className="latency">{decision.latencyMs} ms</span>
          </div>

          <details open className="block">
            <summary>Operation — which move?</summary>
            <ProbBars probs={decision.operationProbabilities} highlight={decision.operation} />
          </details>

          <details open className="block">
            <summary>
              Target — which link? {decision.candidates?.length ? `(${decision.candidates.length} offered)` : ""}
            </summary>
            <ProbBars probs={decision.targetProbabilities} highlight={decision.ref} />
          </details>

          <details className="block">
            <summary>State we pass to Jev</summary>
            <JsonBlock value={decision.requestBody?.state} />
          </details>

          <details className="block">
            <summary>Questions (the speculative fan-out)</summary>
            <JsonBlock value={decision.requestBody?.questions} />
          </details>

          <details className="block">
            <summary>Raw response</summary>
            <JsonBlock value={decision.responseBody} />
          </details>
        </>
      ) : (
        <p className="muted">Start a race to see Jev's state, questions and answers stream in.</p>
      )}

      <details open className="block">
        <summary>Path {path.length ? `(${Math.max(0, path.length - 1)} hops)` : ""}</summary>
        <ol className="path-list">
          {path.map((title, i) => (
            <li key={`${title}-${i}`} className={i === path.length - 1 ? "current" : ""}>
              {title}
            </li>
          ))}
        </ol>
        {path.length ? (
          <p className="dest-note">
            Destination: <strong>{destination}</strong>
          </p>
        ) : null}
      </details>

      <details className="block">
        <summary>Event log</summary>
        <ul className="event-log">
          {log
            .slice()
            .reverse()
            .map((e, i) => (
              <li key={i} className={`ev ${e.kind}`}>
                <span className="ev-text">{e.text}</span>
                {e.latencyMs != null ? <span className="ev-ms">{e.latencyMs} ms</span> : null}
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function JsonBlock({ value }) {
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}
