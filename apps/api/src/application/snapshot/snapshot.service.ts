import type { VaultService } from "../../infrastructure/vault/vault.service";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { EventRepository } from "../../domain/event/event.repository";
import type { ContactRepository } from "../../domain/contact/contact.repository";
import type { BookmarkRepository } from "../../domain/bookmark/bookmark.repository";

export class SnapshotService {
  constructor(
    private vault: VaultService,
    private taskRepo: TaskRepository,
    private eventRepo: EventRepository,
    private contactRepo: ContactRepository,
    private bookmarkRepo: BookmarkRepository,
  ) {}

  async exportSnapshot(): Promise<{ tables: string[]; date: string }> {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const exported: string[] = [];

    const dump = async (table: string, loader: () => Promise<unknown>) => {
      try {
        const data = await loader();
        this.vault.writeJson(`_snapshots/${table}-${date}.json`, data);
        exported.push(table);
      } catch { /* skip table on failure */ }
    };

    await dump("tasks", () => this.taskRepo.findAll({ limit: 100_000 }));
    await dump("events", () => this.eventRepo.findAll({}));
    await dump("contacts", () => this.contactRepo.findAll());
    await dump("bookmarks", () => this.bookmarkRepo.findAll());

    return { tables: exported, date };
  }
}
