import { Hono } from "hono";
import type { ContactService } from "../../application/contact/contact.service";
import { createContactSchema, updateContactSchema } from "../validators/contact.validator";

export function createContactRoutes(service: ContactService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const contacts = await service.getAll();
    return c.json({ data: contacts });
  });

  app.get("/:id", async (c) => {
    const contact = await service.getById(c.req.param("id"));
    if (!contact) return c.json({ error: "Contact not found" }, 404);
    return c.json({ data: contact });
  });

  app.post("/", async (c) => {
    const body = createContactSchema.parse(await c.req.json());
    const contact = await service.create(body);
    return c.json({ data: contact }, 201);
  });

  app.put("/:id", async (c) => {
    const body = updateContactSchema.parse(await c.req.json());
    const contact = await service.update(c.req.param("id"), body);
    if (!contact) return c.json({ error: "Contact not found" }, 404);
    return c.json({ data: contact });
  });

  app.delete("/:id", async (c) => {
    const deleted = await service.delete(c.req.param("id"));
    if (!deleted) return c.json({ error: "Contact not found" }, 404);
    return c.json({ data: { success: true } });
  });

  return app;
}
