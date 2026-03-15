import { createSignal, createMemo, Show, For } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

export function EventForm() {
  const { isEventFormOpen, editingEvent, closeForm, calendars, createEvent, updateEvent, prefillData, setPrefillData } = useCalendarStore();

  const isEditing = createMemo(() => !!editingEvent());

  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [location, setLocation] = createSignal("");
  const [calendarId, setCalendarId] = createSignal("");
  const [startAt, setStartAt] = createSignal("");
  const [endAt, setEndAt] = createSignal("");
  const [isAllDay, setIsAllDay] = createSignal(false);
  const [reminderMinutes, setReminderMinutes] = createSignal(15);

  // Reset form when modal opens
  const populateForm = () => {
    const ev = editingEvent();
    if (ev) {
      setTitle(ev.title);
      setDescription(ev.description ?? "");
      setLocation(ev.location ?? "");
      setCalendarId(ev.calendarId);
      setStartAt(ev.startAt.slice(0, 16));
      setEndAt(ev.endAt.slice(0, 16));
      setIsAllDay(ev.isAllDay);
    } else {
      const prefill = prefillData();
      if (prefill) {
        setTitle(prefill.title);
        setDescription("");
        setLocation(prefill.location ?? "");
        setCalendarId(calendars()[0]?.id ?? "");
        setStartAt(prefill.startAt ? toLocalInput(prefill.startAt) : toLocalInput(new Date()));
        setEndAt(prefill.endAt ? toLocalInput(prefill.endAt) : toLocalInput(new Date(Date.now() + 3600000)));
        setIsAllDay(prefill.isAllDay);
        setReminderMinutes(15);
        setPrefillData(null);
      } else {
        setTitle("");
        setDescription("");
        setLocation("");
        setCalendarId(calendars()[0]?.id ?? "");
        const now = new Date();
        const later = new Date(now.getTime() + 3600000);
        setStartAt(toLocalInput(now));
        setEndAt(toLocalInput(later));
        setIsAllDay(false);
        setReminderMinutes(15);
      }
    }
  };

  function toLocalInput(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title().trim()) return;

    if (isEditing()) {
      await updateEvent(editingEvent()!.id, {
        title: title(),
        description: description() || null,
        location: location() || null,
        startAt: new Date(startAt()).toISOString(),
        endAt: new Date(endAt()).toISOString(),
        isAllDay: isAllDay(),
      });
    } else {
      await createEvent(calendarId(), {
        title: title(),
        description: description() || null,
        location: location() || null,
        startAt: new Date(startAt()).toISOString(),
        endAt: new Date(endAt()).toISOString(),
        isAllDay: isAllDay(),
        reminders: [{ minutesBefore: reminderMinutes() }],
      });
    }
    closeForm();
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
      isOpen={isEventFormOpen()}
      onClose={closeForm}
      title={isEditing() ? "Modifier l'evenement" : "Nouvel evenement"}
    >
      {(() => { populateForm(); return null; })()}
      <form onSubmit={handleSubmit} style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Titre</label>
          <input style={inputStyle} value={title()} onInput={(e) => setTitle(e.currentTarget.value)} required />
        </div>

        <Show when={!isEditing()}>
          <div>
            <label style={labelStyle}>Calendrier</label>
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
        </Show>

        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Debut</label>
            <input type="datetime-local" style={inputStyle} value={startAt()} onInput={(e) => setStartAt(e.currentTarget.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Fin</label>
            <input type="datetime-local" style={inputStyle} value={endAt()} onInput={(e) => setEndAt(e.currentTarget.value)} required />
          </div>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <input type="checkbox" id="allday" checked={isAllDay()} onChange={(e) => setIsAllDay(e.currentTarget.checked)} />
          <label for="allday" style={{ "font-size": "13px" }}>Toute la journee</label>
        </div>

        <div>
          <label style={labelStyle}>Lieu</label>
          <input style={inputStyle} value={location()} onInput={(e) => setLocation(e.currentTarget.value)} />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, "min-height": "80px", resize: "vertical" }}
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
        </div>

        <Show when={!isEditing()}>
          <div>
            <label style={labelStyle}>Rappel (minutes avant)</label>
            <input type="number" style={inputStyle} value={reminderMinutes()} onInput={(e) => setReminderMinutes(Number(e.currentTarget.value))} min="0" />
          </div>
        </Show>

        <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end", "margin-top": "8px" }}>
          <Button variant="ghost" onClick={closeForm}>Annuler</Button>
          <Button variant="primary" type="submit">{isEditing() ? "Modifier" : "Creer"}</Button>
        </div>
      </form>
    </Modal>
  );
}
