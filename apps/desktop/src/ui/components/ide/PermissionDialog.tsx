/**
 * PermissionDialog
 *
 * Polls the API for pending Claude CLI permission requests and surfaces them
 * as a modal dialog so the user can Allow or Deny.
 *
 * Architecture:
 *   Claude CLI → MCP permission server (Bun stdio)
 *     → POST /api/ai/permissions  (create)
 *     → GET  /api/ai/permissions/:id  (long-poll until resolved)
 *   This component:
 *     → GET  /api/ai/permissions  (poll for pending)
 *     → POST /api/ai/permissions/:id/resolve  (user decision)
 */

import { createSignal, onCleanup, Show } from "solid-js";
import { API_BASE } from "../../../infrastructure/config";
import { useAiSessionStore } from "../../../application/stores/aiSessionStore";

interface PendingPermission {
  id: string;
  session_id: string;
  tool_name: string;
  tool_input: unknown;
  created_at: number;
}

// ─── Polling ──────────────────────────────────────────────────────────────────

/**
 * Fetch pending permissions for a specific session.
 * Passing the session_id prevents cross-contamination when multiple
 * Cookia windows are open at the same time.
 */
async function fetchPending(sessionId: string | null): Promise<PendingPermission[]> {
  try {
    const url = sessionId
      ? `${API_BASE}/ai/permissions?session_id=${encodeURIComponent(sessionId)}`
      : `${API_BASE}/ai/permissions`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { data: PendingPermission[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

async function resolvePermission(id: string, behavior: "allow" | "deny"): Promise<void> {
  await fetch(`${API_BASE}/ai/permissions/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ behavior }),
  });
}

// ─── Tool input display ───────────────────────────────────────────────────────

function formatToolInput(input: unknown): string {
  if (!input) return "—";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

/** Map Claude tool names to human-readable labels */
function toolLabel(name: string): string {
  const map: Record<string, string> = {
    Write: "Écrire un fichier",
    Edit: "Modifier un fichier",
    Bash: "Exécuter une commande",
    WebFetch: "Accès réseau",
    WebSearch: "Recherche web",
    Read: "Lire un fichier",
    Glob: "Lister des fichiers",
  };
  return map[name] ?? name;
}

/** Extract the most relevant summary from tool_input */
function inputSummary(tool_name: string, tool_input: unknown): string | null {
  if (!tool_input || typeof tool_input !== "object") return null;
  const inp = tool_input as Record<string, unknown>;

  if (tool_name === "Write" || tool_name === "Edit" || tool_name === "Read") {
    return inp.file_path as string ?? null;
  }
  if (tool_name === "Bash") {
    return inp.command as string ?? null;
  }
  if (tool_name === "WebFetch" || tool_name === "WebSearch") {
    return (inp.url ?? inp.query) as string ?? null;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PermissionDialog() {
  const { activeSessionId } = useAiSessionStore();
  const [current, setCurrent] = createSignal<PendingPermission | null>(null);
  const [resolving, setResolving] = createSignal(false);

  // Poll every 600ms — lightweight since it's just a list endpoint.
  // Filter by activeSessionId to avoid showing another window's permissions.
  const interval = setInterval(async () => {
    if (current() !== null) return; // already showing a dialog
    const items = await fetchPending(activeSessionId());
    if (items.length > 0) {
      setCurrent(items[0]);
    }
  }, 600);

  onCleanup(() => clearInterval(interval));

  async function decide(behavior: "allow" | "deny") {
    const perm = current();
    if (!perm || resolving()) return;
    setResolving(true);
    try {
      await resolvePermission(perm.id, behavior);
    } finally {
      setCurrent(null);
      setResolving(false);
    }
  }

  return (
    <Show when={current() !== null}>
      {/* Backdrop */}
      <div class="cc-perm-dialog__backdrop">
        {/* Dialog */}
        <div class="cc-perm-dialog" role="dialog" aria-modal="true" aria-labelledby="perm-title">
          {/* Header */}
          <div class="cc-perm-dialog__header">
            <span class="cc-perm-dialog__icon">🔐</span>
            <span id="perm-title" class="cc-perm-dialog__title">
              Cookia demande une permission
            </span>
          </div>

          {/* Tool info */}
          <div class="cc-perm-dialog__body">
            <div class="cc-perm-dialog__row">
              <span class="cc-perm-dialog__label">Outil</span>
              <span class="cc-perm-dialog__value cc-perm-dialog__value--tool">
                {toolLabel(current()!.tool_name)}
              </span>
            </div>

            <Show when={inputSummary(current()!.tool_name, current()!.tool_input) !== null}>
              <div class="cc-perm-dialog__row">
                <span class="cc-perm-dialog__label">Cible</span>
                <code class="cc-perm-dialog__value cc-perm-dialog__value--code">
                  {inputSummary(current()!.tool_name, current()!.tool_input)}
                </code>
              </div>
            </Show>

            <details class="cc-perm-dialog__details">
              <summary class="cc-perm-dialog__details-toggle">Détails complets</summary>
              <pre class="cc-perm-dialog__details-body">
                {formatToolInput(current()!.tool_input)}
              </pre>
            </details>
          </div>

          {/* Actions */}
          <div class="cc-perm-dialog__actions">
            <button
              class="cc-perm-dialog__btn cc-perm-dialog__btn--deny"
              onClick={() => decide("deny")}
              disabled={resolving()}
            >
              Refuser
            </button>
            <button
              class="cc-perm-dialog__btn cc-perm-dialog__btn--allow"
              onClick={() => decide("allow")}
              disabled={resolving()}
            >
              {resolving() ? "…" : "Autoriser ✓"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
