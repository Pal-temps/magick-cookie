import { For, Show, createMemo } from "solid-js";
import { useAiSessionStore, type AiMessage } from "../../../application/stores/aiSessionStore";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useT } from "../../../i18n/context";
import { AiMessageBubble } from "./AiMessageBubble";
import { ToolBlock } from "./ToolBlock";

function parseJSONLToMessages(lines: string[]): AiMessage[] {
  const messages: AiMessage[] = [];
  let msgCounter = 0;

  for (const line of lines) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    // Skip metadata line
    if (parsed.type === "session_meta") continue;

    const ev = parsed.event as Record<string, unknown> | undefined;
    if (!ev) continue;

    const seq = (parsed.seq as number) ?? 0;
    const ts = parsed.ts as string ?? "";
    const timestamp = ts ? new Date(ts).getTime() : Date.now();
    const evType = ev.type as string;

    switch (evType) {
      case "session_ready":
        messages.push({
          id: `past-${++msgCounter}`, seq, type: "system",
          content: `Connected to ${ev.model ?? "unknown"}`,
          timestamp,
        });
        break;

      case "assistant_message":
        messages.push({
          id: `past-${++msgCounter}`, seq, type: "assistant",
          content: (ev.content as string) ?? "",
          timestamp,
        });
        break;

      case "tool_use":
        messages.push({
          id: `past-${++msgCounter}`, seq, type: "tool_use",
          content: "",
          toolName: ev.name as string,
          toolInput: ev.input,
          timestamp,
        });
        break;

      case "tool_result":
        messages.push({
          id: `past-${++msgCounter}`, seq, type: "tool_result",
          content: "",
          toolResult: ev.content as string,
          toolIsError: ev.is_error as boolean,
          timestamp,
        });
        break;

      case "error":
        messages.push({
          id: `past-${++msgCounter}`, seq, type: "error",
          content: (ev.message as string) ?? "",
          timestamp,
        });
        break;

      case "session_terminated":
        messages.push({
          id: `past-${++msgCounter}`, seq, type: "system",
          content: `Session terminated: ${ev.reason ?? "unknown"}`,
          timestamp,
        });
        break;

      // Skip stream_token, turn_complete, tool_progress, permission_*
    }
  }

  return messages;
}

function parseSessionMeta(lines: string[]): { provider: string; model: string; started_at: string; label: string } | null {
  if (lines.length === 0) return null;
  try {
    const meta = JSON.parse(lines[0]);
    if (meta.type === "session_meta") {
      return {
        provider: meta.provider ?? "",
        model: meta.model ?? "",
        started_at: meta.started_at ?? "",
        label: meta.label ?? "",
      };
    }
  } catch { /* ignore */ }
  return null;
}

export function PastSessionViewer() {
  const { t } = useT();
  const ai = useAiSessionStore();
  const ide = useIdeStore();
  let feedRef: HTMLDivElement | undefined;

  const loaded = () => ai.loadedPastSession();

  const meta = createMemo(() => {
    const data = loaded();
    if (!data) return null;
    return parseSessionMeta(data.lines);
  });

  const messages = createMemo(() => {
    const data = loaded();
    if (!data) return [];
    return parseJSONLToMessages(data.lines);
  });

  function formatDate(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function findToolResult(toolUseMsg: AiMessage): AiMessage | undefined {
    const msgs = messages();
    const idx = msgs.indexOf(toolUseMsg);
    for (let i = idx + 1; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.type === "tool_result") return m;
      if (m.type === "tool_use" || m.type === "assistant" || m.type === "user") break;
    }
    return undefined;
  }

  async function handleResume() {
    const data = loaded();
    if (!data) return;
    const m = meta();
    const cwd = ide.projectPath() ?? ".";
    ai.closePastSession();
    await ai.startSession({
      provider: m?.provider ?? "claude-cli",
      model: m?.model ?? "",
      cwd,
      resume_session_id: data.id,
    });
  }

  return (
    <div class="cc-past-session-viewer">
      {/* Header */}
      <div class="cc-past-session-viewer__header">
        <div class="cc-past-session-viewer__info">
          <span class="cc-past-session-viewer__badge">{t("ide.readOnly")}</span>
          <Show when={meta()}>
            <span class="cc-past-session-viewer__meta">
              {meta()!.label || meta()!.model || meta()!.provider}
            </span>
            <span class="cc-past-session-viewer__date">
              {formatDate(meta()!.started_at)}
            </span>
          </Show>
        </div>
        <div class="cc-past-session-viewer__actions">
          <Show when={meta()?.provider === "claude-cli"}>
            <button class="cc-past-session-viewer__resume" onClick={handleResume}>
              {t("ide.resumeSession")}
            </button>
          </Show>
          <button class="cc-past-session-viewer__close" onClick={() => ai.closePastSession()}>
            {t("common.close")}
          </button>
        </div>
      </div>

      {/* Message feed */}
      <div class="ide-ai-feed" ref={feedRef}>
        <Show when={messages().length === 0}>
          <div style={{ color: "var(--text-muted)", "font-size": "12px", "text-align": "center", padding: "40px 10px" }}>
            {t("ide.noSessionHistory")}
          </div>
        </Show>

        <For each={messages()}>
          {(msg) => (
            <>
              <Show when={msg.type !== "tool_use" && msg.type !== "tool_result"}>
                <AiMessageBubble message={msg} />
              </Show>
              <Show when={msg.type === "tool_use"}>
                <ToolBlock message={msg} result={findToolResult(msg)} />
              </Show>
            </>
          )}
        </For>
      </div>
    </div>
  );
}
