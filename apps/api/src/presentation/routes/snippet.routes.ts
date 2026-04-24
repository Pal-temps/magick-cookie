import { Hono } from "hono";
import { z } from "zod";
import type { SnippetService } from "../../application/snippet/snippet.service";
import { createSnippetSchema, updateSnippetSchema } from "../validators/snippet.validator";

// Optional limit/offset (unlike paginationSchema, no default — undefined means "no limit" in repo).
const optionalPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function createSnippetRoutes(service: SnippetService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const parsed = optionalPaginationSchema.safeParse({
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const snippets = await service.getAll({
      tag: c.req.query("tag") || undefined,
      language: c.req.query("language") || undefined,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return c.json({ data: snippets });
  });

  app.post("/", async (c) => {
    const body = createSnippetSchema.parse(await c.req.json());
    const snippet = await service.create(body);
    return c.json({ data: snippet }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateSnippetSchema.parse(await c.req.json());
    const snippet = await service.update(c.req.param("id"), body);
    if (!snippet) return c.json({ error: "Snippet not found" }, 404);
    return c.json({ data: snippet });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Snippet not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}
