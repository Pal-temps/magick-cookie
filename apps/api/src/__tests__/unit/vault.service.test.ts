import { describe, it, expect, beforeEach } from "bun:test";
import { VaultService } from "../../infrastructure/vault/vault.service";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("VaultService", () => {
  let vault: VaultService;
  let tmpVault: string;

  beforeEach(() => {
    tmpVault = join(tmpdir(), `test-vault-${Date.now()}`);
    mkdirSync(tmpVault, { recursive: true });
    vault = new VaultService();
    vault.setVaultPath(tmpVault);
  });

  // ─── Path resolution ───

  it("resolvePath returns full path for valid relative path", () => {
    const resolved = vault.resolvePath("_config/test.json");
    expect(resolved).toBe(join(tmpVault, "_config", "test.json"));
  });

  it("resolvePath returns null for path traversal", () => {
    expect(vault.resolvePath("../../etc/passwd")).toBeNull();
    expect(vault.resolvePath("_config/../../../etc/passwd")).toBeNull();
  });

  it("resolvePath returns null when vault not set", () => {
    const emptyVault = new VaultService();
    expect(emptyVault.resolvePath("test.json")).toBeNull();
  });

  // ─── JSON read/write ───

  it("writeJson creates file with parent dirs", () => {
    vault.writeJson("_config/deep/nested/test.json", { key: "value" });
    const result = vault.readJson<{ key: string }>("_config/deep/nested/test.json");
    expect(result).toEqual({ key: "value" });
  });

  it("readJson returns null for missing file", () => {
    expect(vault.readJson("nonexistent.json")).toBeNull();
  });

  it("readJson returns null for invalid JSON", () => {
    vault.writeText("bad.json", "not json {{{");
    expect(vault.readJson("bad.json")).toBeNull();
  });

  // ─── Text read/write ───

  it("writeText and readText work", () => {
    vault.writeText("notes/test.md", "# Hello\nWorld");
    const content = vault.readText("notes/test.md");
    expect(content).toBe("# Hello\nWorld");
  });

  it("readText returns null for missing file", () => {
    expect(vault.readText("missing.md")).toBeNull();
  });

  // ─── listDir ───

  it("listDir returns files in directory", () => {
    vault.writeText("_config/a.json", "{}");
    vault.writeText("_config/b.json", "{}");
    vault.writeText("_config/.hidden", "{}");

    const files = vault.listDir("_config");
    expect(files).toContain("a.json");
    expect(files).toContain("b.json");
    expect(files).not.toContain(".hidden"); // hidden files filtered
  });

  it("listDir with extension filter", () => {
    vault.writeText("_ide/skills/deploy.md", "---\n---\ncontent");
    vault.writeText("_ide/skills/readme.txt", "text");

    const mdFiles = vault.listDir("_ide/skills", ".md");
    expect(mdFiles).toContain("deploy.md");
    // txt file should be filtered out by ext filter
  });

  it("listDir returns empty for missing directory", () => {
    expect(vault.listDir("nonexistent")).toEqual([]);
  });
});
