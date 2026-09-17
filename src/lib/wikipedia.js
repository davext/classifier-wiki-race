// All Wikipedia calls go straight from the browser. The MediaWiki API sends
// `access-control-allow-origin: *`, so no proxy is needed here.

const API = "https://en.wikipedia.org/w/api.php";

export function normalizeTitle(t) {
  return decodeURIComponent(String(t || ""))
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleKey(t) {
  return normalizeTitle(t).toLowerCase();
}

export function articleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(normalizeTitle(title).replace(/ /g, "_"))}`;
}

/**
 * Accept either a plain title ("Sulla") or a full/partial Wikipedia URL
 * ("https://en.wikipedia.org/wiki/Sulla", "en.m.wikipedia.org/wiki/Sulla",
 * "/wiki/Sulla") and return the clean article title.
 */
export function parseTitleInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const inUrl = raw.match(/wikipedia\.org\/wiki\/([^?#]+)/i);
  if (inUrl) return normalizeTitle(inUrl[1]);
  const bareWiki = raw.match(/^\/?wiki\/([^?#]+)/i);
  if (bareWiki) return normalizeTitle(bareWiki[1]);
  return normalizeTitle(raw);
}

/**
 * How many articles link TO this one (a strong proxy for how reachable it is
 * in a race). Capped — we only need to know it clears a threshold.
 */
export async function getBacklinkCount(title, limit = 60) {
  const url = `${API}?action=query&list=backlinks&bltitle=${encodeURIComponent(
    title,
  )}&blnamespace=0&blfilterredir=all&bllimit=${limit}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const data = await res.json();
  return (data.query?.backlinks || []).length;
}

export async function getRandomArticles(n = 2) {
  const url = `${API}?action=query&list=random&rnnamespace=0&rnlimit=${n}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia random failed (${res.status})`);
  const data = await res.json();
  return (data.query?.random || []).map((r) => r.title);
}

/**
 * Pick a random article that is actually raceable and keep re-rolling until one
 * qualifies. We insist on a well-connected "hub": lots of outgoing links (ways
 * to leave) AND lots of incoming links (ways to be reached). Requiring this of
 * BOTH endpoints is what makes random pairs land — obscure, isolated pages like
 * "728 Naval Air Squadron" or a little-linked biography get re-rolled away.
 * Destinations demand a bit more reachability. Returns the fetched article.
 */
export async function getRandomValidatedArticle({
  role = "start",
  minLinks = 15,
  minBacklinks = role === "dest" ? 60 : 40,
  maxTries = 20,
} = {}) {
  let lastError;
  for (let i = 0; i < maxTries; i++) {
    try {
      const [title] = await getRandomArticles(1);
      const article = await getArticle(title);
      if (article.links.length < minLinks) continue; // too few ways out
      const backlinks = await getBacklinkCount(article.title, minBacklinks + 5);
      if (backlinks < minBacklinks) continue; // too hard to reach / too obscure
      return article;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    lastError
      ? `Couldn't fetch a well-connected random article: ${lastError.message}`
      : "Couldn't find a well-connected random article — try 🎲 again.",
  );
}

/**
 * Produce a start/destination pair that is GUARANTEED to be connected: start
 * from a random hub, then random-walk along real article links a few hops and
 * use a hub we land on as the destination. Since we literally walked the path,
 * a route exists — and because linked articles are topically related, the two
 * ends share a thread the classifier can follow. This is what makes "Random
 * both" reliably raceable instead of pairing two unrelated islands.
 */
export async function getReachableRandomPair({
  minHops = 3,
  maxHops = 6,
  minBacklinks = 50,
} = {}) {
  const start = await getRandomValidatedArticle({ role: "start" });
  const visited = new Set([titleKey(start.title)]);
  let current = start;
  let dest = null;
  const target = minHops + Math.floor(Math.random() * (maxHops - minHops + 1));

  for (let hop = 1; hop <= maxHops; hop++) {
    const options = current.links.filter((l) => !visited.has(titleKey(l.title)));
    let next = null;
    for (let attempt = 0; attempt < 6 && options.length; attempt++) {
      const idx = Math.floor(Math.random() * options.length);
      const [pick] = options.splice(idx, 1);
      try {
        const article = await getArticle(pick.title);
        if (article.links.length >= 12 && !visited.has(titleKey(article.title))) {
          next = article;
          break;
        }
      } catch {
        /* skip unreachable link, try another */
      }
    }
    if (!next) break;
    visited.add(titleKey(next.title));
    current = next;
    if (hop >= target) {
      const backlinks = await getBacklinkCount(current.title, minBacklinks + 5);
      if (backlinks >= minBacklinks) {
        dest = current;
        break;
      }
    }
  }

  if (!dest) dest = current;
  if (titleKey(dest.title) === titleKey(start.title)) {
    throw new Error("Random walk didn't move — try 🎲 again.");
  }
  return { start, dest };
}

const SKIP_HREF =
  /\/wiki\/(File|Image|Help|Wikipedia|Template|Talk|Category|Portal|Module|Special|Draft|Book|MediaWiki|TimedText|Template_talk|User):|redlink=1|action=edit/i;

/**
 * Short intro extract for an article — used to ground the classifier on what
 * the destination actually is (its place, subject, category).
 */
export async function getSummary(title, maxChars = 320) {
  const url = `${API}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(
    title,
  )}`;
  const res = await fetch(url);
  if (!res.ok) return "";
  const data = await res.json();
  const pages = data.query?.pages || {};
  const first = Object.values(pages)[0];
  const extract = (first?.extract || "").replace(/\s+/g, " ").trim();
  if (!extract) return "";
  return extract.length > maxChars ? `${extract.slice(0, maxChars).trim()}…` : extract;
}

/**
 * Fetch a rendered article, return its HTML plus the list of body links that
 * count as valid hops (article namespace, no chrome / citations / files).
 */
export async function getArticle(title) {
  const url = `${API}?action=parse&page=${encodeURIComponent(
    title,
  )}&prop=text|displaytitle&redirects=1&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia parse failed (${res.status})`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.info || "Article not found");

  const parsed = data.parse;
  const html = parsed.text["*"];
  const resolvedTitle = normalizeTitle(parsed.title);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector(".mw-parser-output") || doc.body;

  // Drop non-article chrome so hops come from real prose, not infoboxes/nav.
  root
    .querySelectorAll(
      ".navbox, .infobox, .sidebar, .reflist, .references, .metadata, .mw-editsection, .hatnote, .thumb, .gallery, table, sup.reference, style",
    )
    .forEach((el) => el.remove());

  const links = [];
  const seen = new Set();
  root.querySelectorAll("a[href]").forEach((a) => {
    let href = a.getAttribute("href") || "";
    href = href.replace(/^\.\//, "/wiki/");
    if (!/^\/wiki\//.test(href)) return;
    if (SKIP_HREF.test(href)) return;
    if (href.startsWith("#")) return;

    const raw = href.replace(/^\/wiki\//, "").split("#")[0];
    const target = normalizeTitle(raw);
    const key = titleKey(target);
    if (!target || seen.has(key)) return;

    const name = (a.textContent || target).trim().replace(/\s+/g, " ");
    if (!name || name.length > 90) return;

    seen.add(key);
    links.push({
      ref: `e${links.length + 1}`,
      name,
      title: target,
      href: `/wiki/${raw}`,
    });
  });

  return {
    title: resolvedTitle,
    url: articleUrl(resolvedTitle),
    html,
    links,
  };
}
