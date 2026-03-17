import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { VpsProxyService } from "../../application/vps/vps-proxy.service";

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
    const filename = c.req.param("filename");
    const query: Record<string, string> = {};
    const lines = c.req.query("lines");
    const level = c.req.query("level");
    const search = c.req.query("search");
    if (lines) query.lines = lines;
    if (level) query.level = level;
    if (search) query.search = search;
    const res = await vpsProxy.proxy(`/monitoring/logs/${filename}`, { query });
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
    const files = c.req.query("files");
    const level = c.req.query("level");
    const query: Record<string, string> = {};
    if (files) query.files = files;
    if (level) query.level = level;

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
