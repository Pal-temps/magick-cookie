import { describe, it, expect, mock, beforeEach } from "bun:test";
import { VaultNoteService, applyAiDefaultPrefix, AI_DEFAULT_PREFIX } from "../../application/vault-note/vault-note.service";
import type { VaultNoteRepository } from "../../domain/vault-note/vault-note.repository";
import type { VaultNote } from "../../domain/vault-note/vault-note.entity";

function makeNote(overrides: Partial<VaultNote> = {}): VaultNote {
  return {
    path: "note.md",
    content: "body",
    frontmatter: {},
    body: "body",
    updatedAt: new Date("2026-04-25"),
    sizeBytes: 4,
    ...overrides,
  };
}

describe("applyAiDefaultPrefix", () => {
  it("prefixes bare filenames with _ai/", () => {
    expect(applyAiDefaultPrefix("idea.md")).toBe(`${AI_DEFAULT_PREFIX}idea.md`);
  });

  it("leaves paths that already include a folder alone", () => {
    expect(applyAiDefaultPrefix("journal/today.md")).toBe("journal/today.md");
    expect(applyAiDefaultPrefix("_ai/explicit.md")).toBe("_ai/explicit.md");
  });

  it("normalizes Windows-style slashes and leading slash", () => {
    expect(applyAiDefaultPrefix("\\weird\\path.md")).toBe("weird/path.md");
    expect(applyAiDefaultPrefix("/absolute.md")).toBe(`${AI_DEFAULT_PREFIX}absolute.md`);
  });
});

describe("VaultNoteService", () => {
  let repo: Record<keyof VaultNoteRepository, ReturnType<typeof mock>>;
  let service: VaultNoteService;

  beforeEach(() => {
    repo = {
      list: mock(() => Promise.resolve([])),
      read: mock((path: string) => Promise.resolve(makeNote({ path }))),
      create: mock((input: { path: string; body: string }) => Promise.resolve(makeNote({ path: input.path }))),
      update: mock((path: string) => Promise.resolve(makeNote({ path }))),
      append: mock((path: string) => Promise.resolve(makeNote({ path }))),
      delete: mock(() => Promise.resolve()),
      rename: mock((_old: string, newPath: string) => Promise.resolve(makeNote({ path: newPath }))),
    };
    service = new VaultNoteService(repo as unknown as VaultNoteRepository);
  });

  it("createForAi applies the _ai/ prefix when path has no folder", async () => {
    await service.createForAi({ path: "quick.md", body: "x" });
    expect(repo.create).toHaveBeenCalledWith({ path: "_ai/quick.md", body: "x" });
  });

  it("createForAi keeps an explicit folder", async () => {
    await service.createForAi({ path: "journal/today.md", body: "x" });
    expect(repo.create).toHaveBeenCalledWith({ path: "journal/today.md", body: "x" });
  });

  it("create (non-AI) never rewrites the path", async () => {
    await service.create({ path: "exact.md", body: "x" });
    expect(repo.create).toHaveBeenCalledWith({ path: "exact.md", body: "x" });
  });

  it("delegates list/read/update/append/delete/rename to the repo", async () => {
    await service.list({ limit: 5 });
    await service.read("x.md");
    await service.update("x.md", { body: "y" });
    await service.append("x.md", "z");
    await service.delete("x.md");
    await service.rename("x.md", "y.md");
    expect(repo.list).toHaveBeenCalledWith({ limit: 5 });
    expect(repo.read).toHaveBeenCalledWith("x.md");
    expect(repo.update).toHaveBeenCalledWith("x.md", { body: "y" });
    expect(repo.append).toHaveBeenCalledWith("x.md", "z");
    expect(repo.delete).toHaveBeenCalledWith("x.md");
    expect(repo.rename).toHaveBeenCalledWith("x.md", "y.md");
  });
});
