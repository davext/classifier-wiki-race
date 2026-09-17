import { useCallback, useMemo, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Controls from "./components/Controls.jsx";
import BrowserPane from "./components/BrowserPane.jsx";
import JevPanel from "./components/JevPanel.jsx";
import Sponsors from "./components/Sponsors.jsx";
import {
  getArticle,
  getRandomValidatedArticle,
  titleKey,
} from "./lib/wikipedia.js";
import { hopScore } from "./lib/hop.js";
import { classify } from "./lib/jev.js";

const MAX_STEPS = 45;
const WATCH_DELAY_MS = 750;

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
  const [startBusy, setStartBusy] = useState(false);
  const [destBusy, setDestBusy] = useState(false);

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

  const randomizeField = useCallback(async (which) => {
    setError("");
    const setBusy = which === "start" ? setStartBusy : setDestBusy;
    const setVal = which === "start" ? setStart : setDest;
    setBusy(true);
    try {
      const found = await getRandomValidatedArticle();
      setVal(found.title);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }, []);

  const randomizeBoth = useCallback(async () => {
    setError("");
    setStartBusy(true);
    setDestBusy(true);
    try {
      const [a, b] = await Promise.all([
        getRandomValidatedArticle(),
        getRandomValidatedArticle(),
      ]);
      setStart(a.title);
      setDest(b.title);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setStartBusy(false);
      setDestBusy(false);
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
    const visited = new Set();
    const trail = []; // stack of articles for backtracking
    const t0 = performance.now();

    try {
      // Resolve the destination's canonical title up front so redirects still
      // count as a win (e.g. "POM Wonderful" → its real article title).
      let destKey = titleKey(dest);
      try {
        const destArticle = await getArticle(dest);
        destKey = titleKey(destArticle.title);
      } catch {
        pushLog({ kind: "warn", text: `Couldn't pre-load "${dest}" — matching on name.` });
      }

      let current = await getArticle(start);
      setArticle(current);
      setPath([current.title]);
      visited.add(titleKey(current.title));
      trail.push(current);
      pushLog({ kind: "load", text: `Loaded ${current.title}` });

      if (titleKey(current.title) === destKey) {
        setPhase("won");
        pushLog({ kind: "win", text: "Start is already the destination." });
        return;
      }

      for (let step = 1; step <= MAX_STEPS; step++) {
        if (stopRef.current) {
          setPhase("stopped");
          pushLog({ kind: "stop", text: "Stopped." });
          return;
        }

        const remaining = current.links.filter((l) => !visited.has(titleKey(l.title)));

        // Dead end → backtrack to the most recent article that still has options.
        if (!remaining.length) {
          trail.pop();
          if (!trail.length) {
            setPhase("stuck");
            pushLog({ kind: "stuck", text: "Backtracked to the start — no path found." });
            return;
          }
          current = trail[trail.length - 1];
          setArticle(current);
          setHighlight(null);
          pushLog({ kind: "back", text: `↩ Backtracked to ${current.title}` });
          await sleep(WATCH_DELAY_MS);
          continue;
        }

        const result = await classify({
          apiKey: apiKey.trim(),
          goal,
          destination: dest,
          current,
          links: remaining,
          visited: [...visited],
        });

        setDecision(result);
        setLatencies((prev) => [...prev, result.latencyMs]);
        setElapsedMs(Math.round(performance.now() - t0));

        // Jev is the decider. If it clicks, take that link. If it says DONE at
        // the destination we win; otherwise (BLOCKED / no pick) we don't give
        // up while unused links exist — we take the strongest bridge instead.
        let chosen = result.chosen;
        let forced = false;

        if (result.operation === "DONE" && titleKey(current.title) === destKey) {
          setHighlight(null);
          setPhase("won");
          pushLog({ kind: "win", text: `Reached ${current.title}!` });
          return;
        }

        if (!chosen) {
          chosen = [...remaining].sort((a, b) => hopScore(b, dest) - hopScore(a, dest))[0];
          forced = Boolean(chosen);
        }

        setHighlight(chosen ? chosen.title : null);
        pushLog({
          kind: "decision",
          text: `${result.operation}${chosen ? ` → ${chosen.name}` : ""}${forced ? " (bridge)" : ""}`,
          latencyMs: result.latencyMs,
        });

        await sleep(WATCH_DELAY_MS);

        if (!chosen) {
          // Nothing to click and Jev didn't help — backtrack.
          trail.pop();
          if (!trail.length) {
            setPhase("stuck");
            pushLog({ kind: "stuck", text: "No link to take and nowhere to backtrack." });
            return;
          }
          current = trail[trail.length - 1];
          setArticle(current);
          setHighlight(null);
          continue;
        }

        const next = await getArticle(chosen.title);
        visited.add(titleKey(next.title));
        current = next;
        trail.push(next);
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
        startBusy={startBusy}
        destBusy={destBusy}
        onStart={runRace}
        onStop={stop}
        onRandom={randomizeBoth}
        onRandomStart={() => randomizeField("start")}
        onRandomDest={() => randomizeField("dest")}
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
    stuck: {
      cls: "warn",
      text: `Couldn't reach "${dest}" within ${45} steps. Try 🎲 for a better-connected target.`,
    },
    stopped: { cls: "warn", text: `Stopped after ${stats.hops} hops.` },
    error: { cls: "error", text: `Something went wrong.` },
  };
  const info = map[phase];
  if (!info) return null;
  return <div className={`banner ${info.cls}`}>{info.text}</div>;
}
