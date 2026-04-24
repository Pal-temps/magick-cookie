import { createSignal, createMemo, createEffect, on, Show, For } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import { DateRangePicker } from "../datetime";
import { LocationPicker } from "../common/LocationPicker";

const REMINDER_OPTIONS = [
  { value: 0, label: "—" },
  { value: 5, label: "5 min avant" },
  { value: 15, label: "15 min avant" },
  { value: 30, label: "30 min avant" },
  { value: 60, label: "1h avant" },
  { value: 1440, label: "1 jour avant" },
];

export function EventForm() {
  const { isEventFormOpen, editingEvent, closeForm, calendars, createEvent, updateEvent, deleteEvent, prefillData, setPrefillData } = useCalendarStore();
  const { t } = useT();

  const isEditing = createMemo(() => !!editingEvent());

  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [location, setLocation] = createSignal("");
  const [latitude, setLatitude] = createSignal<number | null>(null);
  const [longitude, setLongitude] = createSignal<number | null>(null);
  const [calendarId, setCalendarId] = createSignal("");
  const [startAt, setStartAt] = createSignal("");
  const [endAt, setEndAt] = createSignal("");
  const [isAllDay, setIsAllDay] = createSignal(false);
  const [reminderSet, setReminderSet] = createSignal<Set<number>>(new Set([15]));
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  const populateForm = () => {
    setErrors({});
    const ev = editingEvent();
    if (ev) {
      setTitle(ev.title);
      setDescription(ev.description ?? "");
      setLocation(ev.location ?? "");
      setLatitude(ev.latitude ?? null);
      setLongitude(ev.longitude ?? null);
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
        setReminderSet(new Set([15]));
        setPrefillData(null);
      } else {
        setTitle("");
        setDescription("");
        setLocation("");
        setLatitude(null);
        setLongitude(null);
        setCalendarId(calendars()[0]?.id ?? "");
        const now = new Date();
        const later = new Date(now.getTime() + 3600000);
        setStartAt(toLocalInput(now));
        setEndAt(toLocalInput(later));
        setIsAllDay(false);
        setReminderSet(new Set([15]));
      }
    }
  };

  function toLocalInput(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title().trim()) errs.title = "Le titre est obligatoire";
    if (!startAt()) errs.startAt = "La date de debut est obligatoire";
    if (!endAt()) errs.endAt = "La date de fin est obligatoire";
    if (startAt() && endAt() && new Date(startAt()) >= new Date(endAt())) errs.endAt = "La fin doit etre apres le debut";
    if (!isEditing() && !calendarId()) errs.calendar = t("calendar.noEvents");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (isEditing()) {
      await updateEvent(editingEvent()!.id, {
        title: title(),
        description: description() || null,
        location: location() || null,
        latitude: latitude(),
        longitude: longitude(),
        startAt: new Date(startAt()).toISOString(),
        endAt: new Date(endAt()).toISOString(),
        isAllDay: isAllDay(),
      });
    } else {
      await createEvent(calendarId(), {
        title: title(),
        description: description() || null,
        location: location() || null,
        latitude: latitude(),
        longitude: longitude(),
        startAt: new Date(startAt()).toISOString(),
        endAt: new Date(endAt()).toISOString(),
        isAllDay: isAllDay(),
        reminders: [...reminderSet()].filter((v) => v > 0).map((v) => ({ minutesBefore: v })),
      });
    }
    closeForm();
  }

  const calColor = () => calendars().find((c) => c.id === calendarId())?.color ?? "var(--accent-primary)";

  createEffect(on(isEventFormOpen, (open) => {
    if (open) populateForm();
  }));

  return (
    <Show when={isEventFormOpen()}>
      <div
        style={{
          position: "fixed", inset: "0", "z-index": "100",
          display: "flex", "align-items": "center", "justify-content": "center",
          "background-color": "rgba(0, 0, 0, 0.5)",
          "backdrop-filter": "blur(4px)",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
      >
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          "border-radius": "16px",
          width: "620px",
          "max-width": "95vw",
          "max-height": "85vh",
          display: "flex",
          "flex-direction": "column",
          "box-shadow": "0 24px 48px rgba(0, 0, 0, 0.3)",
        }}>
          {/* ── Header with color accent ── */}
          <div style={{
            padding: "20px 24px 16px",
            "border-bottom": "1px solid var(--border-color)",
            display: "flex", "align-items": "center", gap: "12px",
          }}>
            <div style={{
              width: "4px", height: "28px", "border-radius": "2px",
              background: calColor(),
              "flex-shrink": "0",
            }} />
            <div style={{ flex: "1", display: "flex", "flex-direction": "column" }}>
              <input
                value={title()}
                onInput={(e) => { setTitle(e.currentTarget.value); setErrors((p) => { const { title: _, ...rest } = p; return rest; }); }}
                placeholder="Titre de l'evenement"
                style={{
                  width: "100%", border: "none", background: "transparent",
                  color: errors().title ? "#e74c3c" : "var(--text-primary)", "font-size": "18px", "font-weight": "600",
                  outline: "none", padding: "0",
                }}
              />
              <Show when={errors().title}>
                <span style={{ "font-size": "11px", color: "#e74c3c", "margin-top": "2px" }}>{errors().title}</span>
              </Show>
            </div>
            <button
              onClick={closeForm}
              style={{
                width: "28px", height: "28px", display: "flex",
                "align-items": "center", "justify-content": "center",
                "border-radius": "var(--radius-sm)", border: "none",
                background: "transparent", color: "var(--text-muted)",
                cursor: "pointer", "font-size": "18px", "flex-shrink": "0",
              }}
            >&times;</button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: "16px 24px 20px", display: "flex", "flex-direction": "column", gap: "0", "overflow-y": "auto", flex: "1", "min-height": "0" }}>

            {/* ── Date/time row ── */}
            <div style={{
              display: "flex", "flex-direction": "column", gap: "6px",
              padding: "10px 0", "border-bottom": "1px solid color-mix(in srgb, var(--border-color) 50%, transparent)",
            }}>
              <div style={{ display: "flex", "align-items": "center", "justify-content": "center", gap: "8px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
                  <DateRangePicker
                    startValue={startAt()}
                    endValue={endAt()}
                    onStartChange={(v) => { setStartAt(v); setErrors((p) => { const { startAt: _, ...rest } = p; return rest; }); }}
                    onEndChange={(v) => { setEndAt(v); setErrors((p) => { const { endAt: _, ...rest } = p; return rest; }); }}
                    isAllDay={isAllDay()}
                    locale="fr"
                  />
                  <Show when={errors().startAt || errors().endAt}>
                    <span style={{ "font-size": "11px", color: "#e74c3c" }}>{errors().startAt || errors().endAt}</span>
                  </Show>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <span style={{ "font-size": "12px", color: isAllDay() ? "var(--text-primary)" : "var(--text-muted)", transition: "var(--transition-fast)" }}>
                      {t("calendar.allDay")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAllDay(!isAllDay())}
                      style={{
                        width: "34px", height: "18px", "border-radius": "9px",
                        border: "none", cursor: "pointer",
                        background: isAllDay() ? "var(--accent-primary)" : "var(--border-color)",
                        position: "relative", transition: "var(--transition-fast)",
                        "flex-shrink": "0",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: "2px",
                        left: isAllDay() ? "18px" : "2px",
                        width: "14px", height: "14px",
                        "border-radius": "50%", background: "white",
                        transition: "var(--transition-fast)",
                  }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Location row ── */}
            <div style={{
              padding: "10px 0", "border-bottom": "1px solid color-mix(in srgb, var(--border-color) 50%, transparent)",
            }}>
              <LocationPicker
                location={location()}
                latitude={latitude()}
                longitude={longitude()}
                onLocationChange={(loc, lat, lng) => { setLocation(loc); setLatitude(lat); setLongitude(lng); }}
              />
            </div>

            {/* ── Calendar selector row ── */}
            <Show when={!isEditing() && calendars().length > 1}>
              <div style={{
                display: "flex", "align-items": "center", gap: "10px",
                padding: "10px 0", "border-bottom": "1px solid color-mix(in srgb, var(--border-color) 50%, transparent)",
              }}>
                <div style={{
                  width: "28px", height: "28px", display: "flex",
                  "align-items": "center", "justify-content": "center",
                  "flex-shrink": "0",
                }}>
                  <div style={{
                    width: "12px", height: "12px", "border-radius": "50%",
                    background: calColor(),
                  }} />
                </div>
                <select
                  value={calendarId()}
                  onChange={(e) => setCalendarId(e.currentTarget.value)}
                  style={{
                    flex: "1", border: "none", background: "transparent",
                    color: "var(--text-primary)", "font-size": "13px", outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <For each={calendars()}>
                    {(cal) => <option value={cal.id}>{cal.name}</option>}
                  </For>
                </select>
              </div>
            </Show>
            <Show when={errors().calendar}>
              <span style={{ "font-size": "11px", color: "#e74c3c", padding: "4px 0" }}>{errors().calendar}</span>
            </Show>

            {/* ── Reminder row ── */}
            <Show when={!isEditing()}>
              <div style={{
                display: "flex", "align-items": "center", gap: "10px",
                padding: "10px 0", "border-bottom": "1px solid color-mix(in srgb, var(--border-color) 50%, transparent)",
              }}>
                <div style={{
                  width: "28px", height: "28px", display: "flex",
                  "align-items": "center", "justify-content": "center",
                  "flex-shrink": "0",
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--text-muted)">
                    <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/>
                  </svg>
                </div>
                <div style={{ display: "flex", gap: "4px", flex: "1", "flex-wrap": "wrap" }}>
                  <For each={REMINDER_OPTIONS}>
                    {(opt) => {
                      const active = () => reminderSet().has(opt.value);
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setReminderSet((prev) => {
                              const next = new Set(prev);
                              if (opt.value === 0) return new Set([0]);
                              next.delete(0);
                              if (next.has(opt.value)) next.delete(opt.value);
                              else next.add(opt.value);
                              return next.size === 0 ? new Set([0]) : next;
                            });
                          }}
                          style={{
                            padding: "3px 10px",
                            "border-radius": "12px",
                            border: active() ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                            background: active() ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "transparent",
                            color: active() ? "var(--accent-primary)" : "var(--text-muted)",
                            "font-size": "11px", "font-weight": "500",
                            cursor: "pointer", transition: "var(--transition-fast)",
                          }}
                        >{opt.label}</button>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>

            {/* ── Description ── */}
            <div style={{ padding: "10px 0" }}>
              <textarea
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder={t("common.add") + "..."}
                rows={2}
                style={{
                  width: "100%", border: "none", background: "transparent",
                  color: "var(--text-primary)", "font-size": "13px", outline: "none",
                  resize: "vertical", "font-family": "inherit",
                  "min-height": "48px", padding: "0", "box-sizing": "border-box",
                }}
              />
            </div>

            {/* ── Actions ── */}
            <div style={{
              display: "flex", gap: "8px", "align-items": "center",
              "padding-top": "12px", "border-top": "1px solid var(--border-color)",
            }}>
              <Show when={isEditing()}>
                <Button variant="ghost" onClick={async () => {
                  await deleteEvent(editingEvent()!.id);
                  closeForm();
                }} style={{ color: "#e74c3c" }}>{t("common.delete")}</Button>
              </Show>
              <div style={{ flex: "1" }} />
              <Button variant="ghost" onClick={closeForm}>{t("common.cancel")}</Button>
              <Button variant="primary" type="submit">{isEditing() ? t("common.edit") : t("common.create")}</Button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
