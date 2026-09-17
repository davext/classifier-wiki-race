import { Hono } from "hono";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

const app = new Hono();

/**
 * Stateless pass-through for TypeSafe System One (Jev).
 *
 * The browser sends the player's API key with each request. We forward that
 * single request straight to TypeSafe and stream the answer back. Nothing is
 * stored, logged, cached, or persisted — the key exists only for the lifetime
 * of this fetch. This exists purely because TypeSafe does not send CORS headers,
 * so the browser cannot call it directly.
 */
app.post("/api/systemone", async (c) => {
  const auth = c.req.header("authorization") || "";
  if (!auth) {
    return c.json({ error: "Missing Authorization header (your Jev API key)." }, 401);
  }
  const body = await c.req.text();

  let upstream;
  try {
    upstream = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (err) {
    return c.json({ error: `Could not reach TypeSafe: ${String(err)}` }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});

app.get("/api/health", (c) => c.json({ ok: true }));

// Everything else is the static React app (served by Workers Assets, SPA mode).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
