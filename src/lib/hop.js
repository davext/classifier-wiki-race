// Lightweight destination bias — only used to trim and order the candidate
// list before Jev makes the real decision. Jev does the picking, not this.

export function hopScore(link, dest = "") {
  const hay = `${link.name || ""} ${link.title || ""}`.toLowerCase();
  const tokens = String(dest || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);
  let score = 0;
  for (const token of tokens) if (hay.includes(token)) score += 8;
  if (/\b(history|ancient|war|empire|republic|kingdom|century|list of)\b/i.test(hay)) score += 1;
  return score;
}

export function orderCandidates(links, dest, max = 24) {
  return [...links].sort((a, b) => hopScore(b, dest) - hopScore(a, dest)).slice(0, max);
}
