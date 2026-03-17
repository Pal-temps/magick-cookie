import { onMount, onCleanup, createEffect, Show, For, type JSX } from "solid-js";
import { useChatStore } from "../../../application/stores/chatStore";
import { Button } from "../common/Button";

// --- Simple Markdown Renderer ---

function renderInline(text: string): JSX.Element[] {
  // Handle bold, inline code
  const parts: JSX.Element[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<>{text.slice(lastIndex, match.index)}</>);
    }
    if (match[2]) {
      parts.push(<strong>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code style={{
          background: "var(--bg-elevated)",
          padding: "1px 5px",
          "border-radius": "3px",
          "font-size": "0.9em",
          "font-family": "monospace",
        }}>{match[3]}</code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<>{text.slice(lastIndex)}</>);
  }

  return parts.length > 0 ? parts : [<>{text}</>];
}

interface MarkdownBlock {
  type: "h3" | "li" | "p" | "code";
  content: string;
  language?: string;
}

function parseMarkdown(text: string): MarkdownBlock[] {
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  let codeLang = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({ type: "code", content: codeContent.trimEnd(), language: codeLang });
        codeContent = "";
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? "\n" : "") + line;
      continue;
    }

    if (!trimmed) continue;

    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const content = trimmed.replace(/^#{2,3}\s+/, "");
      blocks.push({ type: "h3", content });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({ type: "li", content: trimmed.slice(2) });
    } else {
      blocks.push({ type: "p", content: trimmed });
    }
  }

  // Close unclosed code block
  if (inCodeBlock && codeContent) {
    blocks.push({ type: "code", content: codeContent.trimEnd(), language: codeLang });
  }

  return blocks;
}

function MarkdownContent(props: { text: string }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
      <For each={parseMarkdown(props.text)}>
        {(block) => (
          <>
            <Show when={block.type === "h3"}>
              <h3 style={{
                margin: "8px 0 4px",
                "font-size": "14px",
                "font-weight": "600",
                color: "var(--text-primary)",
              }}>
                {renderInline(block.content)}
              </h3>
            </Show>
            <Show when={block.type === "li"}>
              <div style={{
                "padding-left": "16px",
                "font-size": "13px",
                color: "var(--text-secondary)",
                "line-height": "1.5",
              }}>
                <span style={{ "margin-right": "6px" }}>-</span>
                {renderInline(block.content)}
              </div>
            </Show>
            <Show when={block.type === "p"}>
              <p style={{
                margin: "2px 0",
                "font-size": "13px",
                color: "inherit",
                "line-height": "1.6",
              }}>
                {renderInline(block.content)}
              </p>
            </Show>
            <Show when={block.type === "code"}>
              <pre style={{
                margin: "4px 0",
                padding: "10px 12px",
                background: "var(--bg-primary)",
                "border-radius": "var(--radius-md)",
                "font-size": "12px",
                "font-family": "monospace",
                "overflow-x": "auto",
                "white-space": "pre-wrap",
                "word-break": "break-word",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}>
                <code>{block.content}</code>
              </pre>
            </Show>
          </>
        )}
      </For>
    </div>
  );
}

// --- Chat View ---

export function ChatView() {
  const {
    conversations, activeConversationId, messages, sending, error,
    fetchConversations, createConversation, selectConversation, sendMessage, deleteConversation,
  } = useChatStore();

  let messagesEndRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  let messagesContainerRef: HTMLDivElement | undefined;

  onMount(() => {
    fetchConversations();
  });

  // Auto-scroll to bottom when messages change
  createEffect(() => {
    messages(); // track
    setTimeout(() => {
      messagesEndRef?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const value = textareaRef?.value?.trim();
      if (value && !sending()) {
        sendMessage(value);
        if (textareaRef) textareaRef.value = "";
      }
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
        {/* New conversation button */}
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

        {/* Conversation list */}
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
            ref={messagesContainerRef}
            style={{
              flex: "1",
              "overflow-y": "auto",
              padding: "20px",
              display: "flex",
              "flex-direction": "column",
              gap: "12px",
            }}
          >
            <For each={messages()}>
              {(msg) => (
                <Show when={msg.role !== "system"}>
                  <div style={{
                    display: "flex",
                    "justify-content": msg.role === "user" ? "flex-end" : "flex-start",
                  }}>
                    <div style={{
                      "max-width": "75%",
                      padding: "10px 14px",
                      "border-radius": msg.role === "user"
                        ? "var(--radius-md) var(--radius-md) 4px var(--radius-md)"
                        : "var(--radius-md) var(--radius-md) var(--radius-md) 4px",
                      background: msg.role === "user" ? "var(--accent-primary)" : "var(--bg-elevated)",
                      color: msg.role === "user" ? "#fff" : "var(--text-secondary)",
                      "font-size": "13px",
                      "line-height": "1.5",
                      "word-break": "break-word",
                    }}>
                      <Show when={msg.role === "assistant"} fallback={<>{msg.content}</>}>
                        <MarkdownContent text={msg.content} />
                      </Show>
                      <div style={{
                        "font-size": "10px",
                        "margin-top": "6px",
                        opacity: "0.6",
                        "text-align": msg.role === "user" ? "right" : "left",
                      }}>
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                </Show>
              )}
            </For>

            {/* Loading indicator */}
            <Show when={sending()}>
              <div style={{
                display: "flex",
                "justify-content": "flex-start",
              }}>
                <div style={{
                  padding: "10px 14px",
                  "border-radius": "var(--radius-md) var(--radius-md) var(--radius-md) 4px",
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                  "font-size": "13px",
                }}>
                  <span class="chat-typing-dots">...</span>
                </div>
              </div>
            </Show>

            {/* Error display */}
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
              placeholder="Ecrivez un message... (Entree pour envoyer, Shift+Entree pour retour a la ligne)"
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
