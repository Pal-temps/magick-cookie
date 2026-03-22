import { createSignal, Show, For } from "solid-js";
import { api } from "../../../infrastructure/api/apiClient";
import { isLlmConfigured } from "../../../application/stores/llmStore";
import { marked } from "marked";

export interface AiContext {
  code: string;
  language: string;
  fileName: string;
}

interface AiAssistantProps {
  getContext: () => AiContext | null;
  onApplyCode?: (code: string) => void;
}

type AiAction = "explain" | "refactor" | "fix" | "tests" | "document" | "chat";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ACTION_LABELS: Record<AiAction, string> = {
  explain: "Expliquer",
  refactor: "Refactorer",
  fix: "Corriger",
  tests: "Tests",
  document: "Documenter",
  chat: "Chat",
};

export function AiAssistant(props: AiAssistantProps) {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [input, setInput] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  let messagesEndRef: HTMLDivElement | undefined;

  function scrollToBottom() {
    requestAnimationFrame(() => messagesEndRef?.scrollIntoView({ behavior: "smooth" }));
  }

  function extractCodeBlock(text: string): string | null {
    const match = text.match(/```[\w]*\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  async function executeAction(action: AiAction, userMessage?: string) {
    const ctx = props.getContext();
    if (!ctx && action !== "chat") return;
    if (action === "chat" && !userMessage?.trim()) return;

    setLoading(true);

    const displayMsg = action === "chat"
      ? userMessage!
      : `[${ACTION_LABELS[action]}] ${ctx?.fileName ?? ""}`;

    setMessages((prev) => [...prev, { role: "user", content: displayMsg }]);
    scrollToBottom();

    try {
      let result: string;

      if (action === "chat") {
        const context = ctx ? `Fichier actif: ${ctx.fileName} (${ctx.language})\n\nCode:\n\`\`\`${ctx.language}\n${ctx.code}\n\`\`\`` : "";
        const fullPrompt = context ? `${context}\n\nQuestion: ${userMessage}` : userMessage!;
        const resp = await api.post<string>("/code/explain", { code: fullPrompt, language: ctx?.language ?? "" });
        result = resp;
      } else {
        const endpoint = `/code/${action}`;
        const resp = await api.post<string>(endpoint, {
          code: ctx!.code,
          language: ctx!.language,
          ...(action === "refactor" ? { instruction: userMessage } : {}),
          ...(action === "fix" ? { error: userMessage } : {}),
        });
        result = resp;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: result }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Erreur: ${e}` }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  async function handleSubmit() {
    const msg = input().trim();
    if (!msg) return;
    setInput("");
    await executeAction("chat", msg);
  }

  function handleApply(content: string) {
    const code = extractCodeBlock(content);
    if (code && props.onApplyCode) {
      props.onApplyCode(code);
    }
  }

  const configured = () => isLlmConfigured();

  return (
    <div class="ide-explorer" style={{ display: "flex", "flex-direction": "column", height: "100%" }}>
      <div class="ide-explorer__header">ASSISTANT IA</div>

      <Show when={!configured()}>
        <div style={{ padding: "16px", color: "var(--text-muted)", "font-size": "12px", "text-align": "center" }}>
          Configurez un LLM dans Parametres &gt; Intelligence artificielle
        </div>
      </Show>

      <Show when={configured()}>
        {/* Quick actions */}
        <div style={{
          display: "flex", "flex-wrap": "wrap", gap: "4px", padding: "8px",
          "border-bottom": "1px solid var(--border-color)", "flex-shrink": "0",
        }}>
          <For each={(["explain", "refactor", "fix", "tests", "document"] as AiAction[])}>
            {(action) => (
              <button
                onClick={() => executeAction(action)}
                disabled={loading() || !props.getContext()}
                style={{
                  padding: "4px 8px", "font-size": "10px",
                  background: "var(--bg-elevated)", border: "1px solid var(--border-color)",
                  "border-radius": "var(--radius-sm)", color: "var(--text-secondary)",
                  cursor: loading() || !props.getContext() ? "not-allowed" : "pointer",
                  opacity: loading() || !props.getContext() ? "0.5" : "1",
                }}
              >{ACTION_LABELS[action]}</button>
            )}
          </For>
        </div>

        {/* Messages */}
        <div style={{
          flex: "1", "overflow-y": "auto", padding: "8px",
          display: "flex", "flex-direction": "column", gap: "8px",
        }}>
          <Show when={messages().length === 0}>
            <div style={{ color: "var(--text-muted)", "font-size": "12px", "text-align": "center", padding: "20px 0" }}>
              Selectionnez du code puis utilisez les boutons ci-dessus, ou posez une question.
            </div>
          </Show>

          <For each={messages()}>
            {(msg) => (
              <div style={{
                "font-size": "12px",
                "line-height": "1.5",
                padding: "8px",
                "border-radius": "var(--radius-sm)",
                background: msg.role === "user" ? "var(--bg-elevated)" : "var(--bg-base)",
                color: "var(--text-primary)",
                "border-left": msg.role === "assistant" ? "2px solid var(--accent-primary)" : "none",
              }}>
                <Show when={msg.role === "assistant"}>
                  <div class="ai-message-content" innerHTML={marked.parse(msg.content) as string} />
                  <Show when={extractCodeBlock(msg.content) && props.onApplyCode}>
                    <button
                      onClick={() => handleApply(msg.content)}
                      style={{
                        "margin-top": "6px", padding: "3px 10px", "font-size": "11px",
                        background: "var(--accent-primary)", border: "none",
                        "border-radius": "var(--radius-sm)", color: "#fff", cursor: "pointer",
                      }}
                    >Appliquer le code</button>
                  </Show>
                </Show>
                <Show when={msg.role === "user"}>
                  <span style={{ color: "var(--text-secondary)" }}>{msg.content}</span>
                </Show>
              </div>
            )}
          </For>

          <Show when={loading()}>
            <div style={{ "font-size": "12px", color: "var(--accent-primary)", padding: "8px" }}>
              Reflexion en cours...
            </div>
          </Show>

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "8px", "border-top": "1px solid var(--border-color)", "flex-shrink": "0",
          display: "flex", gap: "6px",
        }}>
          <input
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Poser une question..."
            disabled={loading()}
            style={{
              flex: "1", padding: "6px 8px", "font-size": "12px",
              background: "var(--bg-base)", border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)", color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading() || !input().trim()}
            style={{
              padding: "6px 10px", "font-size": "12px",
              background: "var(--accent-primary)", border: "none",
              "border-radius": "var(--radius-sm)", color: "#fff",
              cursor: loading() || !input().trim() ? "not-allowed" : "pointer",
              opacity: loading() || !input().trim() ? "0.5" : "1",
            }}
          >↵</button>
        </div>
      </Show>
    </div>
  );
}
