import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock Tauri APIs before importing the service.
const invokeMock = mock(async (_cmd: string, _args?: unknown) => undefined as unknown);
mock.module("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const listenMock = mock(async (_event: string, _cb: unknown) => () => {});
mock.module("@tauri-apps/api/event", () => ({ listen: listenMock }));

import {
  devopsCliService,
  INSTALL_PROGRESS_EVENT,
  AUTH_CODE_EVENT,
  AUTH_DONE_EVENT,
} from "../../application/services/devopsCliService";

beforeEach(() => {
  invokeMock.mockClear();
  listenMock.mockClear();
});

describe("devopsCliService — install commands", () => {
  test("listAvailable invokes cli_list_available", async () => {
    invokeMock.mockImplementationOnce(async () => []);
    await devopsCliService.listAvailable();
    expect(invokeMock).toHaveBeenCalledWith("cli_list_available");
  });

  test("install passes name and force=false by default", async () => {
    invokeMock.mockImplementationOnce(async () => "/bin/gh");
    await devopsCliService.install("gh");
    expect(invokeMock).toHaveBeenCalledWith("cli_install", { name: "gh", force: false });
  });

  test("uninstall invokes cli_uninstall with name", async () => {
    invokeMock.mockImplementationOnce(async () => undefined);
    await devopsCliService.uninstall("gh");
    expect(invokeMock).toHaveBeenCalledWith("cli_uninstall", { name: "gh" });
  });
});

describe("devopsCliService — auth commands", () => {
  test("authLogin invokes cli_auth_login with name", async () => {
    invokeMock.mockImplementationOnce(async () => ({
      name: "gh", success: true, username: "octocat", token: "gho_xxx", error: "",
    }));
    await devopsCliService.authLogin("gh");
    expect(invokeMock).toHaveBeenCalledWith("cli_auth_login", { name: "gh" });
  });

  test("authStatus invokes cli_auth_status with name", async () => {
    invokeMock.mockImplementationOnce(async () => true);
    const ok = await devopsCliService.authStatus("gh");
    expect(invokeMock).toHaveBeenCalledWith("cli_auth_status", { name: "gh" });
    expect(ok).toBe(true);
  });

  test("authLogout invokes cli_auth_logout with name", async () => {
    invokeMock.mockImplementationOnce(async () => undefined);
    await devopsCliService.authLogout("gh");
    expect(invokeMock).toHaveBeenCalledWith("cli_auth_logout", { name: "gh" });
  });

  test("onAuthCode listens on AUTH_CODE_EVENT and filters by name", async () => {
    const received: string[] = [];
    listenMock.mockImplementationOnce(async (_event: string, cb: (_: unknown) => void) => {
      // Simulate two events: one matching, one for a different CLI.
      cb({ payload: { name: "gh", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device" } });
      cb({ payload: { name: "glab", user_code: "OTHER-CODE", verification_uri: "https://gitlab.com/-/oauth/device" } });
      return () => {};
    });
    await devopsCliService.onAuthCode("gh", (e) => received.push(e.user_code));
    expect(received).toEqual(["ABCD-1234"]);
    expect(listenMock).toHaveBeenCalledWith(AUTH_CODE_EVENT, expect.any(Function));
  });

  test("onAuthDone listens on AUTH_DONE_EVENT and filters by name", async () => {
    const received: boolean[] = [];
    listenMock.mockImplementationOnce(async (_event: string, cb: (_: unknown) => void) => {
      cb({ payload: { name: "gh", success: true, username: "octocat", token: "t", error: "" } });
      cb({ payload: { name: "glab", success: false, username: "", token: "", error: "nope" } });
      return () => {};
    });
    await devopsCliService.onAuthDone("gh", (e) => received.push(e.success));
    expect(received).toEqual([true]);
    expect(listenMock).toHaveBeenCalledWith(AUTH_DONE_EVENT, expect.any(Function));
  });

  test("onInstallProgress returns the unlisten function", async () => {
    const unlisten = () => {};
    listenMock.mockImplementationOnce(async () => unlisten);
    const result = await devopsCliService.onInstallProgress("gh", () => {});
    expect(result).toBe(unlisten);
    expect(listenMock).toHaveBeenCalledWith(INSTALL_PROGRESS_EVENT, expect.any(Function));
  });
});

describe("devopsCliService — event constants", () => {
  test("INSTALL_PROGRESS_EVENT matches Rust constant", () => {
    expect(INSTALL_PROGRESS_EVENT).toBe("cli://install/progress");
  });

  test("AUTH_CODE_EVENT matches Rust constant", () => {
    expect(AUTH_CODE_EVENT).toBe("cli://auth/code");
  });

  test("AUTH_DONE_EVENT matches Rust constant", () => {
    expect(AUTH_DONE_EVENT).toBe("cli://auth/done");
  });
});
