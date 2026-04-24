import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { BenchService } from "../../application/bench/bench.service";
import { functionBenchSchema, httpBenchSchema, benchFormatSchema } from "../validators/bench.validator";

export function createBenchRoutes(benchService: BenchService) {
  const app = new Hono();

  app.post("/run/function", async (c) => {
    const parsed = functionBenchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    return streamSSE(c, async (stream) => {
      try {
        const result = await benchService.runFunctionBench(parsed.data, async (progress) => {
          await stream.writeSSE({ event: "progress", data: JSON.stringify(progress) });
        });
        await stream.writeSSE({ event: "result", data: JSON.stringify(result) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: String(err) });
      }
    });
  });

  app.post("/run/http", async (c) => {
    const parsed = httpBenchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    return streamSSE(c, async (stream) => {
      try {
        const result = await benchService.runHttpBench(parsed.data, async (progress) => {
          await stream.writeSSE({ event: "progress", data: JSON.stringify(progress) });
        });
        await stream.writeSSE({ event: "result", data: JSON.stringify(result) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: String(err) });
      }
    });
  });

  app.post("/format", async (c) => {
    const parsed = benchFormatSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const markdown = benchService.formatResultAsMarkdown(parsed.data.result);
    return c.json({ data: { markdown } });
  });

  return app;
}
