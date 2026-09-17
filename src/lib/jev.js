import { orderCandidates } from "./hop.js";

// Instructions are the only free text that reaches the model. IDs and elements
// stay structured. This mirrors the fast-browser "hop mode" rules.
export const HOP_ACTION = `You are racing between Wikipedia articles by clicking links only.
Never search, never type. The destination is the article named in the goal.
Get there by hopping, choosing the link that is the biggest step toward the destination — even if early hops are only slightly closer.
Places, countries, cities, people, years, civilizations, wars and historical topics are good bridges.
Avoid citations, files, navigation, and already-visited pages.
CLICK unless the current article already IS the destination (then DONE), or no unused link can get closer (then BLOCKED).`;

export const HOP_TARGET = `Assume the next operation is CLICK.
Choose the single offered link that moves closest to the destination article.
Do not choose an already-visited page. Choose only an offered element index, or "none".`;

/**
 * One classifier step. Builds the TypeSafe System One request, sends it through
 * our stateless /api/systemone pass-through, and returns the decision plus the
 * exact request/response so the overlay can show what Jev saw and answered.
 */
export async function classify({ apiKey, goal, destination, current, links, visited }) {
  const candidates = orderCandidates(links, destination, 24);

  const targetCriteria = {};
  for (const link of candidates) {
    targetCriteria[link.ref] = {
      element: `[${link.ref}] link "${link.name}"`,
      article: link.title,
    };
  }
  targetCriteria.none = "No offered link gets closer to the destination.";

  const operations = {
    CLICK: "Hop to the article link that is closest to the destination.",
    DONE: "The current article is the destination.",
    BLOCKED: "No unused article link can get closer to the destination.",
  };

  const state = {
    page: { url: current.url, title: current.title },
    destination,
    visited_articles: visited.slice(-12),
    elements: candidates.map((l) => ({ index: l.ref, label: l.name, article: l.title })),
  };

  const questions = {
    operation: {
      type: "choice",
      instructions: { goal, destination, current_article: current.title, rules: HOP_ACTION },
      criteria: operations,
    },
    click_target: {
      type: "choice",
      instructions: { goal, destination, operation: "CLICK", rules: [HOP_ACTION, HOP_TARGET] },
      criteria: targetCriteria,
    },
  };

  const requestBody = { model: "jev-latest", state, questions };

  const started = performance.now();
  const res = await fetch("/api/systemone", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  const latencyMs = Math.round(performance.now() - started);

  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 300);
    try {
      message = JSON.parse(text).error || message;
    } catch {
      /* keep raw */
    }
    throw new Error(`TypeSafe ${res.status}: ${message}`);
  }

  const result = JSON.parse(text);
  const opAnswer = result.answers?.operation || {};
  const targetAnswer = result.answers?.click_target || {};

  const operation = opAnswer.choice || "BLOCKED";
  let ref = targetAnswer.choice;
  if (ref === "none") ref = undefined;
  const chosen = candidates.find((l) => l.ref === ref) || null;

  return {
    operation,
    chosen,
    ref,
    operationProbabilities: opAnswer.probabilities || {},
    operationConfidence: opAnswer.confidence,
    targetProbabilities: targetAnswer.probabilities || {},
    targetConfidence: targetAnswer.confidence,
    model: result.model || "jev-latest",
    usage: result.usage || null,
    latencyMs,
    candidates,
    requestBody,
    responseBody: result,
  };
}
