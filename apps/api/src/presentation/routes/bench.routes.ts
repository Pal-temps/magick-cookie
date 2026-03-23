import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { BenchService } from "../../application/bench/bench.service";
import type { FunctionBenchConfig, HttpBenchConfig } from "../../domain/bench/bench.types";

export function createBenchRoutes(benchService: BenchService) {
  const app = new Hono();

  // POST /run/function — SSE streaming progress + result
  app.post("/run/function", async (c) => {
    const body = await c.req.json<FunctionBenchConfig>();

    if (!body.code || !body.name) {
      return c.json({ error: "code and name are required" }, 400);
    }

    const config: FunctionBenchConfig = {
      code: body.code,
      name: body.name,
      iterations: body.iterations ?? 1000,
      warmup: body.warmup ?? 100,
      timeoutMs: body.timeoutMs ?? 5000,
    };

    return streamSSE(c, async (stream) => {
      try {
        const result = await benchService.runFunctionBench(config, async (progress) => {
          await stream.writeSSE({ event: "progress", data: JSON.stringify(progress) });
        });
        await stream.writeSSE({ event: "result", data: JSON.stringify(result) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: String(err) });
      }
    });
  });

  // POST /run/http — SSE streaming progress + result
  app.post("/run/http", async (c) => {
    const body = await c.req.json<HttpBenchConfig>();

    if (!body.url) {
      return c.json({ error: "url is required" }, 400);
    }

    const config: HttpBenchConfig = {
      url: body.url,
      method: body.method ?? "GET",
      headers: body.headers,
      body: body.body,
      concurrency: body.concurrency ?? 10,
      durationMs: body.durationMs,
      totalRequests: body.totalRequests ?? 100,
      timeoutMs: body.timeoutMs ?? 5000,
    };

    return streamSSE(c, async (stream) => {
      try {
        const result = await benchService.runHttpBench(config, async (progress) => {
          await stream.writeSSE({ event: "progress", data: JSON.stringify(progress) });
        });
        await stream.writeSSE({ event: "result", data: JSON.stringify(result) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: String(err) });
      }
    });
  });

  // POST /format — format result as markdown
  app.post("/format", async (c) => {
    const { result } = await c.req.json<{ result: any }>();
    const markdown = benchService.formatResultAsMarkdown(result);
    return c.json({ data: { markdown } });
  });

  return app;
}
