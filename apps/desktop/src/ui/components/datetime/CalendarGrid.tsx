import { createSignal, For, Show } from "solid-js";
import type { Locale } from "./types";
import { getLocale } from "./locale";
import { getDaysInMonth, getFirstDayOfWeek, addMonths, toISODate, todayISO } from "./utils";

interface CalendarGridProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  locale?: Locale;
  min?: string;
  max?: string;
}

interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
}

type View = "days" | "months" | "years";

export function CalendarGrid(props: CalendarGridProps) {
  const initial = props.selectedDate
    ? { year: parseInt(props.selectedDate.slice(0, 4)), month: parseInt(props.selectedDate.slice(5, 7)) - 1 }
    : { year: new Date().getFullYear(), month: new Date().getMonth() };

  const [viewYear, setViewYear] = createSignal(initial.year);
  const [viewMonth, setViewMonth] = createSignal(initial.month);
  const [view, setView] = createSignal<View>("days");
  const [yearRangeStart, setYearRangeStart] = createSignal(Math.floor(initial.year / 12) * 12);

  const locale = () => getLocale(props.locale);
  const today = todayISO();

  function navigate(delta: number) {
    if (view() === "years") {
      setYearRangeStart(yearRangeStart() + delta * 12);
    } else if (view() === "months") {
      setViewYear(viewYear() + delta);
    } else {
      const next = addMonths(viewYear(), viewMonth(), delta);
      setViewYear(next.year);
      setViewMonth(next.month);
    }
  }

  function selectMonth(m: number) {
    setViewMonth(m);
    setView("days");
  }

  function selectYear(y: number) {
    setViewYear(y);
    setYearRangeStart(Math.floor(y / 12) * 12);
    setView("months");
  }

  function headerLabel(): string {
    if (view() === "years") {
      const start = yearRangeStart();
      return `${start} — ${start + 11}`;
    }
    if (view() === "months") {
      return `${viewYear()}`;
    }
    // Use short month names to avoid overflow
    return `${locale().monthsShort[viewMonth()]} ${viewYear()}`;
  }

  function handleHeaderClick() {
    if (view() === "days") setView("months");
    else if (view() === "months") { setYearRangeStart(Math.floor(viewYear() / 12) * 12); setView("years"); }
    else setView("days");
  }

  function cells(): DayCell[] {
    const y = viewYear();
    const m = viewMonth();
    const daysInMonth = getDaysInMonth(y, m);
    const firstDay = getFirstDayOfWeek(y, m);
    const result: DayCell[] = [];

    if (firstDay > 0) {
      const prev = addMonths(y, m, -1);
      const prevDays = getDaysInMonth(prev.year, prev.month);
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = prevDays - i;
        const date = toISODate(prev.year, prev.month, d);
        result.push({ date, day: d, inMonth: false, disabled: isDisabled(date) });
      }
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = toISODate(y, m, d);
      result.push({ date, day: d, inMonth: true, disabled: isDisabled(date) });
    }

    const remaining = 42 - result.length;
    const next = addMonths(y, m, 1);
    for (let d = 1; d <= remaining; d++) {
      const date = toISODate(next.year, next.month, d);
      result.push({ date, day: d, inMonth: false, disabled: isDisabled(date) });
    }

    return result;
  }

  function isDisabled(date: string): boolean {
    if (props.min && date < props.min) return true;
    if (props.max && date > props.max) return true;
    return false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (view() !== "days" || !props.selectedDate) return;
    const d = new Date(props.selectedDate + "T00:00");
    let moved = false;

    if (e.key === "ArrowLeft") { d.setDate(d.getDate() - 1); moved = true; }
    else if (e.key === "ArrowRight") { d.setDate(d.getDate() + 1); moved = true; }
    else if (e.key === "ArrowUp") { d.setDate(d.getDate() - 7); moved = true; }
    else if (e.key === "ArrowDown") { d.setDate(d.getDate() + 7); moved = true; }

    if (moved) {
      e.preventDefault();
      const iso = toISODate(d.getFullYear(), d.getMonth(), d.getDate());
      if (!isDisabled(iso)) {
        props.onSelect(iso);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }

  const navBtnStyle = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    "border-radius": "var(--radius-sm)",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    "flex-shrink": "0",
    transition: "var(--transition-fast)",
  };

  const cellBtnStyle = (isActive: boolean) => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    padding: "8px 4px",
    "border-radius": "var(--radius-md)",
    border: "none",
    background: isActive ? "var(--accent-primary)" : "transparent",
    color: isActive ? "var(--accent-primary-text, #fff)" : "var(--text-primary)",
    "font-size": "13px",
    "font-weight": isActive ? "600" : "400",
    cursor: "pointer",
    transition: "var(--transition-fast)",
  });

  return (
    <div style={{ width: "280px", "user-select": "none" }} onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Header */}
      <div style={{
        display: "flex", "align-items": "center", "justify-content": "space-between",
        padding: "10px 8px 8px",
      }}>
        <button type="button" style={navBtnStyle} onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>
        </button>
        <button
          type="button"
          onClick={handleHeaderClick}
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            "font-size": "13px", "font-weight": "600", color: "var(--text-primary)",
            padding: "4px 8px", "border-radius": "var(--radius-sm)",
            transition: "var(--transition-fast)",
            "white-space": "nowrap",
            flex: "1", "min-width": "0",
            overflow: "hidden", "text-overflow": "ellipsis",
          }}
        >
          {headerLabel()}
        </button>
        <button type="button" style={navBtnStyle} onClick={() => navigate(1)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
        </button>
      </div>

      {/* ── Year grid ── */}
      <Show when={view() === "years"}>
        <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "4px", padding: "4px 8px 10px" }}>
          <For each={Array.from({ length: 12 }, (_, i) => yearRangeStart() + i)}>
            {(y) => (
              <button type="button" onClick={() => selectYear(y)} style={cellBtnStyle(y === viewYear())}>
                {y}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* ── Month grid ── */}
      <Show when={view() === "months"}>
        <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "4px", padding: "4px 8px 10px" }}>
          <For each={locale().monthsShort}>
            {(name, i) => (
              <button type="button" onClick={() => selectMonth(i())} style={cellBtnStyle(i() === viewMonth())}>
                {name}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* ── Day view ── */}
      <Show when={view() === "days"}>
        {/* Day-of-week headers */}
        <div style={{ display: "grid", "grid-template-columns": "repeat(7, 1fr)", padding: "0 8px 4px" }}>
          <For each={locale().days}>
            {(d) => (
              <div style={{
                "text-align": "center", "font-size": "10px", "font-weight": "600",
                color: "var(--text-muted)", "text-transform": "uppercase", padding: "2px 0",
              }}>{d}</div>
            )}
          </For>
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", "grid-template-columns": "repeat(7, 1fr)", gap: "2px", padding: "0 8px 10px" }}>
          <For each={cells()}>
            {(cell) => {
              const isSelected = () => cell.date === props.selectedDate;
              const isToday = () => cell.date === today;

              return (
                <button
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => { if (!cell.disabled) props.onSelect(cell.date); }}
                  style={{
                    width: "36px", height: "36px",
                    display: "flex", "align-items": "center", "justify-content": "center",
                    "border-radius": "var(--radius-sm)",
                    border: isToday() && !isSelected() ? "1px solid var(--accent-primary)" : "1px solid transparent",
                    background: isSelected() ? "var(--accent-primary)" : "transparent",
                    color: isSelected()
                      ? "var(--accent-primary-text, #fff)"
                      : cell.disabled ? "var(--text-muted)"
                      : cell.inMonth ? "var(--text-primary)" : "var(--text-muted)",
                    opacity: cell.inMonth ? "1" : "0.35",
                    "font-size": "13px",
                    "font-weight": isSelected() || isToday() ? "600" : "400",
                    cursor: cell.disabled ? "default" : "pointer",
                    transition: "var(--transition-fast)",
                    padding: "0",
                  }}
                >
                  {cell.day}
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Today shortcut */}
      <div style={{
        "border-top": "1px solid var(--border-color)",
        padding: "6px 12px", "text-align": "center",
      }}>
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            const iso = toISODate(now.getFullYear(), now.getMonth(), now.getDate());
            props.onSelect(iso);
            setViewYear(now.getFullYear());
            setViewMonth(now.getMonth());
            setView("days");
          }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--accent-primary)", "font-size": "12px", "font-weight": "500",
            padding: "2px 8px",
          }}
        >{locale().today}</button>
      </div>
    </div>
  );
}
