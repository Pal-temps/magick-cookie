import { Hono } from "hono";
import type { SnippetService } from "../../application/snippet/snippet.service";
import { createSnippetSchema, updateSnippetSchema, createSnippetCategorySchema, updateSnippetCategorySchema } from "../validators/snippet.validator";

export function createSnippetRoutes(service: SnippetService) {
  const app = new Hono();

  // --- Category routes (must be before /:id to avoid conflict) ---

  app.get("/categories", async (c) => {
    const categories = await service.getAllCategories();
    return c.json({ data: categories });
  });

  app.post("/categories", async (c) => {
    const body = createSnippetCategorySchema.parse(await c.req.json());
    const category = await service.createCategory(body);
    return c.json({ data: category }, 201);
  });

  app.put("/categories/:id", async (c) => {
    const body = updateSnippetCategorySchema.parse(await c.req.json());
    const category = await service.updateCategory(c.req.param("id"), body);
    if (!category) return c.json({ error: "Category not found" }, 404);
    return c.json({ data: category });
  });

  app.delete("/categories/:id", async (c) => {
    const deleted = await service.deleteCategory(c.req.param("id"));
    if (!deleted) return c.json({ error: "Category not found" }, 404);
    return c.json({ data: { success: true } });
  });

  // --- Snippet routes ---

  app.get("/", async (c) => {
    const category = c.req.query("category");
    const language = c.req.query("language");
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");

    const snippets = await service.getAll({
      category: category || undefined,
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
