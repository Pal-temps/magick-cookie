import { Show, For, createSignal } from "solid-js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { AiMessage } from "../../../application/stores/aiSessionStore";

interface AiMessageBubbleProps {
  message: AiMessage;
  isStreaming?: boolean;
}

export function AiMessageBubble(props: AiMessageBubbleProps) {
  const msg = () => props.message;

  // Detect thinking blocks (content starting with <thinking> or marked as thinking phase)
  const isThinking = () => msg().streamPhase === "thinking";
  const [thinkingExpanded, setThinkingExpanded] = createSignal(false);

  return (
    <Show when={msg().type !== "tool_use" && msg().type !== "tool_result" && msg().type !== "permission_request"}>
      <div
        class={`cc-bubble cc-bubble--${msg().type} ${props.isStreaming ? "cc-bubble--streaming" : ""}`}
      >
        {/* User messages */}
        <Show when={msg().type === "user"}>
          <Show when={msg().images && msg().images!.length > 0}>
            <div class="cc-bubble__images">
              <For each={msg().images!}>
                {(img) => (
                  <img
                    src={`data:${img.media_type};base64,${img.data}`}
                    alt="Screenshot"
                    class="cc-bubble__image-thumb"
                  />
                )}
              </For>
            </div>
          </Show>
          <div class="cc-bubble__content">{msg().content}</div>
        </Show>

        {/* Assistant messages */}
        <Show when={msg().type === "assistant"}>
          <div class="cc-bubble__avatar">
            <span class="cc-bubble__avatar-icon">&#x2726;</span>
          </div>
          <div class="cc-bubble__body">
            <Show when={isThinking()}>
              <button
                class="cc-thinking-toggle"
                onClick={() => setThinkingExpanded((v) => !v)}
              >
                {thinkingExpanded() ? "Masquer" : "Voir"} le raisonnement
              </button>
              <Show when={thinkingExpanded()}>
                <div class="cc-thinking-block">{msg().content}</div>
              </Show>
            </Show>
            <Show when={!isThinking()}>
              <div class="cc-bubble__markdown" innerHTML={DOMPurify.sanitize(marked.parse(msg().content) as string)} />
            </Show>
          </div>
        </Show>

        {/* System messages */}
        <Show when={msg().type === "system"}>
          <div class="cc-bubble__system">{msg().content}</div>
        </Show>

        {/* Error messages */}
        <Show when={msg().type === "error"}>
          <div class="cc-bubble__error">
            <span class="cc-bubble__error-icon">&#x26A0;</span>
            <div innerHTML={DOMPurify.sanitize(marked.parse(msg().content) as string)} />
          </div>
        </Show>
      </div>
    </Show>
  );
}
