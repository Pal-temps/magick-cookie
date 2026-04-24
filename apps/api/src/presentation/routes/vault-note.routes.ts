import { Hono } from "hono";
import type { VaultNoteService } from "../../application/vault-note/vault-note.service";
import {
  VaultNotFoundError,
  NoteNotFoundError,
  NoteAlreadyExistsError,
  InvalidNotePathError,
  NoteLockedError,
} from "../../domain/vault-note/vault-note.repository";
import {
  listNotesQuerySchema,
  createNoteSchema,
  updateNoteSchema,
  appendNoteSchema,
  renameNoteSchema,
} from "../validators/vault-note.validator";

function mapError(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof VaultNotFoundError) return { status: 409, body: { error: "Vault not configured" } };
  if (err instanceof NoteNotFoundError) return { status: 404, body: { error: err.message } };
  if (err instanceof NoteAlreadyExistsError) return { status: 409, body: { error: err.message } };
  if (err instanceof InvalidNotePathError) return { status: 400, body: { error: err.message } };
  if (err instanceof NoteLockedError) return { status: 423, body: { error: err.message } };
  throw err;
}

export function createVaultNoteRoutes(service: VaultNoteService) {
  const app = new Hono();

  // GET /api/vault/notes  — list (recursive, newest-first)
  app.get("/", async (c) => {
    const parsed = listNotesQuerySchema.safeParse({
      prefix: c.req.query("prefix"),
      limit: c.req.query("limit"),
    });
    if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    try {
      const data = await service.list(parsed.data);
      return c.json({ data });
    } catch (err) {
      const e = mapError(err);
      return c.json(e.body, e.status as 400 | 404 | 409 | 423);
    }
  });

  // GET /api/vault/notes/raw?path=_ai/foo.md — read
  app.get("/raw", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    try {
      const note = await service.read(path);
      return c.json({ data: note });
    } catch (err) {
      const e = mapError(err);
      return c.json(e.body, e.status as 400 | 404 | 409 | 423);
    }
  });

  // POST /api/vault/notes — create (body contains path + body + frontmatter)
  app.post("/", async (c) => {
    const parsed = createNoteSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    try {
      const note = await service.create(parsed.data);
      return c.json({ data: note }, 201);
    } catch (err) {
      const e = mapError(err);
      return c.json(e.body, e.status as 400 | 404 | 409 | 423);
    }
  });

  // PUT /api/vault/notes/:path — update body and/or frontmatter
  app.put("/raw", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const parsed = updateNoteSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    try {
      const note = await service.update(path, parsed.data);
      return c.json({ data: note });
    } catch (err) {
      const e = mapError(err);
      return c.json(e.body, e.status as 400 | 404 | 409 | 423);
    }
  });

  // POST /api/vault/notes/append?path= — append text to body
  app.post("/append", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const parsed = appendNoteSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    try {
      const note = await service.append(path, parsed.data.text);
      return c.json({ data: note });
    } catch (err) {
      const e = mapError(err);
      return c.json(e.body, e.status as 400 | 404 | 409 | 423);
    }
  });

  // POST /api/vault/notes/rename?path= — move to newPath
  app.post("/rename", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const parsed = renameNoteSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    try {
      const note = await service.rename(path, parsed.data.newPath);
      return c.json({ data: note });
    } catch (err) {
      const e = mapError(err);
      return c.json(e.body, e.status as 400 | 404 | 409 | 423);
    }
  });

  // DELETE /api/vault/notes?path=
  app.delete("/", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    try {
      await service.delete(path);
      return c.json({ data: { ok: true } });
    } catch (err) {
      const e = mapError(err);
      return c.json(e.body, e.status as 400 | 404 | 409 | 423);
    }
  });

  return app;
}
