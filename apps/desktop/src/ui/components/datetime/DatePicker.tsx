import { createSignal } from "solid-js";
import type { DatePickerProps } from "./types";
import { formatDate } from "./utils";
import { Popover } from "./Popover";
import { CalendarGrid } from "./CalendarGrid";

export function DatePicker(props: DatePickerProps) {
  const [open, setOpen] = createSignal(false);
  let triggerRef: HTMLButtonElement | undefined;

  function handleSelect(date: string) {
    props.onChange(date);
    setOpen(false);
    triggerRef?.focus();
  }

  const locale = () => props.locale ?? "fr";
  const display = () => formatDate(props.value, locale()) || props.placeholder || "Choisir une date";
  const hasValue = () => !!props.value;

  const borderRadius = () => {
    const r = "var(--radius-md)";
    const p = props.position;
    if (p === "left") return `${r} 0 0 ${r}`;
    if (p === "right") return `0 ${r} ${r} 0`;
    if (p === "middle") return "0";
    return r;
  };

  const borderSides = () => {
    const p = props.position;
    const b = open() ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)";
    return {
      "border-right": (p === "left" || p === "middle") ? "none" : b,
      "border-left": (p === "right" || p === "middle") ? "none" : b,
    };
  };

  return (
    <div style={{ position: "relative", display: props.position ? "flex" : "inline-flex", ...props.style }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={props.disabled}
        onClick={() => setOpen(!open())}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "6px 10px",
          width: "100%",
          "border-radius": borderRadius(),
          border: open() ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
          ...borderSides(),
          background: "var(--bg-elevated)",
          color: hasValue() ? "var(--text-primary)" : "var(--text-muted)",
          "font-size": "13px",
          cursor: props.disabled ? "default" : "pointer",
          transition: "var(--transition-fast)",
          "box-shadow": open() ? "0 0 0 2px color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "none",
          "white-space": "nowrap",
          opacity: props.disabled ? "0.5" : "1",
          position: "relative",
          "z-index": open() ? "1" : "0",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--text-muted)" style={{ "flex-shrink": "0" }}>
          <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1H2zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5z"/>
        </svg>
        <span>{display()}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="var(--text-muted)" style={{ "flex-shrink": "0", "margin-left": "auto" }}>
          <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>

      <Popover isOpen={open()} onClose={() => setOpen(false)} triggerRef={triggerRef}>
        <CalendarGrid
          selectedDate={props.value}
          onSelect={handleSelect}
          locale={locale()}
          min={props.min}
          max={props.max}
        />
      </Popover>
    </div>
  );
}
