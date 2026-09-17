// Candidate selection helpers. Jev makes the real decision — this only decides
// which links survive into the (capped) choice set, so it must NOT drop links
// that are geographically/topically relevant to the destination.

const STOP = new Set([
  "the",
  "and",
  "from",
  "with",
  "list",
  "lists",
  "county",
  "counties",
  "state",
  "states",
  "united",
  "national",
  "history",
  "born",
  "created",
  "town",
  "city",
  "area",
  "people",
  "who",
  "was",
  "were",
  "for",
  "near",
]);

/**
 * Pull distinctive keywords from the destination title + summary: proper nouns
 * (Sherman, Connecticut, New York) and other significant words. These are what
 * we use to keep relevant bridge links in the candidate set.
 */
export function destinationKeywords(destination, summary = "") {
  const keywords = new Set();

  const proper = `${destination}\n${summary}`.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g) || [];
  for (const phrase of proper) {
    const p = phrase.toLowerCase();
    if (p.length > 2 && !STOP.has(p)) keywords.add(p);
    for (const w of p.split(/\s+/)) {
      if (w.length > 3 && !STOP.has(w)) keywords.add(w);
    }
  }
  for (const w of `${destination} ${summary}`.toLowerCase().split(/\W+/)) {
    if (w.length > 4 && !STOP.has(w)) keywords.add(w);
  }
  return [...keywords];
}

export function hopScore(link, keywords = []) {
  const hay = `${link.name || ""} ${link.title || ""}`.toLowerCase();
  let score = 0;
  for (const k of keywords) {
    if (!k) continue;
    if (hay.includes(k)) score += k.length > 6 ? 5 : 3;
  }
  return score;
}

/**
 * Keep every link that matches a destination keyword, then fill the rest of the
 * budget with the remaining links in page order (breadth), capped so the choice
 * set stays a reasonable size for the classifier.
 */
export function orderCandidates(links, keywords = [], max = 28) {
  const scored = links.map((l) => ({ l, s: hopScore(l, keywords) }));
  const matched = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.l);
  const rest = scored.filter((x) => x.s === 0).map((x) => x.l);
  return [...matched, ...rest].slice(0, max);
}
