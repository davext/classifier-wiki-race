import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/**
 * Dev-only mirror of the Hono worker's /api/systemone pass-through, so
 * `npm run dev` behaves exactly like production without running wrangler.
 */
function typeSafeDevProxy() {
  return {
    name: "typesafe-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/systemone", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end("Method Not Allowed");
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const upstream = await fetch(TYPESAFE_ENDPOINT, {
              method: "POST",
              headers: {
                Authorization: req.headers["authorization"] || "",
                "Content-Type": "application/json",
              },
              body,
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(text);
          } catch (err) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), typeSafeDevProxy()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
