import { createSignal, onMount, Show, For } from "solid-js";
import { useAnalyticsStore, type BriefRawData } from "../../../application/stores/analyticsStore";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import {
  getAllTemplates,
  getActiveTemplateId,
  setActiveTemplateId,
} from "../../../application/brief/briefTemplates";

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

function renderBold(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong>{part}</strong> : <>{part}</>
  );
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m}min`;
}

function RawDataFallback(props: { rawData: BriefRawData }) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      {/* Yesterday */}
      <div>
        <h3 style={{ margin: "0 0 8px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
          Hier
        </h3>
        <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "12px" }}>
          <div style={{ "font-size": "13px", color: "var(--text-secondary)", "margin-bottom": "6px" }}>
            Focus : {formatSeconds(props.rawData.yesterday.totalFocusSeconds)} ({props.rawData.yesterday.timerSessions.length} sessions)
          </div>
          <Show when={props.rawData.yesterday.events.length > 0}>
            <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>Evenements :</div>
            <ul style={{ margin: "0 0 6px", "padding-left": "16px" }}>
              <For each={props.rawData.yesterday.events}>
                {(ev) => <li style={{ "font-size": "12px", color: "var(--text-secondary)" }}>{ev.title}</li>}
              </For>
            </ul>
          </Show>
          <Show when={props.rawData.yesterday.triagedTasks.length > 0}>
            <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>Taches triees :</div>
            <ul style={{ margin: "0", "padding-left": "16px" }}>
              <For each={props.rawData.yesterday.triagedTasks}>
                {(t) => <li style={{ "font-size": "12px", color: "var(--text-secondary)" }}>{t.title} ({t.status})</li>}
              </For>
            </ul>
          </Show>
        </div>
      </div>

      {/* Today */}
      <div>
        <h3 style={{ margin: "0 0 8px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
          Aujourd'hui
        </h3>
        <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "12px" }}>
          <Show when={props.rawData.today.events.length > 0}>
            <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>Evenements :</div>
            <ul style={{ margin: "0 0 6px", "padding-left": "16px" }}>
              <For each={props.rawData.today.events}>
                {(ev) => <li style={{ "font-size": "12px", color: "var(--text-secondary)" }}>{ev.title} ({ev.startAt})</li>}
              </For>
            </ul>
          </Show>
          <Show when={props.rawData.today.priorityTasks.length > 0}>
            <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>Taches prioritaires :</div>
            <ul style={{ margin: "0 0 6px", "padding-left": "16px" }}>
              <For each={props.rawData.today.priorityTasks}>
                {(t) => <li style={{ "font-size": "12px", color: "var(--text-secondary)" }}>{t.title} ({t.status})</li>}
              </For>
            </ul>
          </Show>
          <div style={{ "font-size": "13px", color: "var(--text-secondary)" }}>
            Emails non lus : {props.rawData.today.unreadEmails}
          </div>
        </div>
      </div>

      {/* Blockers */}
      <Show when={props.rawData.blockers.staleTasks.length > 0 || props.rawData.blockers.overdueEvents.length > 0}>
        <div>
          <h3 style={{ margin: "0 0 8px", "font-size": "14px", "font-weight": "600", color: "#d63031" }}>
            Blockers
          </h3>
          <div style={{ background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", padding: "12px" }}>
            <Show when={props.rawData.blockers.staleTasks.length > 0}>
              <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>Taches stagnantes :</div>
              <ul style={{ margin: "0 0 6px", "padding-left": "16px" }}>
                <For each={props.rawData.blockers.staleTasks}>
                  {(t) => <li style={{ "font-size": "12px", color: "var(--text-secondary)" }}>{t.title} ({t.daysSinceTriaged}j)</li>}
                </For>
              </ul>
            </Show>
            <Show when={props.rawData.blockers.overdueEvents.length > 0}>
              <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "4px" }}>Evenements en retard :</div>
              <ul style={{ margin: "0", "padding-left": "16px" }}>
                <For each={props.rawData.blockers.overdueEvents}>
                  {(ev) => <li style={{ "font-size": "12px", color: "var(--text-secondary)" }}>{ev.title}</li>}
                </For>
              </ul>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

interface BriefViewProps {
  onClose: () => void;
}

export function BriefView(props: BriefViewProps) {
  const { brief, briefLoading, fetchBrief } = useAnalyticsStore();
  const [selectedTemplate, setSelectedTemplate] = createSignal(getActiveTemplateId());

  onMount(() => fetchBrief());

  function handleTemplateChange(id: string) {
    setSelectedTemplate(id);
    setActiveTemplateId(id);
    fetchBrief();
  }

  async function handleCopy() {
    const data = brief();
    if (!data) return;
    const text = data.brief || JSON.stringify(data.rawData, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Failed to copy brief:", e);
    }
  }

  return (
    <div style={{ padding: "24px", height: "100%", display: "flex", "flex-direction": "column" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
            Brief quotidien
          </h2>
          <select
            value={selectedTemplate()}
            onChange={(e) => handleTemplateChange(e.currentTarget.value)}
            style={{
              padding: "4px 8px",
              "border-radius": "var(--radius-sm)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              "font-size": "12px",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <For each={getAllTemplates()}>
              {(t) => <option value={t.id}>{t.name}</option>}
            </For>
          </select>
        </div>
        <Button variant="ghost" size="sm" onClick={props.onClose}>Retour</Button>
      </div>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto", "margin-bottom": "16px" }}>
        <Show when={briefLoading()}>
          <CookieLoader message="Generation du brief..." />
        </Show>

        <Show when={!briefLoading() && brief()}>
          {(data) => (
            <Show
              when={data().brief}
              fallback={<RawDataFallback rawData={data().rawData} />}
            >
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                <For each={renderMarkdown(data().brief)}>
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
            </Show>
          )}
        </Show>

        <Show when={!briefLoading() && !brief()}>
          <div style={{ color: "var(--text-muted)", "font-size": "13px", padding: "20px 0" }}>
            Impossible de charger le brief.
          </div>
        </Show>
      </div>

      {/* Footer buttons */}
      <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end", "padding-top": "12px", "border-top": "1px solid var(--border-color)" }}>
        <Button variant="secondary" size="sm" onClick={() => fetchBrief()}>
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
