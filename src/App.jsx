import { useCallback, useMemo, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Controls from "./components/Controls.jsx";
import BrowserPane from "./components/BrowserPane.jsx";
import JevPanel from "./components/JevPanel.jsx";
import Sponsors from "./components/Sponsors.jsx";
import { getArticle, getRandomArticles, titleKey } from "./lib/wikipedia.js";
import { classify } from "./lib/jev.js";

const MAX_STEPS = 30;
const WATCH_DELAY_MS = 850;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [start, setStart] = useState("Apple Inc.");
  const [dest, setDest] = useState("Sulla");

  const [phase, setPhase] = useState("idle"); // idle | running | won | stuck | stopped | error
  const [article, setArticle] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [decision, setDecision] = useState(null);
  const [path, setPath] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [latencies, setLatencies] = useState([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  const stopRef = useRef(false);

  const stats = useMemo(() => {
    const hops = Math.max(0, path.length - 1);
    const last = latencies.length ? latencies[latencies.length - 1] : 0;
    const avg = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    return { hops, last, avg, elapsedMs, steps: latencies.length };
  }, [path, latencies, elapsedMs]);

  const pushLog = useCallback((entry) => {
    setLog((prev) => [...prev, { ...entry, at: Date.now() }]);
  }, []);

  const randomize = useCallback(async () => {
    setError("");
    try {
      const [a, b] = await getRandomArticles(2);
      setStart(a);
      setDest(b);
    } catch (err) {
      setError(String(err.message || err));
    }
  }, []);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const runRace = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("Add your TypeSafe (Jev) API key to start.");
      return;
    }
    if (!start.trim() || !dest.trim()) {
      setError("Pick a start and a destination article.");
      return;
    }

    stopRef.current = false;
    setPhase("running");
    setError("");
    setDecision(null);
    setHighlight(null);
    setLog([]);
    setLatencies([]);
    setElapsedMs(0);

    const goal = `find ${dest} starting with ${start}`;
    const destKey = titleKey(dest);
    const visited = [];
    const t0 = performance.now();

    try {
      let current = await getArticle(start);
      setArticle(current);
      setPath([current.title]);
      visited.push(titleKey(current.title));
      pushLog({ kind: "load", text: `Loaded ${current.title}` });

      if (titleKey(current.title) === destKey) {
        setPhase("won");
        pushLog({ kind: "win", text: `Start is already the destination.` });
        return;
      }

      for (let step = 1; step <= MAX_STEPS; step++) {
        if (stopRef.current) {
          setPhase("stopped");
          pushLog({ kind: "stop", text: "Stopped." });
          return;
        }

        const remaining = current.links.filter(
          (l) => !visited.includes(titleKey(l.title)),
        );
        if (!remaining.length) {
          setPhase("stuck");
          pushLog({ kind: "stuck", text: "No unused links to hop to." });
          return;
        }

        const result = await classify({
          apiKey: apiKey.trim(),
          goal,
          destination: dest,
          current,
          links: remaining,
          visited,
        });

        setDecision(result);
        setLatencies((prev) => [...prev, result.latencyMs]);
        setElapsedMs(Math.round(performance.now() - t0));
        setHighlight(result.chosen?.title || null);
        pushLog({
          kind: "decision",
          text: `${result.operation}${result.chosen ? ` → ${result.chosen.name}` : ""}`,
          latencyMs: result.latencyMs,
        });

        await sleep(WATCH_DELAY_MS);

        if (result.operation === "DONE") {
          if (titleKey(current.title) === destKey) {
            setPhase("won");
            return;
          }
          // Jev thinks it's done but the title doesn't match — keep hopping if it can.
        }

        if (!result.chosen) {
          setPhase("stuck");
          pushLog({ kind: "stuck", text: "Jev could not pick a link." });
          return;
        }

        const next = await getArticle(result.chosen.title);
        visited.push(titleKey(next.title));
        current = next;
        setArticle(next);
        setPath((prev) => [...prev, next.title]);
        setHighlight(null);
        setElapsedMs(Math.round(performance.now() - t0));

        if (titleKey(next.title) === destKey) {
          setPhase("won");
          pushLog({ kind: "win", text: `Reached ${next.title}!` });
          return;
        }
      }

      setPhase("stuck");
      pushLog({ kind: "stuck", text: `Hit ${MAX_STEPS} steps without arriving.` });
    } catch (err) {
      setError(String(err.message || err));
      setPhase("error");
      pushLog({ kind: "error", text: String(err.message || err) });
    }
  }, [apiKey, start, dest, pushLog]);

  const running = phase === "running";

  return (
    <div className="app">
      <Header />

      <Controls
        apiKey={apiKey}
        setApiKey={setApiKey}
        start={start}
        setStart={setStart}
        dest={dest}
        setDest={setDest}
        running={running}
        onStart={runRace}
        onStop={stop}
        onRandom={randomize}
      />

      {error ? <div className="banner error">{error}</div> : null}

      <PhaseBanner phase={phase} start={start} dest={dest} stats={stats} />

      <main className="stage">
        <BrowserPane article={article} highlightTitle={highlight} phase={phase} />
        <JevPanel
          decision={decision}
          destination={dest}
          path={path}
          stats={stats}
          log={log}
          phase={phase}
        />
      </main>

      <Sponsors />
    </div>
  );
}

function PhaseBanner({ phase, start, dest, stats }) {
  if (phase === "idle") return null;
  const map = {
    running: { cls: "running", text: `Racing "${start}" → "${dest}"…` },
    won: { cls: "won", text: `🏁 Reached "${dest}" in ${stats.hops} hops · ${stats.elapsedMs} ms` },
    stuck: { cls: "warn", text: `Stuck before reaching "${dest}". Try another target or Random.` },
    stopped: { cls: "warn", text: `Stopped after ${stats.hops} hops.` },
    error: { cls: "error", text: `Something went wrong.` },
  };
  const info = map[phase];
  if (!info) return null;
  return <div className={`banner ${info.cls}`}>{info.text}</div>;
}
