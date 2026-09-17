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

export async function getRandomArticles(n = 2) {
  const url = `${API}?action=query&list=random&rnnamespace=0&rnlimit=${n}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia random failed (${res.status})`);
  const data = await res.json();
  return (data.query?.random || []).map((r) => r.title);
}

/**
 * Pick a random article AND confirm it actually loads with enough outgoing
 * links to be raceable. Returns the fully-fetched article so the caller can
 * reuse it without a second request.
 */
export async function getRandomValidatedArticle({ minLinks = 5, maxTries = 6 } = {}) {
  let lastError;
  for (let i = 0; i < maxTries; i++) {
    let title;
    try {
      [title] = await getRandomArticles(1);
      const article = await getArticle(title);
      if (article.links.length >= minLinks) return article;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    lastError ? `Couldn't fetch a random article: ${lastError.message}` : "Couldn't fetch a well-linked random article — try again.",
  );
}

const SKIP_HREF =
  /\/wiki\/(File|Image|Help|Wikipedia|Template|Talk|Category|Portal|Module|Special|Draft|Book|MediaWiki|TimedText|Template_talk|User):|redlink=1|action=edit/i;

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
