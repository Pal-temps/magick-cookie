import { Show } from "solid-js";
import { marked } from "marked";
import type { AiMessage } from "../../../application/stores/aiSessionStore";

interface AiMessageBubbleProps {
  message: AiMessage;
  isStreaming?: boolean;
}

export function AiMessageBubble(props: AiMessageBubbleProps) {
  const msg = () => props.message;

  return (
    <Show when={msg().type !== "tool_use" && msg().type !== "tool_result" && msg().type !== "permission_request"}>
      <div
        class={`ide-ai-bubble ide-ai-bubble--${msg().type} ${props.isStreaming ? "ide-ai-bubble--streaming" : ""}`}
      >
        <Show when={msg().type === "assistant" || msg().type === "error"}>
          <div innerHTML={marked.parse(msg().content) as string} />
        </Show>
        <Show when={msg().type === "user"}>
          {msg().content}
        </Show>
        <Show when={msg().type === "system"}>
          {msg().content}
        </Show>
      </div>
    </Show>
  );
}
