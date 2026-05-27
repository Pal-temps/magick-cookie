/**
 * FirstRunWizard — shown once after the NSIS installer runs (or when notes path is unset).
 *
 * Steps:
 *  1. Folders  — confirm/adjust notes root + workspace root
 *  2. Git      — connect a git remote for notes backup (GitHub OAuth / GitLab token / custom / skip)
 *  3. Done     — summary + "Start" button
 */

import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useT } from "../../../i18n/context";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import {
  devopsCliService,
  type AuthCodeEvent,
} from "../../../application/services/devopsCliService";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "folders" | "git" | "done";
type GitProvider = "github" | "gitlab" | "custom" | "skip";

interface Props {
  /** Pre-filled values from the NSIS installer bootstrap. */
  initialNotesDir?: string;
  initialWorkspaceDir?: string;
  onClose: () => void;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: Step[] = ["folders", "git", "done"];

function StepDot(props: { active: boolean; done: boolean }) {
  return (
    <span style={{
      width: "10px",
      height: "10px",
      "border-radius": "50%",
      background: props.done
        ? "var(--accent, #3498db)"
        : props.active
          ? "var(--text-primary)"
          : "var(--border-color)",
      transition: "background 0.2s",
      display: "inline-block",
    }} />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FirstRunWizard(props: Props) {
  const { t } = useT();
  const settings = useSettingsStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = createSignal<Step>("folders");

  // Folders
  const [notesDir, setNotesDir] = createSignal(
    props.initialNotesDir ??
      (settings.getWorkspace().rootDirs[0] ?? ""),
  );
  const [workspaceDir, setWorkspaceDir] = createSignal(
    props.initialWorkspaceDir ??
      (settings.getWorkspace().rootDirs[0] ?? ""),
  );

  // Git
  const [gitProvider, setGitProvider] = createSignal<GitProvider>("skip");
  const [gitRemoteUrl, setGitRemoteUrl] = createSignal("");
  const [gitlabUrl, setGitlabUrl] = createSignal(
    settings.getInfra().gitlabUrl ?? "https://gitlab.com",
  );
  const [gitlabToken, setGitlabToken] = createSignal("");

  // GitHub OAuth
  const [ghConnecting, setGhConnecting] = createSignal(false);
  const [ghConnected, setGhConnected] = createSignal(false);
  const [ghCode, setGhCode] = createSignal<AuthCodeEvent | null>(null);
  const [ghError, setGhError] = createSignal<string | null>(null);
  let unlistenCode: (() => void) | null = null;
  let unlistenDone: (() => void) | null = null;

  // Saving
  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  onCleanup(() => {
    unlistenCode?.();
    unlistenDone?.();
  });

  // ── Browse dialogs ─────────────────────────────────────────────────────────

  async function browseNotes() {
    const dir = await openDialog({ directory: true, defaultPath: notesDir() || undefined });
    if (dir && typeof dir === "string") setNotesDir(dir);
  }

  async function browseWorkspace() {
    const dir = await openDialog({ directory: true, defaultPath: workspaceDir() || undefined });
    if (dir && typeof dir === "string") setWorkspaceDir(dir);
  }

  // ── GitHub OAuth ───────────────────────────────────────────────────────────

  async function startGithubAuth() {
    setGhConnecting(true);
    setGhError(null);
    setGhCode(null);
    setGhConnected(false);

    unlistenCode = await devopsCliService.onAuthCode("gh", (e) => {
      setGhCode(e);
    });
    unlistenDone = await devopsCliService.onAuthDone("gh", (e) => {
      setGhConnecting(false);
      if (e.success) {
        setGhConnected(true);
        setGhCode(null);
      } else {
        setGhError(e.error || "Authentication failed");
      }
    });

    try {
      await devopsCliService.authLogin("gh");
    } catch (e) {
      setGhConnecting(false);
      setGhError(e instanceof Error ? e.message : String(e));
    }
  }

  // ── Save & finish ──────────────────────────────────────────────────────────

  async function finish() {
    setSaving(true);
    setSaveError(null);

    try {
      // 1. Workspace root
      settings.patchWorkspace({ rootDirs: [workspaceDir()].filter(Boolean) });

      // 2. Git remote URL
      let remote = "";
      if (gitProvider() === "github" || gitProvider() === "custom") {
        remote = gitRemoteUrl();
      } else if (gitProvider() === "gitlab") {
        remote = gitRemoteUrl();
        // Persist GitLab URL in infra settings (token goes to vault when unlocked)
        if (gitlabUrl()) settings.patchInfra({ gitlabUrl: gitlabUrl() });
        if (gitlabToken()) {
          try {
            await invoke("secrets_set_app_secret", {
              key: "gitlab_token",
              value: gitlabToken(),
            });
          } catch {
            // Vault may not be unlocked yet — user can add token in Settings > Infrastructure
          }
        }
      }

      // 3. Notes path + git remote (best-effort — vault may not be ready)
      if (notesDir()) {
        try {
          await invoke("notes_set_config", {
            path: notesDir(),
            remote,
            sshKeyName: null,
          });
        } catch {
          // Non-fatal: user can configure in Settings > Notes
        }
      }

      // 4. Mark onboarding complete
      localStorage.setItem("onboarding-complete", "1");

      setStep("done");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goNext() {
    if (step() === "folders") setStep("git");
    else if (step() === "git") void finish();
  }

  function goBack() {
    if (step() === "git") setStep("folders");
  }

  // ── Current step index for dots ────────────────────────────────────────────
  const stepIdx = () => STEPS.indexOf(step());

  // ── Computed git remote placeholder ───────────────────────────────────────
  const remotePlaceholder = () => {
    if (gitProvider() === "github") return "git@github.com:username/notes.git";
    if (gitProvider() === "gitlab") return `git@${new URL(gitlabUrl() || "https://gitlab.com").hostname}:username/notes.git`;
    return t("firstRun.gitRemotePlaceholder");
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    /* Overlay */
    <div style={{
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.7)",
      "backdrop-filter": "blur(4px)",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "z-index": "9999",
    }}>
      {/* Card */}
      <div style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border-color)",
        "border-radius": "12px",
        width: "520px",
        "max-width": "calc(100vw - 40px)",
        "max-height": "calc(100vh - 60px)",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
        "box-shadow": "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px 20px",
          "border-bottom": "1px solid var(--border-color)",
        }}>
          <div style={{ "font-size": "18px", "font-weight": "600", "margin-bottom": "16px" }}>
            {t("firstRun.title")}
          </div>
          {/* Step indicator */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <StepDot active={step() === "folders"} done={stepIdx() > 0} />
            <span style={{ "font-size": "11px", color: step() === "folders" ? "var(--text-primary)" : "var(--text-muted)" }}>
              {t("firstRun.stepFolders")}
            </span>
            <span style={{ flex: "1", height: "1px", background: "var(--border-color)" }} />
            <StepDot active={step() === "git"} done={stepIdx() > 1} />
            <span style={{ "font-size": "11px", color: step() === "git" ? "var(--text-primary)" : "var(--text-muted)" }}>
              {t("firstRun.stepGit")}
            </span>
            <span style={{ flex: "1", height: "1px", background: "var(--border-color)" }} />
            <StepDot active={step() === "done"} done={false} />
            <span style={{ "font-size": "11px", color: step() === "done" ? "var(--text-primary)" : "var(--text-muted)" }}>
              {t("firstRun.stepDone")}
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: "1", "overflow-y": "auto", padding: "24px 28px" }}>

          {/* ── Step 1: Folders ───────────────────────────────────────────── */}
          <Show when={step() === "folders"}>
            <h3 style={{ margin: "0 0 8px", "font-size": "15px" }}>
              {t("firstRun.foldersTitle")}
            </h3>
            <p style={{ margin: "0 0 20px", "font-size": "13px", color: "var(--text-muted)", "line-height": "1.5" }}>
              {t("firstRun.foldersDesc")}
            </p>

            {/* Notes dir */}
            <div style={{ "margin-bottom": "16px" }}>
              <label style={{ display: "block", "font-size": "13px", "font-weight": "500", "margin-bottom": "4px" }}>
                {t("firstRun.notesDir")}
              </label>
              <p style={{ margin: "0 0 6px", "font-size": "12px", color: "var(--text-muted)" }}>
                {t("firstRun.notesDirHint")}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={notesDir()}
                  onInput={(e) => setNotesDir(e.currentTarget.value)}
                  style={{
                    flex: "1",
                    padding: "7px 10px",
                    "border-radius": "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    "font-size": "13px",
                    "font-family": "monospace",
                  }}
                />
                <button
                  onClick={browseNotes}
                  style={{
                    padding: "7px 12px",
                    "border-radius": "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-muted)",
                    "font-size": "12px",
                    cursor: "pointer",
                    "white-space": "nowrap",
                  }}
                >
                  {t("firstRun.browse")}
                </button>
              </div>
            </div>

            {/* Workspace dir */}
            <div>
              <label style={{ display: "block", "font-size": "13px", "font-weight": "500", "margin-bottom": "4px" }}>
                {t("firstRun.workspaceDir")}
              </label>
              <p style={{ margin: "0 0 6px", "font-size": "12px", color: "var(--text-muted)" }}>
                {t("firstRun.workspaceDirHint")}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={workspaceDir()}
                  onInput={(e) => setWorkspaceDir(e.currentTarget.value)}
                  style={{
                    flex: "1",
                    padding: "7px 10px",
                    "border-radius": "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    "font-size": "13px",
                    "font-family": "monospace",
                  }}
                />
                <button
                  onClick={browseWorkspace}
                  style={{
                    padding: "7px 12px",
                    "border-radius": "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-muted)",
                    "font-size": "12px",
                    cursor: "pointer",
                    "white-space": "nowrap",
                  }}
                >
                  {t("firstRun.browse")}
                </button>
              </div>
            </div>
          </Show>

          {/* ── Step 2: Git ───────────────────────────────────────────────── */}
          <Show when={step() === "git"}>
            <h3 style={{ margin: "0 0 8px", "font-size": "15px" }}>
              {t("firstRun.gitTitle")}
            </h3>
            <p style={{ margin: "0 0 20px", "font-size": "13px", color: "var(--text-muted)", "line-height": "1.5" }}>
              {t("firstRun.gitDesc")}
            </p>

            {/* Provider selector */}
            <div style={{ display: "flex", gap: "8px", "margin-bottom": "20px", "flex-wrap": "wrap" }}>
              {(["skip", "github", "gitlab", "custom"] as GitProvider[]).map((p) => (
                <button
                  onClick={() => setGitProvider(p)}
                  style={{
                    padding: "7px 14px",
                    "border-radius": "20px",
                    border: `1px solid ${gitProvider() === p ? "var(--accent, #3498db)" : "var(--border-color)"}`,
                    background: gitProvider() === p ? "var(--accent, #3498db)" : "transparent",
                    color: gitProvider() === p ? "white" : "var(--text-muted)",
                    "font-size": "13px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {p === "skip" ? t("firstRun.gitSkip")
                   : p === "github" ? t("firstRun.gitGithub")
                   : p === "gitlab" ? t("firstRun.gitGitlab")
                   : t("firstRun.gitCustom")}
                </button>
              ))}
            </div>

            {/* GitHub OAuth flow */}
            <Show when={gitProvider() === "github"}>
              <Show when={!ghConnected()}>
                <Show when={ghCode()}>
                  {(code) => (
                    <div style={{
                      padding: "16px",
                      "border-radius": "8px",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-elevated)",
                      "margin-bottom": "12px",
                    }}>
                      <p style={{ margin: "0 0 8px", "font-size": "13px" }}>
                        {t("firstRun.gitWaitingCode")}
                      </p>
                      <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
                        <code style={{
                          "font-size": "22px",
                          "font-weight": "700",
                          "letter-spacing": "4px",
                          color: "var(--accent, #3498db)",
                        }}>
                          {code().user_code}
                        </code>
                        <a
                          href={code().verification_uri}
                          target="_blank"
                          rel="noreferrer"
                          style={{ "font-size": "12px", color: "var(--accent, #3498db)" }}
                        >
                          {t("firstRun.gitOpenBrowser")} ↗
                        </a>
                      </div>
                    </div>
                  )}
                </Show>
                <button
                  onClick={startGithubAuth}
                  disabled={ghConnecting()}
                  style={{
                    padding: "9px 18px",
                    "border-radius": "6px",
                    border: "none",
                    background: "var(--accent, #3498db)",
                    color: "white",
                    "font-size": "13px",
                    cursor: ghConnecting() ? "not-allowed" : "pointer",
                    opacity: ghConnecting() ? "0.7" : "1",
                  }}
                >
                  {ghConnecting() ? t("firstRun.gitConnecting") : t("firstRun.gitConnectGithub")}
                </button>
              </Show>
              <Show when={ghConnected()}>
                <div style={{ display: "flex", "align-items": "center", gap: "8px", color: "var(--success, #2ecc71)" }}>
                  <span>✓</span>
                  <span style={{ "font-size": "13px" }}>{t("firstRun.gitConnected")}</span>
                </div>
              </Show>
              <Show when={ghError()}>
                <p style={{ color: "var(--danger, #e74c3c)", "font-size": "13px", "margin-top": "8px" }}>
                  {ghError()}
                </p>
              </Show>

              {/* Remote URL for GitHub */}
              <div style={{ "margin-top": "16px" }}>
                <label style={{ display: "block", "font-size": "13px", "font-weight": "500", "margin-bottom": "4px" }}>
                  {t("firstRun.gitRemoteUrl")}
                </label>
                <input
                  type="text"
                  value={gitRemoteUrl()}
                  onInput={(e) => setGitRemoteUrl(e.currentTarget.value)}
                  placeholder={remotePlaceholder()}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    "border-radius": "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    "font-size": "13px",
                    "box-sizing": "border-box",
                    "font-family": "monospace",
                  }}
                />
              </div>
            </Show>

            {/* GitLab form */}
            <Show when={gitProvider() === "gitlab"}>
              <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", "font-size": "13px", "font-weight": "500", "margin-bottom": "4px" }}>
                    {t("firstRun.gitlabUrl")}
                  </label>
                  <input
                    type="text"
                    value={gitlabUrl()}
                    onInput={(e) => setGitlabUrl(e.currentTarget.value)}
                    placeholder="https://gitlab.com"
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      "border-radius": "6px",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      "font-size": "13px",
                      "box-sizing": "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", "font-size": "13px", "font-weight": "500", "margin-bottom": "4px" }}>
                    {t("firstRun.gitlabToken")}
                  </label>
                  <input
                    type="password"
                    value={gitlabToken()}
                    onInput={(e) => setGitlabToken(e.currentTarget.value)}
                    placeholder="glpat-xxxxxxxxxxxx"
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      "border-radius": "6px",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      "font-size": "13px",
                      "box-sizing": "border-box",
                      "font-family": "monospace",
                    }}
                  />
                  <p style={{ margin: "4px 0 0", "font-size": "11px", color: "var(--text-muted)" }}>
                    {t("firstRun.gitlabTokenHint")}
                  </p>
                </div>
                <div>
                  <label style={{ display: "block", "font-size": "13px", "font-weight": "500", "margin-bottom": "4px" }}>
                    {t("firstRun.gitRemoteUrl")}
                  </label>
                  <input
                    type="text"
                    value={gitRemoteUrl()}
                    onInput={(e) => setGitRemoteUrl(e.currentTarget.value)}
                    placeholder={remotePlaceholder()}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      "border-radius": "6px",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      "font-size": "13px",
                      "box-sizing": "border-box",
                      "font-family": "monospace",
                    }}
                  />
                </div>
              </div>
            </Show>

            {/* Custom URL */}
            <Show when={gitProvider() === "custom"}>
              <div>
                <label style={{ display: "block", "font-size": "13px", "font-weight": "500", "margin-bottom": "4px" }}>
                  {t("firstRun.gitRemoteUrl")}
                </label>
                <input
                  type="text"
                  value={gitRemoteUrl()}
                  onInput={(e) => setGitRemoteUrl(e.currentTarget.value)}
                  placeholder={t("firstRun.gitRemotePlaceholder")}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    "border-radius": "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    "font-size": "13px",
                    "box-sizing": "border-box",
                    "font-family": "monospace",
                  }}
                />
              </div>
            </Show>
          </Show>

          {/* ── Step 3: Done ──────────────────────────────────────────────── */}
          <Show when={step() === "done"}>
            <div style={{ "text-align": "center", padding: "8px 0 16px" }}>
              <div style={{ "font-size": "40px", "margin-bottom": "12px" }}>🎉</div>
              <h3 style={{ margin: "0 0 8px", "font-size": "17px" }}>
                {t("firstRun.doneTitle")}
              </h3>
              <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
                {t("firstRun.doneDesc")}
              </p>
            </div>

            {/* Summary */}
            <div style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)",
              "border-radius": "8px",
              padding: "16px",
              display: "flex",
              "flex-direction": "column",
              gap: "10px",
            }}>
              <div style={{ display: "flex", gap: "12px", "align-items": "flex-start" }}>
                <span style={{ "font-size": "13px", "font-weight": "500", "min-width": "120px", color: "var(--text-muted)" }}>
                  {t("firstRun.doneNotesDir")}
                </span>
                <code style={{ "font-size": "12px", color: "var(--text-primary)", "word-break": "break-all" }}>
                  {notesDir() || "—"}
                </code>
              </div>
              <div style={{ display: "flex", gap: "12px", "align-items": "flex-start" }}>
                <span style={{ "font-size": "13px", "font-weight": "500", "min-width": "120px", color: "var(--text-muted)" }}>
                  {t("firstRun.doneWorkspaceDir")}
                </span>
                <code style={{ "font-size": "12px", color: "var(--text-primary)", "word-break": "break-all" }}>
                  {workspaceDir() || "—"}
                </code>
              </div>
              <div style={{ display: "flex", gap: "12px", "align-items": "flex-start" }}>
                <span style={{ "font-size": "13px", "font-weight": "500", "min-width": "120px", color: "var(--text-muted)" }}>
                  {t("firstRun.doneGit")}
                </span>
                <code style={{ "font-size": "12px", color: "var(--text-primary)", "word-break": "break-all" }}>
                  {gitRemoteUrl() || (gitProvider() === "github" && ghConnected() ? "github" : t("firstRun.doneGitNone"))}
                </code>
              </div>
            </div>
          </Show>

          {/* Save error */}
          <Show when={saveError()}>
            <p style={{ color: "var(--danger, #e74c3c)", "font-size": "13px", "margin-top": "12px" }}>
              {saveError()}
            </p>
          </Show>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 28px",
          "border-top": "1px solid var(--border-color)",
          display: "flex",
          "justify-content": "space-between",
          "align-items": "center",
        }}>
          {/* Back */}
          <Show when={step() === "git"}>
            <button
              onClick={goBack}
              style={{
                padding: "8px 16px",
                "border-radius": "6px",
                border: "1px solid var(--border-color)",
                background: "transparent",
                color: "var(--text-muted)",
                "font-size": "13px",
                cursor: "pointer",
              }}
            >
              {t("firstRun.back")}
            </button>
          </Show>
          <Show when={step() !== "git"}>
            <span />
          </Show>

          {/* Next / Start */}
          <Show when={step() !== "done"}>
            <button
              onClick={goNext}
              disabled={saving()}
              style={{
                padding: "8px 20px",
                "border-radius": "6px",
                border: "none",
                background: "var(--accent, #3498db)",
                color: "white",
                "font-size": "13px",
                "font-weight": "500",
                cursor: saving() ? "not-allowed" : "pointer",
                opacity: saving() ? "0.7" : "1",
              }}
            >
              {saving() ? "…" : t("firstRun.next")}
            </button>
          </Show>
          <Show when={step() === "done"}>
            <button
              onClick={props.onClose}
              style={{
                padding: "8px 24px",
                "border-radius": "6px",
                border: "none",
                background: "var(--accent, #3498db)",
                color: "white",
                "font-size": "14px",
                "font-weight": "600",
                cursor: "pointer",
              }}
            >
              {t("firstRun.start")}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
