import { describe, test, expect, beforeEach, mock } from "bun:test";

// Single shared mock for invoke() across every service test. We replace the Tauri module at
// module-load time; each test resets the call list so assertions are isolated.
const invokeMock = mock(async (_cmd: string, _args?: Record<string, unknown>) => undefined as unknown);

mock.module("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import { gitService } from "../../application/services/gitService";
import { ptyService } from "../../application/services/ptyService";
import { vaultService } from "../../application/services/vaultService";
import { windowService } from "../../application/services/windowService";

beforeEach(() => {
  invokeMock.mockClear();
  // Default to a resolved undefined; individual tests override with mockResolvedValueOnce when
  // they need a return value.
  invokeMock.mockImplementation(async () => undefined as unknown);
});

describe("gitService", () => {
  test("isRepo passes projectPath", async () => {
    invokeMock.mockImplementationOnce(async () => true);
    const res = await gitService.isRepo("C:/proj");
    expect(res).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("git_is_repo", { projectPath: "C:/proj" });
  });

  test("status returns an array", async () => {
    invokeMock.mockImplementationOnce(async () => [{ path: "a.ts", status: "M", staged: false }]);
    const res = await gitService.status("C:/p");
    expect(res.length).toBe(1);
    expect(invokeMock).toHaveBeenCalledWith("git_status", { projectPath: "C:/p" });
  });

  test("log defaults limit to 20", async () => {
    await gitService.log("C:/p");
    expect(invokeMock).toHaveBeenCalledWith("git_log", { projectPath: "C:/p", limit: 20 });
  });

  test("log accepts a custom limit", async () => {
    await gitService.log("C:/p", 5);
    expect(invokeMock).toHaveBeenCalledWith("git_log", { projectPath: "C:/p", limit: 5 });
  });

  test("stage passes files", async () => {
    await gitService.stage("C:/p", ["a", "b"]);
    expect(invokeMock).toHaveBeenCalledWith("git_stage", { projectPath: "C:/p", files: ["a", "b"] });
  });

  test("commit passes message", async () => {
    await gitService.commit("C:/p", "feat: x");
    expect(invokeMock).toHaveBeenCalledWith("git_commit", { projectPath: "C:/p", message: "feat: x" });
  });

  test("checkout passes branch", async () => {
    await gitService.checkout("C:/p", "main");
    expect(invokeMock).toHaveBeenCalledWith("git_checkout", { projectPath: "C:/p", branch: "main" });
  });
});

describe("ptyService", () => {
  test("spawn forwards all args", async () => {
    await ptyService.spawn("pty-1", "C:/", 80, 24);
    expect(invokeMock).toHaveBeenCalledWith("pty_spawn", { id: "pty-1", cwd: "C:/", cols: 80, rows: 24 });
  });

  test("write swallows errors", async () => {
    invokeMock.mockImplementationOnce(async () => {
      throw new Error("broken pipe");
    });
    await ptyService.write("pty-1", "ls\r"); // must not throw
    expect(invokeMock).toHaveBeenCalledWith("pty_write", { id: "pty-1", data: "ls\r" });
  });

  test("resize swallows errors", async () => {
    invokeMock.mockImplementationOnce(async () => {
      throw new Error("closed");
    });
    await ptyService.resize("pty-1", 120, 40);
  });

  test("kill swallows errors", async () => {
    invokeMock.mockImplementationOnce(async () => {
      throw new Error("already dead");
    });
    await ptyService.kill("pty-1");
  });
});

describe("vaultService", () => {
  test("readJson returns the parsed value", async () => {
    invokeMock.mockImplementationOnce(async () => ({ ok: true }));
    const res = await vaultService.readJson<{ ok: boolean }>("_config/foo.json");
    expect(res).toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledWith("vault_read_json", { relPath: "_config/foo.json" });
  });

  test("writeJson forwards path + content", async () => {
    await vaultService.writeJson("_config/foo.json", '{"a":1}');
    expect(invokeMock).toHaveBeenCalledWith("vault_write_json", {
      relPath: "_config/foo.json",
      content: '{"a":1}',
    });
  });

  test("deleteFile forwards relative path", async () => {
    await vaultService.deleteFile("_notes/old.md");
    expect(invokeMock).toHaveBeenCalledWith("vault_delete_file", { relPath: "_notes/old.md" });
  });
});

describe("windowService", () => {
  test("openDetached forwards label/title/route", async () => {
    await windowService.openDetached({ label: "t-1", title: "Title", route: "/r" });
    expect(invokeMock).toHaveBeenCalledWith("open_detached_window", {
      label: "t-1",
      title: "Title",
      route: "/r",
    });
  });
});
