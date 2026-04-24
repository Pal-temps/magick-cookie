import { Show } from "solid-js";
import type { DateRangePickerProps } from "./types";
import { parseDateTime } from "./utils";
import { DatePicker } from "./DatePicker";
import { DateTimePicker } from "./DateTimePicker";

export function DateRangePicker(props: DateRangePickerProps) {
  const locale = () => props.locale ?? "fr";

  function handleStartChange(value: string) {
    props.onStartChange(value);

    // Auto-adjust end if start is moved past it
    const startDate = props.isAllDay ? value : parseDateTime(value).date;
    const endDate = props.isAllDay ? props.endValue : parseDateTime(props.endValue).date;

    if (startDate > endDate) {
      if (props.isAllDay) {
        props.onEndChange(value);
      } else {
        // Preserve the end time, move date to match start
        const endTime = parseDateTime(props.endValue).time || "23:59";
        props.onEndChange(`${parseDateTime(value).date}T${endTime}`);
      }
    }
  }

  return (
    <div style={{ display: "flex", "align-items": "center", "justify-content": "center", gap: "8px", ...props.style }}>
      <Show when={props.isAllDay} fallback={
        <>
          <DateTimePicker
            value={props.startValue}
            onChange={handleStartChange}
            locale={locale()}
            timeStep={props.timeStep}
            disabled={props.disabled}
          />
          <span style={{ "font-size": "12px", color: "var(--text-muted)", "flex-shrink": "0" }}>→</span>
          <DateTimePicker
            value={props.endValue}
            onChange={props.onEndChange}
            locale={locale()}
            timeStep={props.timeStep}
            disabled={props.disabled}
          />
        </>
      }>
        <DatePicker
          value={props.startValue.slice(0, 10)}
          onChange={(v) => handleStartChange(v + "T00:00")}
          locale={locale()}
          disabled={props.disabled}
        />
        <span style={{ "font-size": "12px", color: "var(--text-muted)", "flex-shrink": "0" }}>→</span>
        <DatePicker
          value={props.endValue.slice(0, 10)}
          onChange={(v) => props.onEndChange(v + "T23:59")}
          locale={locale()}
          disabled={props.disabled}
        />
      </Show>
    </div>
  );
}
