import type { VaultService } from "../../infrastructure/vault/vault.service";
import { db } from "../../infrastructure/database/client";
import * as schema from "../../infrastructure/database/schema";

export class SnapshotService {
  constructor(private vault: VaultService) {}

  async exportSnapshot(): Promise<{ tables: string[]; date: string }> {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const exported: string[] = [];

    // Tasks
    try {
      const tasks = await db.select().from(schema.tasks);
      this.vault.writeJson(`_snapshots/tasks-${date}.json`, tasks);
      exported.push("tasks");
    } catch { /* skip */ }

    // Events
    try {
      const events = await db.select().from(schema.events);
      this.vault.writeJson(`_snapshots/events-${date}.json`, events);
      exported.push("events");
    } catch { /* skip */ }

    // Contacts
    try {
      const contacts = await db.select().from(schema.contacts);
      this.vault.writeJson(`_snapshots/contacts-${date}.json`, contacts);
      exported.push("contacts");
    } catch { /* skip */ }

    // Bookmarks
    try {
      const bookmarks = await db.select().from(schema.bookmarks);
      this.vault.writeJson(`_snapshots/bookmarks-${date}.json`, bookmarks);
      exported.push("bookmarks");
    } catch { /* skip */ }

    return { tables: exported, date };
  }
}
