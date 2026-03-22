import { createSignal, Show } from "solid-js";
import type { AiMessage } from "../../../application/stores/aiSessionStore";

interface ToolBlockProps {
  message: AiMessage;
  result?: AiMessage;
}

function toolIconClass(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("read") || n === "glob" || n === "grep") return "ide-tool-block__icon--read";
  if (n.includes("write") || n === "edit") return "ide-tool-block__icon--write";
  if (n === "bash" || n.includes("terminal")) return "ide-tool-block__icon--bash";
  if (n.includes("edit")) return "ide-tool-block__icon--edit";
  return "ide-tool-block__icon--default";
}

function toolIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("read") || n === "glob" || n === "grep") return "R";
  if (n.includes("write")) return "W";
  if (n === "bash" || n.includes("terminal")) return "$";
  if (n.includes("edit")) return "E";
  return "T";
}

function formatInput(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function ToolBlock(props: ToolBlockProps) {
  const [expanded, setExpanded] = createSignal(false);
  const name = () => props.message.toolName ?? "Tool";
  const input = () => props.message.toolInput;
  const result = () => props.result;

  return (
    <div class="ide-tool-block">
      <div class="ide-tool-block__header" onClick={() => setExpanded((v) => !v)}>
        <div class={`ide-tool-block__icon ${toolIconClass(name())}`}>
          {toolIcon(name())}
        </div>
        <span class="ide-tool-block__name">{name()}</span>
        <Show when={result()}>
          <span class="ide-tool-block__status" style={{ color: result()!.toolIsError ? "var(--danger)" : "var(--success)" }}>
            {result()!.toolIsError ? "erreur" : "ok"}
          </span>
        </Show>
        <Show when={!result()}>
          <span class="ide-tool-block__status">en cours...</span>
        </Show>
        <span class={`ide-tool-block__chevron ${expanded() ? "ide-tool-block__chevron--open" : ""}`}>▸</span>
      </div>
      <Show when={expanded()}>
        <div class="ide-tool-block__body">
          <Show when={input()}>
            <div style={{ color: "var(--text-muted)", "margin-bottom": "4px" }}>Input:</div>
            {formatInput(input())}
          </Show>
          <Show when={result()?.toolResult}>
            <div style={{ color: "var(--text-muted)", "margin-top": "8px", "margin-bottom": "4px" }}>
              Output{result()!.toolIsError ? " (error)" : ""}:
            </div>
            {result()!.toolResult}
          </Show>
        </div>
      </Show>
    </div>
  );
}
