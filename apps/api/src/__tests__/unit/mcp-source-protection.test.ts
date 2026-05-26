import { describe, it, expect } from "bun:test";
import { isProtectedSourcePath } from "../../mcp/source-protection";
import path from "path";

const ROOT = "/home/user/magick-cookie";
const ROOT_WIN = "C:/Users/user/magick-cookie";

// ─── Protected paths (should return true) ────────────────────────────────────

describe("isProtectedSourcePath — protected paths (→ true)", () => {
  const cases: [string, string][] = [
    // apps/desktop/src
    [`${ROOT}/apps/desktop/src/App.tsx`, ROOT],
    [`${ROOT}/apps/desktop/src/ui/components/ide/IdeView.tsx`, ROOT],
    [`${ROOT}/apps/desktop/src/application/stores/viewStore.ts`, ROOT],
    // apps/api/src
    [`${ROOT}/apps/api/src/index.ts`, ROOT],
    [`${ROOT}/apps/api/src/presentation/routes/task.routes.ts`, ROOT],
    [`${ROOT}/apps/api/src/mcp/magick-mcp-server.ts`, ROOT],
    // src-tauri/src
    [`${ROOT}/apps/desktop/src-tauri/src/main.rs`, ROOT],
    [`${ROOT}/apps/desktop/src-tauri/src/ai/adapters/claude_cli.rs`, ROOT],
    // tools/
    [`${ROOT}/tools/screenshot-cli/src/main.rs`, ROOT],
    [`${ROOT}/tools/benchmark-cli/src/main.rs`, ROOT],
    // Windows-style paths
    [`${ROOT_WIN}/apps/api/src/index.ts`, ROOT_WIN],
    [`${ROOT_WIN}/apps/desktop/src/App.tsx`, ROOT_WIN],
  ];

  for (const [filePath, appRoot] of cases) {
    it(`protects ${filePath.split("/").slice(-3).join("/")}`, () => {
      expect(isProtectedSourcePath(filePath, appRoot)).toBe(true);
    });
  }
});

// ─── Allowed paths (should return false) ─────────────────────────────────────

describe("isProtectedSourcePath — allowed paths (→ false)", () => {
  const cases: [string, string][] = [
    // User data directories
    [`${ROOT}/vault/notes/hello.md`, ROOT],
    [`${ROOT}/vault/tasks.json`, ROOT],
    // User project (outside root)
    ["/home/user/my-project/index.ts", ROOT],
    ["/tmp/scratch.txt", ROOT],
    // Root itself (no trailing slash match)
    [`${ROOT}/README.md`, ROOT],
    [`${ROOT}/package.json`, ROOT],
    // docs/ is not protected
    [`${ROOT}/docs/planning/plan.md`, ROOT],
    // scripts/ is not protected
    [`${ROOT}/scripts/deploy.sh`, ROOT],
    // node_modules is not protected (external deps)
    [`${ROOT}/apps/api/node_modules/hono/index.js`, ROOT],
    // apps/desktop but NOT src (e.g. dist/)
    [`${ROOT}/apps/desktop/dist/index.html`, ROOT],
    // Partial prefix match should NOT match (e.g. src-tauri-extra)
    [`${ROOT}/apps/desktop/src-tauri-extra/lib.rs`, ROOT],
  ];

  for (const [filePath, appRoot] of cases) {
    it(`allows ${filePath.split("/").slice(-3).join("/")}`, () => {
      expect(isProtectedSourcePath(filePath, appRoot)).toBe(false);
    });
  }
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("isProtectedSourcePath — edge cases", () => {
  it("returns false when appRoot is empty string", () => {
    expect(isProtectedSourcePath(`${ROOT}/apps/api/src/index.ts`, "")).toBe(false);
  });

  it("returns false when filePath is empty string", () => {
    expect(isProtectedSourcePath("", ROOT)).toBe(false);
  });

  it("handles Windows backslash paths in appRoot", () => {
    const winRoot = "C:\\Users\\user\\magick-cookie";
    const winFile = "C:\\Users\\user\\magick-cookie\\apps\\api\\src\\index.ts";
    expect(isProtectedSourcePath(winFile, winRoot)).toBe(true);
  });

  it("handles Windows backslash paths in filePath only", () => {
    const winFile = `${ROOT_WIN}\\apps\\api\\src\\index.ts`;
    expect(isProtectedSourcePath(winFile, ROOT_WIN)).toBe(true);
  });

  it("is case-sensitive (unix semantics — appRoot must match)", () => {
    // Path is /apps/Api/src — doesn't match /apps/api/src
    expect(isProtectedSourcePath(`${ROOT}/apps/Api/src/index.ts`, ROOT)).toBe(false);
  });

  it("handles trailing slash in appRoot correctly (normalises it)", () => {
    // A trailing slash in appRoot should not break the match
    const rootTrailing = `${ROOT}/`;
    expect(isProtectedSourcePath(`${ROOT}/apps/api/src/index.ts`, rootTrailing)).toBe(true);
  });

  it("protects exact boundary (no trailing /)", () => {
    // The path IS exactly the protected dir — no file after it
    // startsWith(`${root}/apps/api/src`) → `${root}/apps/api/src`.startsWith(`${root}/apps/api/src`) = true
    expect(isProtectedSourcePath(`${ROOT}/apps/api/src`, ROOT)).toBe(true);
  });
});
