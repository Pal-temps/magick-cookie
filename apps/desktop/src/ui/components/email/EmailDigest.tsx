import { onMount, Show, For } from "solid-js";
import { CookieLoader } from "../common/CookieLoader";
import { useEmailStore } from "../../../application/stores/emailStore";
import { Button } from "../common/Button";

interface EmailDigestProps {
  onClose: () => void;
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong>{part}</strong> : <>{part}</>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: { type: "h3" | "li" | "p"; content: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      elements.push({ type: "h3", content: trimmed.slice(3) });
    } else if (trimmed.startsWith("- ")) {
      elements.push({ type: "li", content: trimmed.slice(2) });
    } else {
      elements.push({ type: "p", content: trimmed });
    }
  }

  return elements;
}

export function EmailDigest(props: EmailDigestProps) {
  const store = useEmailStore();

  onMount(() => store.fetchDigest());

  async function handleCopy() {
    const data = store.digest();
    if (!data) return;
    const text = data.summary || JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Failed to copy digest:", e);
    }
  }

  return (
    <div style={{ padding: "24px", height: "100%", display: "flex", "flex-direction": "column" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
          Digest emails
        </h2>
        <Button variant="ghost" size="sm" onClick={props.onClose}>Retour</Button>
      </div>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto", "margin-bottom": "16px" }}>
        <Show when={store.digestLoading()}>
          <CookieLoader message="Resume des emails..." />
        </Show>

        <Show when={!store.digestLoading() && store.digest()}>
          {(data) => (
            <>
              {/* Period + count */}
              <div style={{
                background: "var(--bg-elevated)",
                "border-radius": "var(--radius-md)",
                padding: "12px",
                "margin-bottom": "16px",
              }}>
                <div style={{ "font-size": "22px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {data().totalUnread}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>
                  emails non lus sur les 7 derniers jours
                </div>
              </div>

              {/* LLM summary if available */}
              <Show when={data().summary}>
                <div style={{ "margin-bottom": "16px" }}>
                  <h3 style={{ margin: "0 0 8px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                    Resume
                  </h3>
                  <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                    <For each={renderMarkdown(data().summary)}>
                      {(el) => (
                        <>
                          <Show when={el.type === "h3"}>
                            <h3 style={{
                              margin: "12px 0 6px",
                              "font-size": "14px",
                              "font-weight": "600",
                              color: "var(--text-primary)",
                            }}>
                              {renderBold(el.content)}
                            </h3>
                          </Show>
                          <Show when={el.type === "li"}>
                            <div style={{
                              "padding-left": "16px",
                              "font-size": "13px",
                              color: "var(--text-secondary)",
                              "line-height": "1.5",
                            }}>
                              <span style={{ "margin-right": "6px" }}>-</span>
                              {renderBold(el.content)}
                            </div>
                          </Show>
                          <Show when={el.type === "p"}>
                            <p style={{
                              margin: "4px 0",
                              "font-size": "13px",
                              color: "var(--text-secondary)",
                              "line-height": "1.5",
                            }}>
                              {renderBold(el.content)}
                            </p>
                          </Show>
                        </>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Structured data: by sender */}
              <h3 style={{ margin: "0 0 8px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                Par expediteur
              </h3>
              <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                <For each={data().bySender}>
                  {(entry) => (
                    <div style={{
                      background: "var(--bg-elevated)",
                      "border-radius": "var(--radius-md)",
                      padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "4px" }}>
                        <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                          {entry.sender}
                        </span>
                        <span style={{
                          "font-size": "11px",
                          background: "#3b82f6",
                          color: "white",
                          padding: "1px 6px",
                          "border-radius": "8px",
                        }}>
                          {entry.count}
                        </span>
                      </div>
                      <For each={entry.subjects}>
                        {(subject) => (
                          <div style={{ "font-size": "12px", color: "var(--text-muted)", "padding-left": "8px" }}>
                            - {subject}
                          </div>
                        )}
                      </For>
                    </div>
                  )}
                </For>
              </div>
            </>
          )}
        </Show>

        <Show when={!store.digestLoading() && !store.digest()}>
          <div style={{ color: "var(--text-muted)", "font-size": "13px", padding: "20px 0" }}>
            Impossible de charger le digest.
          </div>
        </Show>
      </div>

      {/* Footer buttons */}
      <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end", "padding-top": "12px", "border-top": "1px solid var(--border-color)" }}>
        <Button variant="secondary" size="sm" onClick={() => store.fetchDigest()}>
          Regenerer
        </Button>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          Copier
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onClose}>
          Retour
        </Button>
      </div>
    </div>
  );
}
