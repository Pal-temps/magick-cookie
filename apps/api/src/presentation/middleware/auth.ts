import type { MiddlewareHandler } from "hono";
import { timingSafeEqual } from "crypto";
import { config } from "../../config";

// Routes that stay public regardless of auth state:
// - /api/health : readiness probe
// - /api/webhooks/:id/receive : external senders authenticate with per-webhook secret
// - /api/sse : server-sent events (auth enforced via the subscription request, not headers)
const PUBLIC_PATHS = [
  /^\/api\/health$/,
  /^\/api\/webhooks\/[^/]+\/receive$/,
  /^\/api\/sse(\/|$)/,
];

function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Bearer-token auth applied to /api/*.
// If API_AUTH_TOKEN is unset, the middleware is a no-op — suitable for local-only usage where the
// API is bound to loopback. Whenever the server is exposed (VPS / reverse proxy), set the env var
// and every non-public route will require `Authorization: Bearer <token>`.
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const expected = config.apiAuthToken;
  if (!expected) return next();

  const path = c.req.path;
  if (PUBLIC_PATHS.some((re) => re.test(path))) return next();

  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !tokensMatch(expected, match[1].trim())) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
};
