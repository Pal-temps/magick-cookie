import { onMount, Show, For, createSignal } from "solid-js";
import { CookieLoader } from "../common/CookieLoader";
import { useEmailStore } from "../../../application/stores/emailStore";
import { useNotesStore } from "../../../application/stores/notesStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";
import { requestConfirm } from "../common/ConfirmDialog";

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
  const notes = useNotesStore();
  const { t } = useT();

  const [deletingGroups, setDeletingGroups] = createSignal<Set<string>>(new Set());
  const [generatingReport, setGeneratingReport] = createSignal(false);
  const [senderOpen, setSenderOpen] = createSignal(true);

  onMount(() => store.fetchDigest());

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

  async function handleGenerateReport() {
    setGeneratingReport(true);
    try {
      const { markdown } = await store.generateReport(7);
      const date = new Date().toISOString().slice(0, 10);
      const noteName = `rapport-emails-${date}`;
      await notes.createNote(noteName, "");
      notes.updateContent(markdown);
      await notes.saveCurrentFile();
      props.onClose();
    } catch (err) {
      console.error("Failed to generate email report:", err);
    } finally {
      setGeneratingReport(false);
    }
  }

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
    <div style={{ padding: "24px 24px 0", height: "100%", display: "flex", "flex-direction": "column" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
          {t("email.digestTitle")}
        </h2>
        <Button variant="ghost" size="sm" onClick={props.onClose}>{t("email.back")}</Button>
      </div>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto", "padding-bottom": "32px" }}>
        <Show when={store.digestLoading()}>
          <CookieLoader message={t("email.summaryLoading")} />
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
                  {t("email.unreadLast7days")}
                </div>
              </div>

              {/* LLM summary */}
              <Show when={data().summary}>
                <div style={{ "margin-bottom": "16px" }}>
                  <h3 style={{ margin: "0 0 8px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                    {t("email.summary")}
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

              {/* By sender — collapsible */}
              <button
                onClick={() => setSenderOpen(!senderOpen())}
                style={{
                  display: "flex", "align-items": "center", gap: "8px",
                  margin: "0 0 8px", padding: "0", background: "none", border: "none",
                  cursor: "pointer", color: "var(--text-primary)", width: "100%", "text-align": "left",
                }}
              >
                <span style={{ "font-size": "14px", width: "16px", "flex-shrink": "0" }}>{senderOpen() ? "▾" : "▸"}</span>
                <span style={{ "font-size": "14px", "font-weight": "600" }}>{t("email.bySender")}</span>
                <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>({data().bySender.length})</span>
              </button>
              <Show when={senderOpen()}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                  <For each={data().bySender}>
                    {(entry) => (
                      <div style={{
                        background: "var(--bg-elevated)",
                        "border-radius": "var(--radius-md)",
                        padding: "10px 12px",
                      }}>
                        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "4px" }}>
                          <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)", flex: "1", "min-width": "0", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                            {entry.sender}
                          </span>
                          <div style={{ display: "flex", "align-items": "center", gap: "6px", "flex-shrink": "0" }}>
                            <span style={{
                              "font-size": "11px",
                              background: "#3b82f6",
                              color: "white",
                              padding: "1px 6px",
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
                                {t("common.delete")}
                              </Button>
                            }>
                              <CookieLoader size={22} />
                            </Show>
                          </div>
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
              </Show>
            </>
          )}
        </Show>

        <Show when={!store.digestLoading() && !store.digest()}>
          <div style={{ color: "var(--text-muted)", "font-size": "13px", padding: "20px 0" }}>
            {t("email.cannotLoadDigest")}
          </div>
        </Show>
      </div>

      {/* Footer buttons */}
      <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end", "padding-top": "12px", "border-top": "1px solid var(--border-color)" }}>
        <AiButton variant="primary" size="sm" onClick={handleGenerateReport} disabled={generatingReport()}>
          {generatingReport() ? t("email.generating") : t("email.reportToNotes")}
        </AiButton>
        <AiButton variant="secondary" size="sm" onClick={() => store.fetchDigest()}>
          {t("email.regenerate")}
        </AiButton>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {t("common.copy")}
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onClose}>
          {t("email.back")}
        </Button>
      </div>
    </div>
  );
}
