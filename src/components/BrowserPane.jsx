import { useEffect, useRef } from "react";
import { titleKey } from "../lib/wikipedia.js";

export default function BrowserPane({ article, highlightTitle, phase }) {
  const contentRef = useRef(null);

  // Make embedded links inert (open in a new tab if clicked by a human).
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !article) return;
    el.scrollTop = 0;
    el.querySelectorAll("a[href^='/wiki/'], a[href^='./']").forEach((a) => {
      const href = a.getAttribute("href") || "";
      a.setAttribute("href", `https://en.wikipedia.org${href.replace(/^\.\//, "/wiki/")}`);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  }, [article]);

  // Highlight and scroll to the link Jev is about to click.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.querySelectorAll("a.race-target").forEach((a) => a.classList.remove("race-target"));
    if (!highlightTitle) return;

    const target = titleKey(highlightTitle);
    const links = [...el.querySelectorAll("a[href]")];
    const match = links.find((a) => {
      const href = a.getAttribute("href") || "";
      const path = href.replace(/^https:\/\/en\.wikipedia\.org/, "").replace(/^\.\//, "/wiki/");
      if (!/^\/wiki\//.test(path)) return false;
      const t = path.replace(/^\/wiki\//, "").split("#")[0];
      return titleKey(t) === target;
    });
    if (match) {
      match.classList.add("race-target");
      match.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightTitle, article]);

  return (
    <section className="pane browser-pane">
      <div className="browser-chrome">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="urlbar">
          {article ? article.url : "about:blank"}
          {phase === "running" ? <span className="live-dot" title="live" /> : null}
        </div>
      </div>

      <div className="viewport">
        {article ? (
          <article
            className="wiki-content"
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: article.html }}
          />
        ) : (
          <div className="empty-view">
            <p className="big">🏁</p>
            <p>Enter your key, pick a start &amp; destination, and press Start.</p>
            <p className="muted">
              The classifier drives this pane in real time — every hop is a live Wikipedia page.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
