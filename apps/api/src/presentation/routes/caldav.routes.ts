import { Hono } from "hono";
import type { CalDavService } from "../../application/caldav/caldav.service";
import {
  createCalDavAccountSchema,
  updateCalDavAccountSchema,
} from "../validators/caldav.validator";

export function createCalDavAccountRoutes(caldavService: CalDavService) {
  const app = new Hono();

  // GET /api/caldav-accounts
  app.get("/", async (c) => {
    const data = await caldavService.getAccounts();
    return c.json({ data });
  });

  // GET /api/caldav-accounts/:id
  app.get("/:id", async (c) => {
    const data = await caldavService.getAccountById(c.req.param("id"));
    if (!data) return c.json({ error: "CalDAV account not found" }, 404);
    return c.json({ data });
  });

  // POST /api/caldav-accounts
  app.post("/", async (c) => {
    const input = createCalDavAccountSchema.parse(await c.req.json());
    const data = await caldavService.createAccount(input);
    return c.json({ data }, 201);
  });

  // PUT /api/caldav-accounts/:id
  app.put("/:id", async (c) => {
    const input = updateCalDavAccountSchema.parse(await c.req.json());
    const data = await caldavService.updateAccount(c.req.param("id"), input);
    if (!data) return c.json({ error: "CalDAV account not found" }, 404);
    return c.json({ data });
  });

  // DELETE /api/caldav-accounts/:id
  app.delete("/:id", async (c) => {
    const deleted = await caldavService.deleteAccount(c.req.param("id"));
    if (!deleted) return c.json({ error: "CalDAV account not found" }, 404);
    return c.json({ data: { ok: true } });
  });

  // POST /api/caldav-accounts/:id/sync
  app.post("/:id/sync", async (c) => {
    const result = await caldavService.syncAccount(c.req.param("id"));
    return c.json({ data: result });
  });

  // POST /api/caldav-accounts/test-connection
  app.post("/test-connection", async (c) => {
    const input = createCalDavAccountSchema.parse(await c.req.json());
    const success = await caldavService.testConnection(input);
    return c.json({ data: { success } });
  });

  return app;
}
