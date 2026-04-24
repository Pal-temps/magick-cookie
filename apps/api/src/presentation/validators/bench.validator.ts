import { z } from "zod";

export const functionBenchSchema = z.object({
  code: z.string().min(1).max(100_000),
  name: z.string().min(1).max(255),
  iterations: z.number().int().min(1).max(10_000_000).default(1000),
  warmup: z.number().int().min(0).max(1_000_000).default(100),
  timeoutMs: z.number().int().min(1).max(300_000).default(5000),
});

export const httpBenchSchema = z.object({
  url: z.string().url().max(2000),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.string().max(100_000).optional(),
  concurrency: z.number().int().min(1).max(1000).default(10),
  durationMs: z.number().int().min(100).max(600_000).optional(),
  totalRequests: z.number().int().min(1).max(1_000_000).default(100),
  timeoutMs: z.number().int().min(1).max(120_000).default(5000),
});

export const benchFormatSchema = z.object({
  result: z.any(),
});
