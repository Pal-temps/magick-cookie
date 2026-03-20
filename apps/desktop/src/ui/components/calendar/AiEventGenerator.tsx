import { createSignal, For, Show } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import type { CreateEventDTO } from "../../../domain/models/CalendarEvent";

export function AiEventGenerator() {
  const {
    showAiGenerator, setShowAiGenerator,
    generateEvents, createBulkEvents, setGeneratedEvents,
    isGenerating, calendars,
  } = useCalendarStore();

  const [prompt, setPrompt] = createSignal("");

  function todayStr() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const [date, setDate] = createSignal(todayStr());
  const [calendarId, setCalendarId] = createSignal("");
  const [editableEvents, setEditableEvents] = createSignal<CreateEventDTO[]>([]);

  function handleOpen() {
    setDate(todayStr());
    setCalendarId(calendars()[0]?.id ?? "");
    setEditableEvents([]);
    setGeneratedEvents([]);
    setPrompt("");
  }

  async function handleGenerate() {
    if (!prompt().trim()) return;
    const events = await generateEvents(prompt(), date());
    setEditableEvents([...events]);
  }

  async function handleConfirm() {
    const cId = calendarId() || calendars()[0]?.id;
    if (!cId || editableEvents().length === 0) return;
    await createBulkEvents(cId, editableEvents());
    setShowAiGenerator(false);
  }

  function removeEvent(index: number) {
    setEditableEvents((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEventTitle(index: number, title: string) {
    setEditableEvents((prev) => prev.map((e, i) => i === index ? { ...e, title } : e));
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-color)",
    "border-radius": "var(--radius-md)",
    color: "var(--text-primary)",
    "font-size": "14px",
  };

  const labelStyle = {
    display: "block",
    "font-size": "12px",
    "font-weight": "600",
    color: "var(--text-secondary)",
    "margin-bottom": "4px",
  };

  return (
    <Modal
      isOpen={showAiGenerator()}
      onClose={() => setShowAiGenerator(false)}
      title="Generer des evenements avec l'IA"
    >
      {(() => { if (showAiGenerator()) handleOpen(); return null; })()}
      <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Prompt</label>
          <textarea
            style={{ ...inputStyle, "min-height": "80px", resize: "vertical" }}
            placeholder="Ex: Planifie ma journee de travail avec 3 reunions et une pause dejeuner..."
            value={prompt()}
            onInput={(e) => setPrompt(e.currentTarget.value)}
          />
        </div>

        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Date de reference</label>
            <input
              type="date"
              style={inputStyle}
              value={date()}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Calendrier cible</label>
            <select
              style={inputStyle}
              value={calendarId()}
              onChange={(e) => setCalendarId(e.currentTarget.value)}
            >
              <For each={calendars()}>
                {(cal) => <option value={cal.id}>{cal.name}</option>}
              </For>
            </select>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={isGenerating() || !prompt().trim()}
        >
          {isGenerating() ? "Generation..." : "Generer"}
        </Button>

        <Show when={editableEvents().length > 0}>
          <div>
            <label style={labelStyle}>Apercu ({editableEvents().length} evenements)</label>
            <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "max-height": "300px", "overflow-y": "auto" }}>
              <For each={editableEvents()}>
                {(ev, index) => {
                  const startDate = new Date(ev.startAt);
                  const endDate = new Date(ev.endAt);
                  const timeLabel = ev.isAllDay
                    ? "Journee"
                    : `${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

                  return (
                    <div style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      padding: "8px",
                      background: "var(--bg-elevated)",
                      "border-radius": "var(--radius-md)",
                      border: "1px solid var(--border-color)",
                    }}>
                      <div style={{ flex: "1", "min-width": "0" }}>
                        <input
                          style={{ ...inputStyle, padding: "4px 8px", "font-size": "13px", "font-weight": "600" }}
                          value={ev.title}
                          onInput={(e) => updateEventTitle(index(), e.currentTarget.value)}
                        />
                        <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px", "padding-left": "8px" }}>
                          {timeLabel}
                          {ev.location ? ` — ${ev.location}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => removeEvent(index())}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--text-muted)", "font-size": "16px", padding: "0 4px",
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowAiGenerator(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleConfirm}>
              Ajouter au calendrier ({editableEvents().length})
            </Button>
          </div>
        </Show>
      </div>
    </Modal>
  );
}
