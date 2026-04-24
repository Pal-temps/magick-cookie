import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { VpsProxyService } from "../../application/vps/vps-proxy.service";

// VPS log files are addressed by the remote monitoring API, but the filename segment is placed
// into a URL path we build ourselves — anything containing "/", "..", or control chars would let
// the caller escape the `/monitoring/logs/` prefix.
const logFilenameSchema = z.string().regex(/^[a-zA-Z0-9._-]{1,128}$/);
const logQuerySchema = z.object({
  lines: z.coerce.number().int().min(1).max(100_000).optional(),
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
  search: z.string().max(500).optional(),
});
const streamQuerySchema = z.object({
  files: z.string().max(500).optional(),
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export function createVpsRoutes(vpsProxy: VpsProxyService) {
  const app = new Hono();

  // GET /health → proxy to /monitoring/health
  app.get("/health", async (c) => {
    const res = await vpsProxy.proxy("/monitoring/health");
    const data = await res.json();
    return c.json({ data });
  });

  // GET /logs → proxy to /monitoring/logs
  app.get("/logs", async (c) => {
    const res = await vpsProxy.proxy("/monitoring/logs");
    const data = await res.json();
    return c.json({ data });
  });

  // GET /logs/:filename → proxy to /monitoring/logs/:filename with query params
  app.get("/logs/:filename", async (c) => {
    const filenameParsed = logFilenameSchema.safeParse(c.req.param("filename"));
    if (!filenameParsed.success) return c.json({ error: "Invalid filename" }, 400);

    const queryParsed = logQuerySchema.safeParse({
      lines: c.req.query("lines"),
      level: c.req.query("level"),
      search: c.req.query("search"),
    });
    if (!queryParsed.success) return c.json({ error: queryParsed.error.flatten() }, 400);

    const query: Record<string, string> = {};
    if (queryParsed.data.lines !== undefined) query.lines = String(queryParsed.data.lines);
    if (queryParsed.data.level) query.level = queryParsed.data.level;
    if (queryParsed.data.search) query.search = queryParsed.data.search;

    const res = await vpsProxy.proxy(`/monitoring/logs/${encodeURIComponent(filenameParsed.data)}`, { query });
    const data = await res.json();
    return c.json({ data });
  });

  // DELETE /logs → proxy to /monitoring/logs
  app.delete("/logs", async (c) => {
    const res = await vpsProxy.proxy("/monitoring/logs", { method: "DELETE" });
    const data = await res.json();
    return c.json({ data });
  });

  // GET /alerts → proxy to /monitoring/alerts
  app.get("/alerts", async (c) => {
    const res = await vpsProxy.proxy("/monitoring/alerts");
    const data = await res.json();
    return c.json({ data });
  });

  // GET /stream → SSE proxy
  // This opens an SSE connection to the VPS and relays events to the client
  app.get("/stream", async (c) => {
    const parsed = streamQuerySchema.safeParse({
      files: c.req.query("files"),
      level: c.req.query("level"),
    });
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const query: Record<string, string> = {};
    if (parsed.data.files) query.files = parsed.data.files;
    if (parsed.data.level) query.level = parsed.data.level;

    return streamSSE(c, async (stream) => {
      let aborted = false;

      stream.onAbort(() => {
        aborted = true;
      });

      try {
        const body = await vpsProxy.streamProxy("/monitoring/stream", query);
        if (!body) {
          await stream.writeSSE({ event: "error", data: "Failed to connect to VPS" });
          return;
        }

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line

          let currentEvent = "";
          let currentData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            } else if (line === "" && currentEvent) {
              // End of SSE event — relay it
              try {
                await stream.writeSSE({ event: currentEvent, data: currentData });
              } catch {
                aborted = true;
                break;
              }
              currentEvent = "";
              currentData = "";
            }
          }
        }

        reader.cancel();
      } catch (err) {
        if (!aborted) {
          try {
            await stream.writeSSE({ event: "error", data: "VPS connection lost" });
          } catch {}
        }
      }
    });
  });

  return app;
}
