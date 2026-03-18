import { Hono } from "hono";
import type { BookmarkService } from "../../application/bookmark/bookmark.service";
import { createBookmarkSchema, updateBookmarkSchema, createBookmarkTagSchema, updateBookmarkTagSchema, createBookmarkCategorySchema, updateBookmarkCategorySchema } from "../validators/bookmark.validator";

export function createBookmarkRoutes(service: BookmarkService) {
  const app = new Hono();

  // --- Tag routes (must be before /:id to avoid conflict) ---

  app.get("/tags", async (c) => {
    const tags = await service.getAllTags();
    return c.json({ data: tags });
  });

  app.post("/tags", async (c) => {
    const body = createBookmarkTagSchema.parse(await c.req.json());
    const tag = await service.createTag(body);
    return c.json({ data: tag }, 201);
  });

  app.put("/tags/:id", async (c) => {
    const body = updateBookmarkTagSchema.parse(await c.req.json());
    const tag = await service.updateTag(c.req.param("id"), body);
    if (!tag) return c.json({ error: "Tag not found" }, 404);
    return c.json({ data: tag });
  });

  app.delete("/tags/:id", async (c) => {
    const deleted = await service.deleteTag(c.req.param("id"));
    if (!deleted) return c.json({ error: "Tag not found" }, 404);
    return c.json({ data: { success: true } });
  });

  // --- Category routes (must be before /:id to avoid conflict) ---

  app.get("/categories", async (c) => {
    const categories = await service.getAllCategories();
    return c.json({ data: categories });
  });

  app.post("/categories", async (c) => {
    const body = createBookmarkCategorySchema.parse(await c.req.json());
    const category = await service.createCategory(body);
    return c.json({ data: category }, 201);
  });

  app.put("/categories/:id", async (c) => {
    const body = updateBookmarkCategorySchema.parse(await c.req.json());
    const category = await service.updateCategory(c.req.param("id"), body);
    if (!category) return c.json({ error: "Category not found" }, 404);
    return c.json({ data: category });
  });

  app.delete("/categories/:id", async (c) => {
    const deleted = await service.deleteCategory(c.req.param("id"));
    if (!deleted) return c.json({ error: "Category not found" }, 404);
    return c.json({ data: { success: true } });
  });

  // --- Bookmark routes ---

  app.get("/", async (c) => {
    const bookmarks = await service.getAll();
    return c.json({ data: bookmarks });
  });

  app.post("/", async (c) => {
    const body = createBookmarkSchema.parse(await c.req.json());
    const bookmark = await service.create(body);
    return c.json({ data: bookmark }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateBookmarkSchema.parse(await c.req.json());
    const bookmark = await service.update(c.req.param("id"), body);
    if (!bookmark) return c.json({ error: "Bookmark not found" }, 404);
    return c.json({ data: bookmark });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Bookmark not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}
