import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, utimesSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { VaultService } from "../../infrastructure/vault/vault.service";
import { FsVaultNoteRepository } from "../../infrastructure/repositories/vault-note.repository.impl";
import {
  VaultNotFoundError,
  NoteNotFoundError,
  NoteAlreadyExistsError,
  InvalidNotePathError,
  NoteLockedError,
} from "../../domain/vault-note/vault-note.repository";

describe("FsVaultNoteRepository", () => {
  let vault: VaultService;
  let repo: FsVaultNoteRepository;
  let tmpVault: string;

  beforeEach(() => {
    tmpVault = join(tmpdir(), `test-vault-notes-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpVault, { recursive: true });
    vault = new VaultService();
    vault.setVaultPath(tmpVault);
    repo = new FsVaultNoteRepository(vault);
  });

  afterEach(() => {
    try { rmSync(tmpVault, { recursive: true, force: true }); } catch { /* */ }
  });

  // ─── create / read ───

  it("creates a note with frontmatter and reads it back with parsed meta", async () => {
    const note = await repo.create({
      path: "_ai/first.md",
      body: "# Hello\n\nWorld.",
      frontmatter: { title: "First", tags: ["ai", "demo"] },
    });

    expect(note.path).toBe("_ai/first.md");
    expect(note.frontmatter.title).toBe("First");
    expect(note.frontmatter.tags).toEqual(["ai", "demo"]);
    expect(note.body).toContain("Hello");

    const read = await repo.read("_ai/first.md");
    expect(read.body).toBe("# Hello\n\nWorld.");
    expect(read.frontmatter.title).toBe("First");
  });

  it("creates a note without frontmatter when none provided", async () => {
    const note = await repo.create({ path: "plain.md", body: "raw body" });
    expect(note.content).toBe("raw body");
    expect(note.frontmatter).toEqual({});
  });

  it("throws NoteAlreadyExistsError when creating over an existing note", async () => {
    await repo.create({ path: "dup.md", body: "a" });
    expect(repo.create({ path: "dup.md", body: "b" })).rejects.toBeInstanceOf(NoteAlreadyExistsError);
  });

  it("throws NoteNotFoundError when reading a missing note", async () => {
    expect(repo.read("nope.md")).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  it("throws VaultNotFoundError when vault path is not configured", async () => {
    const emptyRepo = new FsVaultNoteRepository(new VaultService());
    expect(emptyRepo.list()).rejects.toBeInstanceOf(VaultNotFoundError);
  });

  // ─── path validation ───

  it("rejects path traversal attempts", async () => {
    expect(repo.create({ path: "../../etc/passwd.md", body: "" })).rejects.toBeInstanceOf(InvalidNotePathError);
  });

  it("rejects paths without .md extension", async () => {
    expect(repo.create({ path: "notes/plain.txt", body: "" })).rejects.toBeInstanceOf(InvalidNotePathError);
  });

  // ─── update preserves frontmatter ───

  it("update replaces body but preserves existing frontmatter when not patched", async () => {
    await repo.create({ path: "note.md", body: "original", frontmatter: { title: "T", tags: ["a"] } });
    const updated = await repo.update("note.md", { body: "replaced" });
    expect(updated.body).toBe("replaced");
    expect(updated.frontmatter.title).toBe("T");
    expect(updated.frontmatter.tags).toEqual(["a"]);
  });

  it("update merges frontmatter patches (null deletes a key)", async () => {
    await repo.create({ path: "note.md", body: "x", frontmatter: { a: "1", b: "2", c: "3" } });
    const updated = await repo.update("note.md", { frontmatter: { b: "20", c: null, d: "4" } });
    expect(updated.frontmatter).toEqual({ a: "1", b: "20", d: "4" });
  });

  it("update throws when note does not exist", async () => {
    expect(repo.update("missing.md", { body: "x" })).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  // ─── append ───

  it("append adds text to the end of the body without touching frontmatter", async () => {
    await repo.create({ path: "log.md", body: "line 1", frontmatter: { title: "Log" } });
    const after = await repo.append("log.md", "line 2");
    expect(after.body).toBe("line 1\nline 2");
    expect(after.frontmatter.title).toBe("Log");
  });

  it("append without trailing newline in existing body inserts one", async () => {
    await repo.create({ path: "log.md", body: "no-newline" });
    const after = await repo.append("log.md", "more");
    expect(after.body).toBe("no-newline\nmore");
  });

  // ─── delete / rename ───

  it("delete removes the file", async () => {
    await repo.create({ path: "bye.md", body: "x" });
    await repo.delete("bye.md");
    expect(repo.read("bye.md")).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  it("rename moves the file and returns the new location", async () => {
    await repo.create({ path: "old.md", body: "x", frontmatter: { title: "Old" } });
    const moved = await repo.rename("old.md", "_ai/new.md");
    expect(moved.path).toBe("_ai/new.md");
    expect(moved.frontmatter.title).toBe("Old");
    expect(repo.read("old.md")).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  it("rename throws when target already exists", async () => {
    await repo.create({ path: "a.md", body: "x" });
    await repo.create({ path: "b.md", body: "y" });
    expect(repo.rename("a.md", "b.md")).rejects.toBeInstanceOf(NoteAlreadyExistsError);
  });

  // ─── list ───

  it("list returns notes recursively, newest first", async () => {
    await repo.create({ path: "_ai/a.md", body: "a" });
    await new Promise((r) => setTimeout(r, 10));
    await repo.create({ path: "_ai/deep/b.md", body: "b" });
    await new Promise((r) => setTimeout(r, 10));
    await repo.create({ path: "c.md", body: "c" });

    const all = await repo.list();
    expect(all.map((n) => n.path)).toEqual(["c.md", "_ai/deep/b.md", "_ai/a.md"]);
  });

  it("list with prefix narrows the scope", async () => {
    await repo.create({ path: "_ai/inside.md", body: "a" });
    await repo.create({ path: "journal/out.md", body: "b" });
    const res = await repo.list({ prefix: "_ai" });
    expect(res.map((n) => n.path)).toEqual(["_ai/inside.md"]);
  });

  it("list ignores .lock files", async () => {
    await repo.create({ path: "a.md", body: "x" });
    writeFileSync(join(tmpVault, "a.md.lock"), String(Date.now()));
    const res = await repo.list();
    expect(res).toHaveLength(1);
    expect(res[0].path).toBe("a.md");
  });

  // ─── locks ───

  it("throws NoteLockedError when a recent lock is present", async () => {
    await repo.create({ path: "locked.md", body: "x" });
    const lockPath = join(tmpVault, "locked.md.lock");
    writeFileSync(lockPath, String(Date.now()));
    expect(repo.update("locked.md", { body: "y" })).rejects.toBeInstanceOf(NoteLockedError);
  });

  it("ignores stale locks (older than 5s)", async () => {
    await repo.create({ path: "stale.md", body: "x" });
    const lockPath = join(tmpVault, "stale.md.lock");
    writeFileSync(lockPath, "old");
    // Back-date the lock to 10s ago.
    const past = Date.now() - 10_000;
    utimesSync(lockPath, new Date(past), new Date(past));
    const updated = await repo.update("stale.md", { body: "fresh" });
    expect(updated.body).toBe("fresh");
  });

  it("releases the lock after a successful write", async () => {
    await repo.create({ path: "clean.md", body: "x" });
    expect(existsSync(join(tmpVault, "clean.md.lock"))).toBe(false);
    // Subsequent write should also leave no lock behind.
    await repo.update("clean.md", { body: "y" });
    expect(existsSync(join(tmpVault, "clean.md.lock"))).toBe(false);
  });

  it("preserves raw content on read (full file including frontmatter block)", async () => {
    await repo.create({ path: "full.md", body: "body", frontmatter: { k: "v" } });
    const raw = readFileSync(join(tmpVault, "full.md"), "utf-8");
    const read = await repo.read("full.md");
    expect(read.content).toBe(raw);
  });
});
