import { createSignal, For } from "solid-js";
import type { TimePickerProps } from "./types";
import { generateTimeSlots } from "./utils";
import { Popover } from "./Popover";

const numInputStyle = {
  width: "36px",
  padding: "4px 2px",
  "border-radius": "var(--radius-sm)",
  border: "1px solid var(--border-color)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  "font-size": "13px",
  "font-weight": "600",
  "text-align": "center" as const,
  outline: "none",
  "font-variant-numeric": "tabular-nums",
  "box-sizing": "border-box" as const,
};

export function TimePicker(props: TimePickerProps) {
  const [open, setOpen] = createSignal(false);
  let triggerRef: HTMLButtonElement | undefined;
  let listRef: HTMLDivElement | undefined;
  let hourRef: HTMLInputElement | undefined;
  let minRef: HTMLInputElement | undefined;

  const step = () => props.step ?? 15;
  const slots = () => generateTimeSlots(step(), props.min, props.max);
  const display = () => props.value || props.placeholder || "Heure";
  const hasValue = () => !!props.value;

  const currentH = () => props.value ? props.value.slice(0, 2) : "00";
  const currentM = () => props.value ? props.value.slice(3, 5) : "00";

  function pad(n: number, max: number): string {
    const clamped = Math.max(0, Math.min(max, n));
    return String(clamped).padStart(2, "0");
  }

  function commitTime(h: string, m: string) {
    const hh = pad(parseInt(h) || 0, 23);
    const mm = pad(parseInt(m) || 0, 59);
    props.onChange(`${hh}:${mm}`);
  }

  function handleHourInput(e: InputEvent & { currentTarget: HTMLInputElement }) {
    const v = e.currentTarget.value.replace(/\D/g, "").slice(0, 2);
    e.currentTarget.value = v;
    if (v.length === 2) {
      commitTime(v, currentM());
      minRef?.focus();
      minRef?.select();
    }
  }

  function handleMinInput(e: InputEvent & { currentTarget: HTMLInputElement }) {
    const v = e.currentTarget.value.replace(/\D/g, "").slice(0, 2);
    e.currentTarget.value = v;
    if (v.length === 2) {
      commitTime(currentH(), v);
    }
  }

  function handleHourBlur(e: FocusEvent & { currentTarget: HTMLInputElement }) {
    const v = e.currentTarget.value;
    if (v) commitTime(v, currentM());
  }

  function handleMinBlur(e: FocusEvent & { currentTarget: HTMLInputElement }) {
    const v = e.currentTarget.value;
    if (v) commitTime(currentH(), v);
  }

  function handleHourKeyDown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === "ArrowUp") { e.preventDefault(); const n = ((parseInt(currentH()) || 0) + 1) % 24; commitTime(pad(n, 23), currentM()); e.currentTarget.value = pad(n, 23); }
    if (e.key === "ArrowDown") { e.preventDefault(); const n = ((parseInt(currentH()) || 0) - 1 + 24) % 24; commitTime(pad(n, 23), currentM()); e.currentTarget.value = pad(n, 23); }
    if (e.key === ":" || e.key === "Tab") { e.preventDefault(); minRef?.focus(); minRef?.select(); }
  }

  function handleMinKeyDown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === "ArrowUp") { e.preventDefault(); const n = ((parseInt(currentM()) || 0) + 1) % 60; commitTime(currentH(), pad(n, 59)); e.currentTarget.value = pad(n, 59); }
    if (e.key === "ArrowDown") { e.preventDefault(); const n = ((parseInt(currentM()) || 0) - 1 + 60) % 60; commitTime(currentH(), pad(n, 59)); e.currentTarget.value = pad(n, 59); }
    if (e.key === "Enter") { e.preventDefault(); setOpen(false); triggerRef?.focus(); }
  }

  function handleSelect(time: string) {
    props.onChange(time);
    setOpen(false);
    triggerRef?.focus();
  }

  function scrollToSelected() {
    if (!listRef || !props.value) return;
    const selected = listRef.querySelector("[data-selected]") as HTMLElement | null;
    selected?.scrollIntoView({ block: "nearest" });
  }

  function openPicker() {
    setOpen(true);
    requestAnimationFrame(() => {
      hourRef?.focus();
      hourRef?.select();
      scrollToSelected();
    });
  }

  const borderRadius = () => {
    const r = "var(--radius-md)";
    if (props.position === "left") return `${r} 0 0 ${r}`;
    if (props.position === "right") return `0 ${r} ${r} 0`;
    if (props.position === "middle") return "0";
    return r;
  };

  const borderLeft = () => {
    if (props.position === "right" || props.position === "middle") return "none";
    return open() ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)";
  };

  return (
    <div style={{ position: "relative", display: props.position ? "flex" : "inline-flex", ...props.style }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={props.disabled}
        onClick={() => { if (open()) setOpen(false); else openPicker(); }}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          padding: "6px 10px",
          width: "100%",
          "border-radius": borderRadius(),
          border: open() ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
          "border-left": borderLeft(),
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
          <path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z"/>
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
        </svg>
        <span>{display()}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="var(--text-muted)" style={{ "flex-shrink": "0", "margin-left": "auto" }}>
          <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>

      <Popover isOpen={open()} onClose={() => setOpen(false)} triggerRef={triggerRef}>
        <div style={{ width: "160px" }}>
          {/* HH : MM inputs */}
          <div style={{ display: "flex", "align-items": "center", "justify-content": "center", gap: "4px", padding: "8px 6px 4px" }}>
            <input
              ref={hourRef}
              type="text"
              inputMode="numeric"
              placeholder="HH"
              value={currentH()}
              onInput={handleHourInput}
              onBlur={handleHourBlur}
              onKeyDown={handleHourKeyDown}
              onFocus={(e) => e.currentTarget.select()}
              maxLength={2}
              style={numInputStyle}
            />
            <span style={{ "font-size": "14px", "font-weight": "700", color: "var(--text-muted)" }}>:</span>
            <input
              ref={minRef}
              type="text"
              inputMode="numeric"
              placeholder="MM"
              value={currentM()}
              onInput={handleMinInput}
              onBlur={handleMinBlur}
              onKeyDown={handleMinKeyDown}
              onFocus={(e) => e.currentTarget.select()}
              maxLength={2}
              style={numInputStyle}
            />
          </div>

          {/* Quick slots */}
          <div
            ref={(el) => { listRef = el; requestAnimationFrame(scrollToSelected); }}
            style={{
              "max-height": "200px",
              "overflow-y": "auto",
              padding: "4px 0",
              "border-top": "1px solid var(--border-color)",
              "margin-top": "4px",
            }}
          >
            <For each={slots()}>
              {(slot) => {
                const isSelected = () => slot === props.value;
                return (
                  <button
                    type="button"
                    data-selected={isSelected() ? "" : undefined}
                    onClick={() => handleSelect(slot)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "5px 14px",
                      border: "none",
                      background: isSelected() ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "transparent",
                      color: isSelected() ? "var(--accent-primary)" : "var(--text-primary)",
                      "font-size": "13px",
                      "font-weight": isSelected() ? "500" : "400",
                      "text-align": "left",
                      cursor: "pointer",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    {slot}
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Popover>
    </div>
  );
}
