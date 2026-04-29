import { For, Show, onMount, createEffect, on } from "solid-js";
import DOMPurify from "dompurify";
import type { AiMessage, AiSession } from "../../../application/stores/aiSessionStore";
import { AiMessageBubble } from "./AiMessageBubble";
import { ToolBlock } from "./ToolBlock";
import { PermissionBanner } from "./PermissionBanner";

interface AiMessageFeedProps {
  session: AiSession;
  onAllowPermission: (requestId: string) => void;
  onDenyPermission: (requestId: string) => void;
}

export function AiMessageFeed(props: AiMessageFeedProps) {
  let feedRef: HTMLDivElement | undefined;
  let bottomRef: HTMLDivElement | undefined;

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef?.scrollIntoView({ behavior: "smooth" }));
  }

  // Auto-scroll on new messages or streaming
  createEffect(on(
    () => props.session.messages.length,
    () => scrollToBottom(),
  ));

  createEffect(on(
    () => props.session.streamingContent,
    () => {
      if (props.session.isStreaming) scrollToBottom();
    },
  ));

  onMount(() => scrollToBottom());

  // Find tool_result matching a tool_use
  function findToolResult(toolUseMsg: AiMessage): AiMessage | undefined {
    const idx = props.session.messages.indexOf(toolUseMsg);
    // Look for the next tool_result after this tool_use
    for (let i = idx + 1; i < props.session.messages.length; i++) {
      const m = props.session.messages[i];
      if (m.type === "tool_result") return m;
      if (m.type === "tool_use" || m.type === "assistant" || m.type === "user") break;
    }
    return undefined;
  }

  return (
    <div class="ide-ai-feed" ref={feedRef}>
      <Show when={props.session.messages.length === 0 && !props.session.isStreaming}>
        <div style={{ color: "var(--text-muted)", "font-size": "12px", "text-align": "center", padding: "40px 10px" }}>
          Posez une question ou utilisez les boutons ci-dessous.
        </div>
      </Show>

      <For each={props.session.messages}>
        {(msg) => (
          <>
            {/* Regular messages (user, assistant, system, error) */}
            <Show when={msg.type !== "tool_use" && msg.type !== "tool_result" && msg.type !== "permission_request"}>
              <AiMessageBubble message={msg} />
            </Show>

            {/* Tool use blocks */}
            <Show when={msg.type === "tool_use"}>
              <ToolBlock message={msg} result={findToolResult(msg)} />
            </Show>

            {/* Permission requests */}
            <Show when={msg.type === "permission_request" && msg.permissionRequest}>
              <PermissionBanner
                permission={msg.permissionRequest!}
                onAllow={props.onAllowPermission}
                onDeny={props.onDenyPermission}
              />
            </Show>
          </>
        )}
      </For>

      {/* Streaming indicator */}
      <Show when={props.session.isStreaming && props.session.streamingContent}>
        <div class="ide-ai-bubble ide-ai-bubble--assistant ide-ai-bubble--streaming">
          <div innerHTML={DOMPurify.sanitize(props.session.streamingContent ?? "")} />
        </div>
      </Show>

      <Show when={props.session.isStreaming && !props.session.streamingContent}>
        <div class="cc-thinking-indicator">
          <span class="cc-thinking-indicator__dot" />
          <span class="cc-thinking-indicator__dot" />
          <span class="cc-thinking-indicator__dot" />
        </div>
      </Show>

      <div ref={bottomRef} />
    </div>
  );
}
