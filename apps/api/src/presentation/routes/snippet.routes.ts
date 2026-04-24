import { Hono } from "hono";
import type { SnippetService } from "../../application/snippet/snippet.service";
import { createSnippetSchema, updateSnippetSchema } from "../validators/snippet.validator";

export function createSnippetRoutes(service: SnippetService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const tag = c.req.query("tag");
    const language = c.req.query("language");
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");

    const snippets = await service.getAll({
      tag: tag || undefined,
      language: language || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
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
