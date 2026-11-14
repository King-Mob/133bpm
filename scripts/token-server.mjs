// Local dev token server: mimics the netlify function at /api/token so the
// app works under `npm run dev` without netlify-cli. Reads the same .env.
// Usage: node scripts/token-server.mjs [port]
import http from "node:http";
import { readFileSync } from "node:fs";
import { AccessToken } from "livekit-server-sdk";

// Tiny .env loader (no dotenv dependency)
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const port = Number(process.argv[2] ?? 8787);
const ROOM_NAME = "best-party-moments";

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (url.pathname !== "/api/token") {
      res.writeHead(404).end();
      return;
    }
    const room = url.searchParams.get("room") ?? ROOM_NAME;
    const identity = url.searchParams.get("identity");
    const name = url.searchParams.get("name") ?? identity;
    if (!identity) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "identity required" }));
      return;
    }
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity,
      name: name || identity,
      ttl: "4h",
    });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ token: await at.toJwt() }));
  })
  .listen(port, () => console.log(`token server on :${port}`));
