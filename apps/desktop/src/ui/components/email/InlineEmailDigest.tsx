import { onMount, Show, For, createSignal } from "solid-js";
import { CookieLoader } from "../common/CookieLoader";
import { useEmailStore } from "../../../application/stores/emailStore";
import { Button } from "../common/Button";
import { requestConfirm } from "../common/ConfirmDialog";

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

export function InlineEmailDigest() {
  const store = useEmailStore();
  const [deletingGroups, setDeletingGroups] = createSignal<Set<string>>(new Set());

  onMount(() => store.fetchInlineDigest());

  async function handleDeleteGroup(sender: string, emailIds: string[], count: number) {
    const confirmed = await requestConfirm(
      `Supprimer les ${count} email${count > 1 ? "s" : ""} de "${sender}" ? Cette action est irreversible.`,
    );
    if (!confirmed) return;

    setDeletingGroups((prev) => new Set([...prev, sender]));
    try {
      await store.deleteSenderFromDigest(sender, emailIds);
    } catch (err) {
      console.error(`Failed to delete emails from ${sender}:`, err);
    } finally {
      setDeletingGroups((prev) => { const next = new Set(prev); next.delete(sender); return next; });
    }
  }

  return (
    <div style={{
      "border-top": "1px solid var(--border-color)",
      "max-height": "250px",
      "overflow-y": "auto",
      "flex-shrink": "0",
      padding: "10px 14px",
    }}>
      {/* AI Summary section */}
      <Show when={store.digestSummaryLoading()}>
        <div style={{ "margin-bottom": "10px" }}>
          <CookieLoader size={22} message="Resume IA en cours..." />
        </div>
      </Show>

      <Show when={!store.digestSummaryLoading() && store.digestSummary()}>
        <div style={{ "margin-bottom": "10px" }}>
          <h4 style={{ margin: "0 0 6px", "font-size": "12px", "font-weight": "600", color: "var(--text-primary)" }}>
            Resume
          </h4>
          <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
            <For each={renderMarkdown(store.digestSummary())}>
              {(el) => (
                <>
                  <Show when={el.type === "h3"}>
                    <h4 style={{
                      margin: "8px 0 4px",
                      "font-size": "12px",
                      "font-weight": "600",
                      color: "var(--text-primary)",
                    }}>
                      {renderBold(el.content)}
                    </h4>
                  </Show>
                  <Show when={el.type === "li"}>
                    <div style={{
                      "padding-left": "12px",
                      "font-size": "11px",
                      color: "var(--text-secondary)",
                      "line-height": "1.4",
                    }}>
                      <span style={{ "margin-right": "4px" }}>-</span>
                      {renderBold(el.content)}
                    </div>
                  </Show>
                  <Show when={el.type === "p"}>
                    <p style={{
                      margin: "2px 0",
                      "font-size": "11px",
                      color: "var(--text-secondary)",
                      "line-height": "1.4",
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

      {/* Structured data: loading */}
      <Show when={store.digestLoading()}>
        <CookieLoader size={22} message="Chargement digest..." />
      </Show>

      {/* Structured data: by sender */}
      <Show when={!store.digestLoading() && store.digest()}>
        {(data) => (
          <>
            <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "6px" }}>
              <h4 style={{ margin: "0", "font-size": "12px", "font-weight": "600", color: "var(--text-primary)" }}>
                Par expediteur
              </h4>
              <span style={{
                "font-size": "11px",
                background: "#3b82f6",
                color: "white",
                padding: "1px 6px",
                "border-radius": "8px",
              }}>
                {data().totalUnread} non lus
              </span>
            </div>
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <For each={data().bySender}>
                {(entry) => (
                  <div style={{
                    background: "var(--bg-elevated)",
                    "border-radius": "var(--radius-md)",
                    padding: "6px 10px",
                  }}>
                    <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "2px" }}>
                      <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--text-primary)", flex: "1", "min-width": "0", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                        {entry.sender}
                      </span>
                      <div style={{ display: "flex", "align-items": "center", gap: "4px", "flex-shrink": "0" }}>
                        <span style={{
                          "font-size": "10px",
                          background: "#3b82f6",
                          color: "white",
                          padding: "1px 5px",
                          "border-radius": "8px",
                        }}>
                          {entry.count}
                        </span>
                        <Show when={deletingGroups().has(entry.sender)} fallback={
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteGroup(entry.sender, entry.emailIds, entry.count)}
                            disabled={deletingGroups().has(entry.sender)}
                          >
                            Supprimer
                          </Button>
                        }>
                          <CookieLoader size={18} />
                        </Show>
                      </div>
                    </div>
                    <For each={entry.subjects}>
                      {(subject) => (
                        <div style={{ "font-size": "11px", color: "var(--text-muted)", "padding-left": "6px" }}>
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
        <div style={{ color: "var(--text-muted)", "font-size": "11px" }}>
          Impossible de charger le digest.
        </div>
      </Show>
    </div>
  );
}
