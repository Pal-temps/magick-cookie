import { Show, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { PermissionRequest } from "../../../application/stores/aiSessionStore";
import { DiffPreview } from "./DiffPreview";

interface PermissionBannerProps {
  permission: PermissionRequest;
  onAllow: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}

function formatToolInput(input: unknown): string {
  if (!input) return "";
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (obj.command) return String(obj.command);
    if (obj.file_path || obj.path) return String(obj.file_path ?? obj.path);
    if (obj.pattern) return `pattern: ${obj.pattern}`;
    return JSON.stringify(input, null, 2).slice(0, 200);
  }
  return String(input);
}

function isWriteTool(toolName: string): boolean {
  const n = toolName.toLowerCase();
  return n === "write" || n.includes("write") || n === "edit" || n.includes("edit");
}

function getFilePath(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  return (obj.file_path ?? obj.path ?? null) as string | null;
}

function getNewContent(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  return (obj.content ?? obj.new_string ?? null) as string | null;
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", json: "json",
    md: "markdown", css: "css", html: "html", rs: "rust", py: "python",
    go: "go", yaml: "yaml", yml: "yaml", toml: "ini", sql: "sql",
  };
  return map[ext] ?? "plaintext";
}

export function PermissionBanner(props: PermissionBannerProps) {
  const perm = () => props.permission;
  const [showDiff, setShowDiff] = createSignal(false);
  const [originalContent, setOriginalContent] = createSignal<string | null>(null);

  const canShowDiff = () => isWriteTool(perm().toolName) && getFilePath(perm().toolInput) && getNewContent(perm().toolInput);

  async function toggleDiff() {
    if (showDiff()) {
      setShowDiff(false);
      return;
    }

    const filePath = getFilePath(perm().toolInput);
    if (!filePath) return;

    // Try to read the current file content
    try {
      const content = await invoke<string>("fs_read_file", { path: filePath });
      setOriginalContent(content);
    } catch {
      setOriginalContent(""); // New file
    }
    setShowDiff(true);
  }

  return (
    <div class="ide-permission-banner">
      <div class="ide-permission-banner__header">
        <span>&#x26A0;&#xFE0F;</span>
        <span>{perm().toolName}</span>
        <Show when={getFilePath(perm().toolInput)}>
          <span style={{ "font-family": "monospace", "font-size": "11px", "margin-left": "4px", color: "var(--text-muted)" }}>
            {getFilePath(perm().toolInput)}
          </span>
        </Show>
      </div>
      <div class="ide-permission-banner__body">
        <Show when={perm().description}>
          <div style={{ "margin-bottom": "6px" }}>{perm().description}</div>
        </Show>
        <Show when={!canShowDiff()}>
          <div style={{ "font-family": "monospace", "font-size": "11px", color: "var(--text-muted)", "white-space": "pre-wrap", "max-height": "100px", "overflow-y": "auto" }}>
            {formatToolInput(perm().toolInput)}
          </div>
        </Show>
      </div>

      {/* Diff preview for Write/Edit tools */}
      <Show when={canShowDiff()}>
        <div style={{ padding: "0 10px 8px" }}>
          <button
            onClick={toggleDiff}
            style={{
              padding: "3px 8px", "font-size": "11px", background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)", "border-radius": "var(--radius-sm)",
              color: "var(--text-secondary)", cursor: "pointer", "margin-bottom": "6px",
            }}
          >{showDiff() ? "Masquer le diff" : "Voir le diff"}</button>
          <Show when={showDiff() && originalContent() !== null}>
            <DiffPreview
              original={originalContent()!}
              modified={getNewContent(perm().toolInput) ?? ""}
              language={detectLanguage(getFilePath(perm().toolInput) ?? "")}
            />
          </Show>
        </div>
      </Show>

      <div class="ide-permission-banner__actions">
        <button
          class="ide-permission-banner__btn ide-permission-banner__btn--allow"
          onClick={() => props.onAllow(perm().requestId)}
        >Autoriser</button>
        <button
          class="ide-permission-banner__btn ide-permission-banner__btn--deny"
          onClick={() => props.onDeny(perm().requestId)}
        >Refuser</button>
      </div>
    </div>
  );
}
