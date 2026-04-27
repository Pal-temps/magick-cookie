import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createNotesTools } from "../../application/agent/tools/notes.tools";
import type { AgentTool } from "../../application/agent/tool-registry";
import type { VaultNoteService } from "../../application/vault-note/vault-note.service";
import type { VaultNote, VaultNoteRef } from "../../domain/vault-note/vault-note.entity";

const makeNote = (overrides: Partial<VaultNote> = {}): VaultNote => ({
  path: "_ai/example.md",
  content: "---\ntitle: ex\n---\nbody",
  frontmatter: { title: "ex" },
  body: "body",
  updatedAt: new Date("2026-04-28T10:00:00Z"),
  sizeBytes: 42,
  ...overrides,
});
const makeRef = (overrides: Partial<VaultNoteRef> = {}): VaultNoteRef => ({
  path: "_ai/x.md",
  updatedAt: new Date("2026-04-28T10:00:00Z"),
  sizeBytes: 12,
  ...overrides,
});

describe("notes.tools", () => {
  let svc: { [K in keyof VaultNoteService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let readTool: AgentTool;
  let createTool: AgentTool;
  let editTool: AgentTool;
  let appendTool: AgentTool;
  let deleteTool: AgentTool;
  let renameTool: AgentTool;

  beforeEach(() => {
    svc = {
      list: mock(() => Promise.resolve([])),
      read: mock(() => Promise.resolve(makeNote())),
      create: mock(() => Promise.resolve(makeNote())),
      createForAi: mock(() => Promise.resolve(makeNote())),
      update: mock(() => Promise.resolve(makeNote())),
      append: mock(() => Promise.resolve(makeNote())),
      delete: mock(() => Promise.resolve(undefined)),
      rename: mock(() => Promise.resolve(makeNote())),
    } as unknown as { [K in keyof VaultNoteService]: ReturnType<typeof mock> };

    tools = createNotesTools(svc as unknown as VaultNoteService);
    listTool = tools.find((t) => t.name === "notes_list")!;
    readTool = tools.find((t) => t.name === "notes_read")!;
    createTool = tools.find((t) => t.name === "notes_create")!;
    editTool = tools.find((t) => t.name === "notes_edit")!;
    appendTool = tools.find((t) => t.name === "notes_append")!;
    deleteTool = tools.find((t) => t.name === "notes_delete")!;
    renameTool = tools.find((t) => t.name === "notes_rename")!;
  });

  it("registers the 7 P3 tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["notes_append", "notes_create", "notes_delete", "notes_edit", "notes_list", "notes_read", "notes_rename"],
    );
  });

  it("only the destructive op is user-confirm", () => {
    expect(deleteTool.permissionLevel).toBe("user-confirm");
    // edit/rename/append modify content but don't destroy → kept auto for now (will tighten in P6).
    expect(createTool.permissionLevel).toBe("auto");
    expect(editTool.permissionLevel).toBe("auto");
    expect(appendTool.permissionLevel).toBe("auto");
    expect(renameTool.permissionLevel).toBe("auto");
    expect(readTool.permissionLevel).toBe("auto");
    expect(listTool.permissionLevel).toBe("auto");
  });

  describe("notes_list", () => {
    it("forwards prefix + default limit 100", async () => {
      svc.list.mockReturnValue(Promise.resolve([makeRef()]));
      const result = (await listTool.execute({ prefix: "_ai" })) as { count: number };
      expect(result.count).toBe(1);
      expect(svc.list).toHaveBeenCalledWith({ prefix: "_ai", limit: 100 });
    });

    it("respects an explicit limit", async () => {
      await listTool.execute({ limit: 5 });
      expect(svc.list).toHaveBeenCalledWith({ prefix: undefined, limit: 5 });
    });

    it("rejects oversized limit via zod", async () => {
      const result = (await listTool.execute({ limit: 9999 })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.list).not.toHaveBeenCalled();
    });

    it("wraps service errors in a structured payload (no throw)", async () => {
      svc.list.mockReturnValue(Promise.reject(new Error("disk full")));
      const result = (await listTool.execute({})) as { error?: string };
      expect(result.error).toBe("disk full");
    });
  });

  describe("notes_read", () => {
    it("returns frontmatter + body + updatedAt", async () => {
      const note = makeNote({ frontmatter: { title: "Hello" }, body: "World" });
      svc.read.mockReturnValue(Promise.resolve(note));
      const result = (await readTool.execute({ path: "_ai/foo.md" })) as { frontmatter: unknown; body: string };
      expect(result.frontmatter).toEqual({ title: "Hello" });
      expect(result.body).toBe("World");
      expect(svc.read).toHaveBeenCalledWith("_ai/foo.md");
    });

    it("rejects path that doesn't end in .md", async () => {
      const result = (await readTool.execute({ path: "_ai/foo.txt" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.read).not.toHaveBeenCalled();
    });
  });

  describe("notes_create", () => {
    it("uses createForAi so the _ai/ default prefix is applied", async () => {
      svc.createForAi.mockReturnValue(Promise.resolve(makeNote({ path: "_ai/idea.md" })));
      const result = (await createTool.execute({ path: "idea.md", body: "x" })) as { created: boolean; path: string };
      expect(result.created).toBe(true);
      expect(result.path).toBe("_ai/idea.md");
      expect(svc.createForAi).toHaveBeenCalledTimes(1);
      // `create` (the non-AI variant) must never be called from the tool layer.
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("forwards optional frontmatter", async () => {
      await createTool.execute({ path: "x.md", body: "", frontmatter: { tag: "auto" } });
      const arg = svc.createForAi.mock.calls[0][0];
      expect((arg as { frontmatter?: unknown }).frontmatter).toEqual({ tag: "auto" });
    });

    it("wraps a duplicate-name error from the service", async () => {
      svc.createForAi.mockReturnValue(Promise.reject(new Error("Note already exists")));
      const result = (await createTool.execute({ path: "x.md", body: "" })) as { error?: string };
      expect(result.error).toBe("Note already exists");
    });
  });

  describe("notes_edit", () => {
    it("requires at least body or frontmatter", async () => {
      const result = (await editTool.execute({ path: "_ai/x.md" })) as { error?: string };
      expect(result.error).toContain("body");
      expect(svc.update).not.toHaveBeenCalled();
    });

    it("forwards body-only edit", async () => {
      await editTool.execute({ path: "_ai/x.md", body: "new body" });
      expect(svc.update).toHaveBeenCalledWith("_ai/x.md", { body: "new body", frontmatter: undefined });
    });

    it("forwards frontmatter merge with null delete", async () => {
      await editTool.execute({ path: "_ai/x.md", frontmatter: { tag: "v2", oldKey: null } });
      expect(svc.update).toHaveBeenCalledWith("_ai/x.md", { body: undefined, frontmatter: { tag: "v2", oldKey: null } });
    });
  });

  describe("notes_append", () => {
    it("delegates to service.append with the text", async () => {
      await appendTool.execute({ path: "_ai/journal.md", text: "Today: foo" });
      expect(svc.append).toHaveBeenCalledWith("_ai/journal.md", "Today: foo");
    });

    it("rejects empty text", async () => {
      const result = (await appendTool.execute({ path: "_ai/x.md", text: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.append).not.toHaveBeenCalled();
    });
  });

  describe("notes_delete", () => {
    it("delegates to service.delete and echoes path", async () => {
      const result = (await deleteTool.execute({ path: "_ai/x.md" })) as { deleted: boolean; path: string };
      expect(result.deleted).toBe(true);
      expect(result.path).toBe("_ai/x.md");
      expect(svc.delete).toHaveBeenCalledWith("_ai/x.md");
    });

    it("wraps a not-found error from the service", async () => {
      svc.delete.mockReturnValue(Promise.reject(new Error("Note not found")));
      const result = (await deleteTool.execute({ path: "_ai/missing.md" })) as { error?: string };
      expect(result.error).toBe("Note not found");
    });
  });

  describe("notes_rename", () => {
    it("forwards both paths in the right order", async () => {
      svc.rename.mockReturnValue(Promise.resolve(makeNote({ path: "_ai/new.md" })));
      const result = (await renameTool.execute({ oldPath: "_ai/old.md", newPath: "_ai/new.md" })) as { renamed: boolean; path: string };
      expect(result.renamed).toBe(true);
      expect(result.path).toBe("_ai/new.md");
      expect(svc.rename).toHaveBeenCalledWith("_ai/old.md", "_ai/new.md");
    });

    it("wraps a target-exists error from the service", async () => {
      svc.rename.mockReturnValue(Promise.reject(new Error("Target already exists")));
      const result = (await renameTool.execute({ oldPath: "_ai/a.md", newPath: "_ai/b.md" })) as { error?: string };
      expect(result.error).toBe("Target already exists");
    });

    it("rejects newPath that doesn't end in .md", async () => {
      const result = (await renameTool.execute({ oldPath: "_ai/a.md", newPath: "_ai/b.txt" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.rename).not.toHaveBeenCalled();
    });
  });
});
