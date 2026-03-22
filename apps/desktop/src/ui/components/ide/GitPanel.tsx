import { createSignal, For, Show, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

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
  const [files, setFiles] = createSignal<GitFileStatus[]>([]);
  const [log, setLog] = createSignal<GitLogEntry[]>([]);
  const [commitMsg, setCommitMsg] = createSignal("");
  const [isRepo, setIsRepo] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [showLog, setShowLog] = createSignal(false);

  const staged = () => files().filter((f) => f.staged);
  const unstaged = () => files().filter((f) => !f.staged);

  async function refresh() {
    if (!props.projectPath) return;
    setLoading(true);
    try {
      const repo = await invoke<boolean>("git_is_repo", { projectPath: props.projectPath });
      setIsRepo(repo);
      if (!repo) return;

      const status = await invoke<GitFileStatus[]>("git_status", { projectPath: props.projectPath });
      setFiles(status);

      if (showLog()) {
        const entries = await invoke<GitLogEntry[]>("git_log", { projectPath: props.projectPath, limit: 20 });
        setLog(entries);
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
    await invoke("git_stage", { projectPath: props.projectPath, files: [path] });
    await refresh();
  }

  async function unstageFile(path: string) {
    if (!props.projectPath) return;
    await invoke("git_unstage", { projectPath: props.projectPath, files: [path] });
    await refresh();
  }

  async function stageAll() {
    if (!props.projectPath) return;
    const paths = unstaged().map((f) => f.path);
    if (paths.length === 0) return;
    await invoke("git_stage", { projectPath: props.projectPath, files: paths });
    await refresh();
  }

  async function unstageAll() {
    if (!props.projectPath) return;
    const paths = staged().map((f) => f.path);
    if (paths.length === 0) return;
    await invoke("git_unstage", { projectPath: props.projectPath, files: paths });
    await refresh();
  }

  async function discardFile(path: string) {
    if (!props.projectPath) return;
    await invoke("git_discard", { projectPath: props.projectPath, files: [path] });
    await refresh();
  }

  async function commit() {
    if (!props.projectPath || !commitMsg().trim()) return;
    try {
      await invoke("git_commit", { projectPath: props.projectPath, message: commitMsg().trim() });
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
      const entries = await invoke<GitLogEntry[]>("git_log", { projectPath: props.projectPath, limit: 20 });
      setLog(entries);
    } catch {}
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
        SOURCE CONTROL
        <span style={{ "margin-left": "auto", display: "flex", gap: "4px" }}>
          <button style={btnSmall} onClick={() => refresh()} title="Rafraichir">↻</button>
          <button style={btnSmall} onClick={() => toggleLog()} title="Historique">{showLog() ? "✕" : "☰"}</button>
        </span>
      </div>

      <Show when={!props.projectPath}>
        <div style={{ padding: "16px", color: "var(--text-muted)", "font-size": "12px", "text-align": "center" }}>
          Aucun projet ouvert
        </div>
      </Show>

      <Show when={props.projectPath && !isRepo()}>
        <div style={{ padding: "16px", color: "var(--text-muted)", "font-size": "12px", "text-align": "center" }}>
          Ce dossier n'est pas un depot git
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
              placeholder="Message de commit (Ctrl+Enter)"
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
                STAGED ({staged().length})
                <button style={{ ...btnSmall, "margin-left": "auto" }} onClick={unstageAll}>− Tout</button>
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
                CHANGES ({unstaged().length})
                <button style={{ ...btnSmall, "margin-left": "auto" }} onClick={stageAll}>+ Tout</button>
              </div>
              <For each={unstaged()}>
                {(file) => (
                  <div style={itemStyle} class="ide-tree-file">
                    <span style={{ color: statusColor(file.status), "font-weight": "700", width: "14px", "font-size": "11px" }}>{file.status}</span>
                    <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-primary)" }}>{file.path}</span>
                    <Show when={file.status !== "?"}>
                      <button style={btnSmall} onClick={() => discardFile(file.path)} title="Annuler les modifications">↩</button>
                    </Show>
                    <button style={btnSmall} onClick={() => stageFile(file.path)} title="Stage">+</button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={staged().length === 0 && unstaged().length === 0 && !loading()}>
            <div style={{ padding: "16px", "text-align": "center", color: "var(--text-muted)", "font-size": "12px" }}>
              Aucun changement
            </div>
          </Show>

          {/* Git log */}
          <Show when={showLog()}>
            <div>
              <div style={{
                padding: "6px 8px", "font-size": "11px", "font-weight": "600",
                color: "var(--text-muted)", "border-bottom": "1px solid var(--border-color)",
              }}>
                HISTORIQUE
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
