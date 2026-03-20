import { onMount, createEffect, Show, For, createSignal } from "solid-js";
import { useChatStore } from "../../../application/stores/chatStore";
import { Button } from "../common/Button";
import { marked } from "marked";
import hljs from "highlight.js";

// --- Marked config with highlight.js ---

marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(text: string): string {
  const renderer = new marked.Renderer();

  renderer.code = ({ text: code, lang }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    const highlighted = hljs.highlight(code, { language }).value;
    return `<div class="chat-code-block">
      <div class="chat-code-header">
        <span class="chat-code-lang">${language}</span>
        <button class="chat-code-copy" onclick="(function(btn){var c=btn.closest('.chat-code-block').querySelector('code').textContent;navigator.clipboard.writeText(c);btn.textContent='Copie !';setTimeout(function(){btn.textContent='Copier'},1500)})(this)">Copier</button>
      </div>
      <pre><code class="hljs language-${language}">${highlighted}</code></pre>
    </div>`;
  };

  renderer.codespan = ({ text: code }) => {
    return `<code class="chat-inline-code">${code}</code>`;
  };

  return marked.parse(text, { renderer }) as string;
}

// --- Chat View ---

export function ChatView() {
  const {
    conversations, activeConversationId, messages, sending, error,
    fetchConversations, createConversation, selectConversation, sendMessage, deleteConversation,
  } = useChatStore();

  let messagesEndRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

  onMount(() => {
    fetchConversations();
  });

  // Auto-scroll to bottom when messages change
  createEffect(() => {
    messages();
    setTimeout(() => {
      messagesEndRef?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const value = textareaRef?.value?.trim();
    if (value && !sending()) {
      sendMessage(value);
      if (textareaRef) textareaRef.value = "";
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  function copyMessage(id: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div style={{
      display: "flex",
      height: "100%",
      "min-height": "0",
      background: "var(--bg-primary)",
    }}>
      {/* Sidebar */}
      <div style={{
        width: "250px",
        "min-width": "250px",
        "border-right": "1px solid var(--border-color)",
        display: "flex",
        "flex-direction": "column",
        background: "var(--bg-secondary)",
      }}>
        <div style={{ padding: "12px" }}>
          <Button
            variant="primary"
            size="sm"
            style={{ width: "100%" }}
            onClick={() => createConversation()}
          >
            + Nouvelle conversation
          </Button>
        </div>

        <div style={{
          flex: "1",
          "overflow-y": "auto",
          padding: "0 8px 8px",
        }}>
          <For each={conversations()}>
            {(conv) => (
              <div
                style={{
                  padding: "10px 12px",
                  "border-radius": "var(--radius-md)",
                  cursor: "pointer",
                  "margin-bottom": "2px",
                  background: activeConversationId() === conv.id ? "var(--bg-elevated)" : "transparent",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "space-between",
                  transition: "var(--transition-fast)",
                }}
                onClick={() => selectConversation(conv.id)}
                onMouseEnter={(e) => {
                  if (activeConversationId() !== conv.id) {
                    e.currentTarget.style.background = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeConversationId() !== conv.id) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{
                  flex: "1",
                  "min-width": "0",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                  "font-size": "13px",
                  color: activeConversationId() === conv.id ? "var(--text-primary)" : "var(--text-secondary)",
                }}>
                  {conv.title}
                </div>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "2px 4px",
                    "font-size": "14px",
                    "line-height": "1",
                    "border-radius": "var(--radius-sm)",
                    opacity: "0.5",
                    "flex-shrink": "0",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Supprimer cette conversation ?")) {
                      deleteConversation(conv.id);
                    }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--cal-red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  title="Supprimer"
                >
                  x
                </button>
              </div>
            )}
          </For>

          <Show when={conversations().length === 0}>
            <div style={{
              "font-size": "12px",
              color: "var(--text-muted)",
              "text-align": "center",
              padding: "20px 12px",
            }}>
              Aucune conversation
            </div>
          </Show>
        </div>
      </div>

      {/* Main chat area */}
      <div style={{
        flex: "1",
        display: "flex",
        "flex-direction": "column",
        "min-width": "0",
      }}>
        <Show
          when={activeConversationId()}
          fallback={
            <div style={{
              flex: "1",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              color: "var(--text-muted)",
              "font-size": "15px",
            }}>
              Commencez une conversation
            </div>
          }
        >
          {/* Messages area */}
          <div
            style={{
              flex: "1",
              "overflow-y": "auto",
              padding: "20px",
              display: "flex",
              "flex-direction": "column",
              gap: "16px",
            }}
          >
            <For each={messages()}>
              {(msg) => (
                <Show when={msg.role !== "system"}>
                  <div style={{
                    display: "flex",
                    "justify-content": msg.role === "user" ? "flex-end" : "flex-start",
                  }}>
                    <div
                      class={msg.role === "assistant" ? "chat-assistant-msg" : undefined}
                      style={{
                        "max-width": msg.role === "user" ? "75%" : "85%",
                        padding: msg.role === "user" ? "10px 14px" : "12px 16px",
                        "border-radius": msg.role === "user"
                          ? "var(--radius-md) var(--radius-md) 4px var(--radius-md)"
                          : "var(--radius-md) var(--radius-md) var(--radius-md) 4px",
                        background: msg.role === "user" ? "var(--accent-primary)" : "var(--bg-elevated)",
                        color: msg.role === "user" ? "#fff" : "var(--text-secondary)",
                        "font-size": "13px",
                        "line-height": "1.6",
                        "word-break": "break-word",
                        position: "relative",
                      }}
                    >
                      <Show when={msg.role === "assistant"} fallback={<>{msg.content}</>}>
                        <div innerHTML={renderMarkdown(msg.content)} />
                      </Show>

                      {/* Message actions */}
                      <div style={{
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                        "margin-top": "6px",
                        "font-size": "10px",
                        opacity: "0.6",
                      }}>
                        <span>{formatTime(msg.createdAt)}</span>
                        <Show when={msg.role === "assistant"}>
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "inherit",
                              "font-size": "10px",
                              padding: "0 4px",
                            }}
                            title="Copier le message"
                          >
                            {copiedId() === msg.id ? "Copie !" : "Copier"}
                          </button>
                        </Show>
                      </div>
                    </div>
                  </div>
                </Show>
              )}
            </For>

            {/* Loading indicator */}
            <Show when={sending()}>
              <div style={{ display: "flex", "justify-content": "flex-start" }}>
                <div style={{
                  padding: "12px 16px",
                  "border-radius": "var(--radius-md) var(--radius-md) var(--radius-md) 4px",
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                  "font-size": "13px",
                  display: "flex",
                  gap: "4px",
                  "align-items": "center",
                }}>
                  <span class="chat-dot" style={{ "animation-delay": "0s" }} />
                  <span class="chat-dot" style={{ "animation-delay": "0.2s" }} />
                  <span class="chat-dot" style={{ "animation-delay": "0.4s" }} />
                </div>
              </div>
            </Show>

            {/* Error */}
            <Show when={error()}>
              <div style={{
                padding: "8px 12px",
                "border-radius": "var(--radius-md)",
                background: "rgba(214, 48, 49, 0.1)",
                color: "#d63031",
                "font-size": "12px",
                "text-align": "center",
              }}>
                {error()}
              </div>
            </Show>

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: "12px 20px 16px",
            "border-top": "1px solid var(--border-color)",
            display: "flex",
            gap: "8px",
            "align-items": "flex-end",
          }}>
            <textarea
              ref={textareaRef}
              placeholder="Ecrivez un message... (Entree pour envoyer)"
              rows={2}
              disabled={sending()}
              onKeyDown={handleKeyDown}
              style={{
                flex: "1",
                resize: "none",
                padding: "10px 12px",
                "border-radius": "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                "font-size": "13px",
                "font-family": "inherit",
                "line-height": "1.5",
                outline: "none",
                "min-height": "44px",
                "max-height": "120px",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; }}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleSend}
              disabled={sending()}
              style={{ "min-height": "44px", padding: "8px 16px" }}
            >
              {sending() ? "..." : "Envoyer"}
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
}
