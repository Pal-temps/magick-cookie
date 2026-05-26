import { createSignal, Show } from "solid-js";
import type { AiMessage } from "../../../application/stores/aiSessionStore";

interface ToolBlockProps {
  message: AiMessage;
  result?: AiMessage;
}

function toolIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("read") || n === "glob" || n === "grep") return "R";
  if (n.includes("write")) return "W";
  if (n === "bash" || n.includes("terminal")) return "$";
  if (n.includes("edit")) return "E";
  if (n.includes("agent")) return "A";
  return "T";
}

function toolColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("read") || n === "glob" || n === "grep") return "var(--cc-info, #2b6cb0)";
  if (n.includes("write")) return "var(--cc-success, #2d7d46)";
  if (n === "bash" || n.includes("terminal")) return "var(--cc-warning, #b7791f)";
  if (n.includes("edit")) return "var(--cc-primary, #d97757)";
  return "var(--text-muted)";
}

function formatInput(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  try {
    const obj = input as Record<string, unknown>;
    // Show the most relevant field
    if (obj.command) return String(obj.command);
    if (obj.file_path) return String(obj.file_path);
    if (obj.path) return String(obj.path);
    if (obj.pattern) return `pattern: ${obj.pattern}`;
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function truncateOutput(output: string, maxLines = 20): { text: string; truncated: boolean } {
  const lines = output.split("\n");
  if (lines.length <= maxLines) return { text: output, truncated: false };
  return {
    text: lines.slice(-maxLines).join("\n"),
    truncated: true,
  };
}

export function ToolBlock(props: ToolBlockProps) {
  const [expanded, setExpanded] = createSignal(false);
  const [showFullOutput, setShowFullOutput] = createSignal(false);
  const name = () => props.message.toolName ?? "Tool";
  const input = () => props.message.toolInput;
  const result = () => props.result;
  const isError = () => result()?.toolIsError ?? false;

  const outputPreview = () => {
    const raw = result()?.toolResult ?? "";
    if (showFullOutput()) return { text: raw, truncated: false };
    return truncateOutput(raw);
  };

  return (
    <div class={`cc-tool ${isError() ? "cc-tool--error" : ""}`}>
      <div class="cc-tool__header" onClick={() => setExpanded((v) => !v)}>
        <span class="cc-tool__icon" style={{ color: toolColor(name()) }}>
          {toolIcon(name())}
        </span>
        <span class="cc-tool__name">{name()}</span>
        <span class="cc-tool__summary">{formatInput(input())}</span>
        <Show when={result()}>
          <span class={`cc-tool__status ${isError() ? "cc-tool__status--error" : "cc-tool__status--ok"}`}>
            {isError() ? "erreur" : "ok"}
          </span>
        </Show>
        <Show when={!result()}>
          <span class="cc-tool__spinner" />
          <Show when={(props.message.toolElapsed ?? 0) > 0}>
            <span class="cc-tool__elapsed">{props.message.toolElapsed}s</span>
          </Show>
        </Show>
        <span class={`cc-tool__chevron ${expanded() ? "cc-tool__chevron--open" : ""}`}>&#x25B8;</span>
      </div>

      <Show when={expanded()}>
        <div class="cc-tool__body">
          <Show when={input()}>
            <div class="cc-tool__section">
              <div class="cc-tool__section-label">Input</div>
              <pre class="cc-tool__pre">{formatInput(input())}</pre>
            </div>
          </Show>
          <Show when={result()?.toolResult}>
            <div class="cc-tool__section">
              <div class="cc-tool__section-label">
                Output
                <Show when={outputPreview().truncated}>
                  <button
                    class="cc-tool__show-more"
                    onClick={(e) => { e.stopPropagation(); setShowFullOutput(true); }}
                  >Voir tout</button>
                </Show>
              </div>
              <pre class={`cc-tool__pre ${isError() ? "cc-tool__pre--error" : ""}`}>
                {outputPreview().text}
              </pre>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
