import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import { api } from "../../../infrastructure/api/apiClient";
import {
  devopsCliService,
  INSTALL_PROGRESS_EVENT,
  AUTH_CODE_EVENT,
  AUTH_DONE_EVENT,
  type AvailableCli,
  type InstallProgress,
  type AuthCodeEvent,
  type AuthDoneEvent,
} from "../../../application/services/devopsCliService";

// CLIs that support OAuth device flow via their own `auth login` command.
const AUTH_CAPABLE = new Set(["gh"]);

type RowState =
  | { kind: "idle" }
  | { kind: "installing"; phase: InstallProgress["phase"] }
  | { kind: "error"; message: string };

type AuthState =
  | { kind: "unknown" }
  | { kind: "pending" }
  | { kind: "awaiting_code"; user_code: string; verification_uri: string }
  | { kind: "authenticated"; username: string }
  | { kind: "unauthenticated" }
  | { kind: "auth_error"; message: string };

export function DevopsCliSettings() {
  const { t } = useT();

  const [clis, setClis] = createSignal<AvailableCli[]>([]);
  const [rowStates, setRowStates] = createSignal<Record<string, RowState>>({});
  const [authStates, setAuthStates] = createSignal<Record<string, AuthState>>({});
  const [loading, setLoading] = createSignal(true);

  const unlisteners: Array<() => void> = [];

  async function refresh() {
    const list = await devopsCliService.listAvailable();
    setClis(list);
    setLoading(false);

    // Check auth status for every installed, auth-capable CLI.
    for (const cli of list) {
      if (cli.installed && AUTH_CAPABLE.has(cli.name)) {
        checkAuthStatus(cli.name);
      }
    }
  }

  async function checkAuthStatus(name: string) {
    setAuthStates((prev) => ({ ...prev, [name]: { kind: "pending" } }));
    try {
      const ok = await devopsCliService.authStatus(name);
      setAuthStates((prev) => ({
        ...prev,
        [name]: ok ? { kind: "authenticated", username: "" } : { kind: "unauthenticated" },
      }));
    } catch {
      setAuthStates((prev) => ({ ...prev, [name]: { kind: "unauthenticated" } }));
    }
  }

  onMount(async () => {
    await refresh();

    // Install progress — single subscription for all CLIs.
    const unlistenInstall = await listen<InstallProgress>(INSTALL_PROGRESS_EVENT, (event) => {
      const p = event.payload;
      setRowStates((prev) => {
        const next = { ...prev };
        if (p.phase === "done") next[p.name] = { kind: "idle" };
        else if (p.phase === "failed") next[p.name] = { kind: "error", message: p.error };
        else next[p.name] = { kind: "installing", phase: p.phase };
        return next;
      });
      if (p.phase === "done" || p.phase === "failed") void refresh();
    });
    unlisteners.push(unlistenInstall);

    // Auth code received — show the code in the row.
    const unlistenCode = await listen<AuthCodeEvent>(AUTH_CODE_EVENT, (event) => {
      const { name, user_code, verification_uri } = event.payload;
      setAuthStates((prev) => ({
        ...prev,
        [name]: { kind: "awaiting_code", user_code, verification_uri },
      }));
    });
    unlisteners.push(unlistenCode);

    // Auth done — update state + sync token to API.
    const unlistenDone = await listen<AuthDoneEvent>(AUTH_DONE_EVENT, async (event) => {
      const { name, success, username, token, error } = event.payload;
      if (success) {
        setAuthStates((prev) => ({
          ...prev,
          [name]: { kind: "authenticated", username },
        }));
        // Sync the token to the API's connector_configs so AI tools can use it.
        if (name === "gh" && token) {
          try {
            await api.put("/github/config", { token, username, repos: [] });
          } catch {
            // Best-effort — auth itself succeeded, only API sync failed.
          }
        }
      } else {
        setAuthStates((prev) => ({
          ...prev,
          [name]: { kind: "auth_error", message: error || t("settings.devopsCliAuthFailed") },
        }));
      }
    });
    unlisteners.push(unlistenDone);
  });

  onCleanup(() => {
    for (const fn of unlisteners) fn();
  });

  async function install(name: string) {
    setRowStates((prev) => ({ ...prev, [name]: { kind: "installing", phase: "started" } }));
    try {
      await devopsCliService.install(name);
    } catch (e) {
      setRowStates((prev) => ({
        ...prev,
        [name]: { kind: "error", message: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  async function uninstall(name: string) {
    try {
      await devopsCliService.uninstall(name);
      await refresh();
    } catch (e) {
      setRowStates((prev) => ({
        ...prev,
        [name]: { kind: "error", message: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  async function startAuth(name: string) {
    setAuthStates((prev) => ({ ...prev, [name]: { kind: "pending" } }));
    try {
      // cli_auth_login is blocking until auth completes — the result arrives via events
      // (cli://auth/code then cli://auth/done) which are handled in the listeners above.
      // The invoke itself resolves once the full flow is done.
      await devopsCliService.authLogin(name);
    } catch (e) {
      setAuthStates((prev) => ({
        ...prev,
        [name]: {
          kind: "auth_error",
          message: e instanceof Error ? e.message : String(e),
        },
      }));
    }
  }

  async function logout(name: string) {
    try {
      await devopsCliService.authLogout(name);
      setAuthStates((prev) => ({ ...prev, [name]: { kind: "unauthenticated" } }));
      // Remove token from connector_configs as well.
      if (name === "gh") {
        try {
          await api.delete("/github/config");
        } catch {
          // Best-effort.
        }
      }
    } catch (e) {
      setAuthStates((prev) => ({
        ...prev,
        [name]: {
          kind: "auth_error",
          message: e instanceof Error ? e.message : String(e),
        },
      }));
    }
  }

  function phaseLabel(phase: InstallProgress["phase"]): string {
    switch (phase) {
      case "started":     return t("settings.devopsCliPhaseStarted");
      case "downloading": return t("settings.devopsCliPhaseDownloading");
      case "verifying":   return t("settings.devopsCliPhaseVerifying");
      case "extracting":  return t("settings.devopsCliPhaseExtracting");
      case "done":        return t("settings.devopsCliPhaseDone");
      case "failed":      return t("settings.devopsCliPhaseFailed");
    }
  }

  const headingStyle = { margin: "0 0 4px", "font-size": "20px", "font-weight": "600" as const, color: "var(--text-primary)" };
  const subHeadingStyle = { margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" };
  const cardStyle = {
    padding: "12px 16px",
    background: "var(--bg-elevated)",
    "border-radius": "var(--radius-md)",
    "margin-bottom": "8px",
  };
  const cardRowStyle = { display: "flex", "align-items": "center", gap: "16px" };
  const metaStyle = { "font-size": "11px", color: "var(--text-muted)", "font-family": "monospace" };
  const authRowStyle = {
    "margin-top": "8px",
    "padding-top": "8px",
    "border-top": "1px solid var(--border-subtle, rgba(255,255,255,.06))",
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "flex-wrap": "wrap" as const,
  };

  return (
    <div style={{ padding: "24px 32px", "max-width": "720px" }}>
      <h2 style={headingStyle}>{t("settings.devopsCliTitle")}</h2>
      <p style={subHeadingStyle}>{t("settings.devopsCliDesc")}</p>

      <Show when={!loading()} fallback={<p style={{ color: "var(--text-muted)" }}>{t("common.loading")}</p>}>
        <Show
          when={clis().length > 0}
          fallback={<p style={{ color: "var(--text-muted)", "font-size": "13px" }}>{t("settings.devopsCliEmpty")}</p>}
        >
          <For each={clis()}>
            {(cli) => {
              const rowState = () => rowStates()[cli.name] ?? { kind: "idle" as const };
              const authState = () => authStates()[cli.name] ?? { kind: "unknown" as const };
              const isBusy = () => rowState().kind === "installing";
              const isAuthing = () => {
                const s = authState();
                return s.kind === "pending" || s.kind === "awaiting_code";
              };
              const showAuth = () => cli.installed && AUTH_CAPABLE.has(cli.name);

              return (
                <div style={cardStyle}>
                  <div style={cardRowStyle}>
                    <div style={{ flex: "1", "min-width": "0" }}>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                        <span style={{ "font-weight": "600", color: "var(--text-primary)" }}>
                          {cli.display_name}
                        </span>
                        <span style={metaStyle}>{cli.name}</span>
                        <span style={metaStyle}>v{cli.version}</span>
                        <Show when={cli.installed}>
                          <span style={{
                            "font-size": "10px", padding: "2px 6px",
                            "border-radius": "var(--radius-sm)",
                            background: "var(--success, #2ecc71)", color: "#fff",
                            "font-weight": "600", "text-transform": "uppercase",
                            "letter-spacing": "0.05em",
                          }}>
                            {t("settings.devopsCliInstalled")}
                          </span>
                        </Show>
                      </div>
                      <a
                        href={cli.homepage} target="_blank" rel="noreferrer"
                        style={{ "font-size": "11px", color: "var(--text-muted)", "text-decoration": "none" }}
                      >
                        {cli.homepage}
                      </a>
                      <Show when={rowState().kind === "installing"}>
                        <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>
                          {phaseLabel((rowState() as { kind: "installing"; phase: InstallProgress["phase"] }).phase)}
                        </div>
                      </Show>
                      <Show when={rowState().kind === "error"}>
                        <div style={{ "font-size": "11px", color: "var(--danger, #e74c3c)", "margin-top": "4px" }}>
                          {(rowState() as { kind: "error"; message: string }).message}
                        </div>
                      </Show>
                    </div>

                    <div style={{ display: "flex", gap: "6px", "flex-shrink": "0" }}>
                      <Show
                        when={cli.installed}
                        fallback={
                          <Button variant="primary" size="sm" disabled={isBusy()} onClick={() => install(cli.name)}>
                            {t("settings.devopsCliInstall")}
                          </Button>
                        }
                      >
                        <Button variant="secondary" size="sm" disabled={isBusy()} onClick={() => uninstall(cli.name)}>
                          {t("settings.devopsCliUninstall")}
                        </Button>
                      </Show>
                    </div>
                  </div>

                  {/* Auth row — only for installed CLIs that support OAuth */}
                  <Show when={showAuth()}>
                    <div style={authRowStyle}>
                      {/* Status badge */}
                      <Show when={authState().kind === "authenticated"}>
                        <span style={{
                          "font-size": "11px", padding: "2px 8px",
                          "border-radius": "var(--radius-sm)",
                          background: "var(--success-subtle, rgba(46,204,113,.15))",
                          color: "var(--success, #2ecc71)",
                          "font-weight": "600",
                        }}>
                          {t("settings.devopsCliLoggedIn")}
                          {(authState() as { kind: "authenticated"; username: string }).username
                            ? ` · ${(authState() as { kind: "authenticated"; username: string }).username}`
                            : ""}
                        </span>
                      </Show>
                      <Show when={authState().kind === "unauthenticated"}>
                        <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                          {t("settings.devopsCliNotLoggedIn")}
                        </span>
                      </Show>
                      <Show when={authState().kind === "pending"}>
                        <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                          {t("settings.devopsCliAuthWaiting")}
                        </span>
                      </Show>

                      {/* Device code display */}
                      <Show when={authState().kind === "awaiting_code"}>
                        <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                          {t("settings.devopsCliAuthCode")}
                        </span>
                        <code style={{
                          "font-size": "14px", "font-weight": "700",
                          "letter-spacing": "0.15em", color: "var(--text-primary)",
                          "font-family": "monospace",
                          padding: "2px 8px", background: "var(--bg-inset, rgba(0,0,0,.25))",
                          "border-radius": "var(--radius-sm)",
                        }}>
                          {(authState() as { kind: "awaiting_code"; user_code: string; verification_uri: string }).user_code}
                        </code>
                        <a
                          href={(authState() as { kind: "awaiting_code"; user_code: string; verification_uri: string }).verification_uri}
                          target="_blank" rel="noreferrer"
                          style={{ "font-size": "11px", color: "var(--accent, #7c5cbf)" }}
                        >
                          github.com/login/device ↗
                        </a>
                        <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                          {t("settings.devopsCliAuthWaiting")}
                        </span>
                      </Show>

                      {/* Error */}
                      <Show when={authState().kind === "auth_error"}>
                        <span style={{ "font-size": "11px", color: "var(--danger, #e74c3c)" }}>
                          {(authState() as { kind: "auth_error"; message: string }).message}
                        </span>
                      </Show>

                      {/* Login / Logout buttons */}
                      <div style={{ "margin-left": "auto" }}>
                        <Show
                          when={authState().kind === "authenticated"}
                          fallback={
                            <Button
                              variant="secondary" size="sm"
                              disabled={isAuthing()}
                              onClick={() => startAuth(cli.name)}
                            >
                              {t("settings.devopsCliLogin")}
                            </Button>
                          }
                        >
                          <Button
                            variant="secondary" size="sm"
                            onClick={() => logout(cli.name)}
                          >
                            {t("settings.devopsCliLogout")}
                          </Button>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </Show>
    </div>
  );
}
