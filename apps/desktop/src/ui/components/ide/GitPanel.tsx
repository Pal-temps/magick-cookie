import { createSignal, For, Show, onMount } from "solid-js";
import { useT } from "../../../i18n/context";
import {
  gitService,
  type GitFileStatus,
  type GitLogEntry,
  type GitBranch,
} from "../../../application/services/gitService";

interface GitPanelProps {
  projectPath: string | null;
  onOpenDiff?: (path: string) => void;
}

function statusColor(status: string): string {
  switch (status) {
    case "M": return "var(--accent-secondary)";
    case "A": return "var(--success)";
    case "D": return "var(--danger)";
    case "?": return "var(--text-muted)";
    default: return "var(--text-secondary)";
  }
}

export function GitPanel(props: GitPanelProps) {
  const { t } = useT();
  const [files, setFiles] = createSignal<GitFileStatus[]>([]);
  const [log, setLog] = createSignal<GitLogEntry[]>([]);
  const [commitMsg, setCommitMsg] = createSignal("");
  const [isRepo, setIsRepo] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [showLog, setShowLog] = createSignal(false);
  const [branches, setBranches] = createSignal<GitBranch[]>([]);
  const [showBranches, setShowBranches] = createSignal(false);

  const staged = () => files().filter((f) => f.staged);
  const unstaged = () => files().filter((f) => !f.staged);
  const currentBranch = () => branches().find((b) => b.is_current)?.name ?? "";

  async function refresh() {
    if (!props.projectPath) return;
    const path = props.projectPath;
    setLoading(true);
    try {
      const repo = await gitService.isRepo(path);
      setIsRepo(repo);
      if (!repo) return;

      setFiles(await gitService.status(path));
      setBranches(await gitService.branches(path));

      if (showLog()) {
        setLog(await gitService.log(path));
      }
    } catch (e) {
      console.error("git refresh error:", e);
    } finally {
      setLoading(false);
    }
  }

  onMount(() => refresh());

  async function stageFile(path: string) {
    if (!props.projectPath) return;
    await gitService.stage(props.projectPath, [path]);
    await refresh();
  }

  async function unstageFile(path: string) {
    if (!props.projectPath) return;
    await gitService.unstage(props.projectPath, [path]);
    await refresh();
  }

  async function stageAll() {
    if (!props.projectPath) return;
    const paths = unstaged().map((f) => f.path);
    if (paths.length === 0) return;
    await gitService.stage(props.projectPath, paths);
    await refresh();
  }

  async function unstageAll() {
    if (!props.projectPath) return;
    const paths = staged().map((f) => f.path);
    if (paths.length === 0) return;
    await gitService.unstage(props.projectPath, paths);
    await refresh();
  }

  async function discardFile(path: string) {
    if (!props.projectPath) return;
    await gitService.discard(props.projectPath, [path]);
    await refresh();
  }

  async function commit() {
    if (!props.projectPath || !commitMsg().trim()) return;
    try {
      await gitService.commit(props.projectPath, commitMsg().trim());
      setCommitMsg("");
      await refresh();
    } catch (e) {
      console.error("git commit error:", e);
    }
  }

  async function toggleLog() {
    setShowLog((v) => !v);
    if (!showLog()) return;
    if (!props.projectPath) return;
    try {
      setLog(await gitService.log(props.projectPath));
    } catch {}
  }

  async function gitPull() {
    if (!props.projectPath) return;
    try {
      await gitService.pull(props.projectPath);
      await refresh();
    } catch (e) { console.error("git pull error:", e); }
  }

  async function gitPush() {
    if (!props.projectPath) return;
    try {
      await gitService.push(props.projectPath);
      await refresh();
    } catch (e) { console.error("git push error:", e); }
  }

  async function checkoutBranch(branch: string) {
    if (!props.projectPath) return;
    try {
      await gitService.checkout(props.projectPath, branch);
      setShowBranches(false);
      await refresh();
    } catch (e) { console.error("git checkout error:", e); }
  }

  const itemStyle = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "3px 8px",
    "font-size": "12px",
    cursor: "pointer",
  };

  const btnSmall = {
    padding: "2px 6px",
    "font-size": "10px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-color)",
    "border-radius": "3px",
    color: "var(--text-secondary)",
    cursor: "pointer",
  };

  return (
    <div class="ide-explorer" style={{ display: "flex", "flex-direction": "column" }}>
      <div class="ide-explorer__header" style={{ display: "flex", "align-items": "center" }}>
        {t("ide.sourceControl")}
        <span style={{ "margin-left": "auto", display: "flex", gap: "4px" }}>
          <button style={btnSmall} onClick={() => gitPull()} title="Pull">↓</button>
          <button style={btnSmall} onClick={() => gitPush()} title="Push">↑</button>
          <button style={btnSmall} onClick={() => refresh()} title={t("common.refresh")}>↻</button>
          <button style={btnSmall} onClick={() => toggleLog()} title={t("ide.historyLabel")}>{showLog() ? "✕" : "☰"}</button>
        </span>
      </div>

      {/* Branch selector */}
      <Show when={props.projectPath && isRepo() && branches().length > 0}>
        <div style={{ padding: "4px 8px", "border-bottom": "1px solid var(--border-color)", position: "relative" }}>
          <button
            style={{ ...btnSmall, width: "100%", "text-align": "left", display: "flex", "align-items": "center", gap: "4px" }}
            onClick={() => setShowBranches((v) => !v)}
          >
            <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{currentBranch()}</span>
            <span style={{ "font-size": "8px" }}>{showBranches() ? "▴" : "▾"}</span>
          </button>
          <Show when={showBranches()}>
            <div style={{
              position: "absolute", left: "8px", right: "8px", top: "100%", "z-index": "100",
              background: "var(--bg-surface)", border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-md)", "box-shadow": "0 4px 16px rgba(0,0,0,0.3)",
              "max-height": "200px", "overflow-y": "auto",
            }}>
              <For each={branches().filter((b) => !b.is_remote)}>
                {(branch) => (
                  <div
                    onClick={() => checkoutBranch(branch.name)}
                    style={{
                      padding: "4px 8px", "font-size": "11px", cursor: "pointer",
                      background: branch.is_current ? "var(--accent-primary)" : "transparent",
                      color: branch.is_current ? "#fff" : "var(--text-primary)",
                    }}
                    onMouseEnter={(e) => { if (!branch.is_current) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                    onMouseLeave={(e) => { if (!branch.is_current) e.currentTarget.style.background = "transparent"; }}
                  >{branch.name}</div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={!props.projectPath}>
        <div style={{ padding: "16px", color: "var(--text-muted)", "font-size": "12px", "text-align": "center" }}>
          {t("ide.noProjectOpen")}
        </div>
      </Show>

      <Show when={props.projectPath && !isRepo()}>
        <div style={{ padding: "16px", color: "var(--text-muted)", "font-size": "12px", "text-align": "center" }}>
          {t("ide.notGitRepo")}
        </div>
      </Show>

      <Show when={props.projectPath && isRepo()}>
        <div style={{ flex: "1", "overflow-y": "auto" }}>
          {/* Commit input */}
          <div style={{ padding: "8px", "border-bottom": "1px solid var(--border-color)" }}>
            <input
              value={commitMsg()}
              onInput={(e) => setCommitMsg(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit(); }}
              placeholder={t("ide.commitPlaceholder")}
              style={{
                width: "100%", padding: "6px 8px", "font-size": "12px",
                background: "var(--bg-base)", border: "1px solid var(--border-color)",
                "border-radius": "var(--radius-sm)", color: "var(--text-primary)",
                outline: "none", "box-sizing": "border-box",
              }}
            />
            <button
              onClick={() => commit()}
              disabled={!commitMsg().trim() || staged().length === 0}
              style={{
                "margin-top": "6px", width: "100%", padding: "5px",
                "font-size": "12px", background: "var(--accent-primary)",
                border: "none", "border-radius": "var(--radius-sm)",
                color: "#fff", cursor: commitMsg().trim() && staged().length > 0 ? "pointer" : "not-allowed",
                opacity: commitMsg().trim() && staged().length > 0 ? "1" : "0.5",
              }}
            >Commit ({staged().length})</button>
          </div>

          {/* Staged changes */}
          <Show when={staged().length > 0}>
            <div style={{ "border-bottom": "1px solid var(--border-color)" }}>
              <div style={{
                display: "flex", "align-items": "center", padding: "6px 8px",
                "font-size": "11px", "font-weight": "600", color: "var(--text-muted)",
              }}>
                {t("ide.staged")} ({staged().length})
                <button style={{ ...btnSmall, "margin-left": "auto" }} onClick={unstageAll}>− {t("ide.all")}</button>
              </div>
              <For each={staged()}>
                {(file) => (
                  <div style={itemStyle} class="ide-tree-file">
                    <span style={{ color: statusColor(file.status), "font-weight": "700", width: "14px", "font-size": "11px" }}>{file.status}</span>
                    <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-primary)" }}>{file.path}</span>
                    <button style={btnSmall} onClick={() => unstageFile(file.path)} title="Unstage">−</button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Unstaged changes */}
          <Show when={unstaged().length > 0}>
            <div style={{ "border-bottom": "1px solid var(--border-color)" }}>
              <div style={{
                display: "flex", "align-items": "center", padding: "6px 8px",
                "font-size": "11px", "font-weight": "600", color: "var(--text-muted)",
              }}>
                {t("ide.changes")} ({unstaged().length})
                <button style={{ ...btnSmall, "margin-left": "auto" }} onClick={stageAll}>+ {t("ide.all")}</button>
              </div>
              <For each={unstaged()}>
                {(file) => (
                  <div style={itemStyle} class="ide-tree-file">
                    <span style={{ color: statusColor(file.status), "font-weight": "700", width: "14px", "font-size": "11px" }}>{file.status}</span>
                    <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-primary)" }}>{file.path}</span>
                    <Show when={file.status !== "?"}>
                      <button style={btnSmall} onClick={() => discardFile(file.path)} title={t("ide.discardChanges")}>↩</button>
                    </Show>
                    <button style={btnSmall} onClick={() => stageFile(file.path)} title="Stage">+</button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={staged().length === 0 && unstaged().length === 0 && !loading()}>
            <div style={{ padding: "16px", "text-align": "center", color: "var(--text-muted)", "font-size": "12px" }}>
              {t("ide.noChanges")}
            </div>
          </Show>

          {/* Git log */}
          <Show when={showLog()}>
            <div>
              <div style={{
                padding: "6px 8px", "font-size": "11px", "font-weight": "600",
                color: "var(--text-muted)", "border-bottom": "1px solid var(--border-color)",
              }}>
                {t("ide.historyLabel")}
              </div>
              <For each={log()}>
                {(entry) => (
                  <div style={{
                    padding: "4px 8px", "font-size": "11px", "border-bottom": "1px solid var(--border-color)",
                    display: "flex", "flex-direction": "column", gap: "1px",
                  }}>
                    <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
                      <span style={{ color: "var(--accent-primary)", "font-family": "monospace", "font-size": "10px" }}>{entry.hash}</span>
                      <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-primary)" }}>{entry.message}</span>
                    </div>
                    <div style={{ "font-size": "10px", color: "var(--text-muted)" }}>
                      {entry.author} · {entry.date.split(" ")[0]}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
