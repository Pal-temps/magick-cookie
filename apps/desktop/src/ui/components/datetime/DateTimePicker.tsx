import type { DateTimePickerProps } from "./types";
import { parseDateTime } from "./utils";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";

export function DateTimePicker(props: DateTimePickerProps) {
  const date = () => parseDateTime(props.value).date;
  const time = () => parseDateTime(props.value).time;

  function handleDateChange(newDate: string) {
    props.onChange(`${newDate}T${time() || "00:00"}`);
  }

  function handleTimeChange(newTime: string) {
    props.onChange(`${date() || new Date().toISOString().slice(0, 10)}T${newTime}`);
  }

  return (
    <div style={{ display: "flex", "align-items": "center", ...props.style }}>
      <DatePicker
        value={date()}
        onChange={handleDateChange}
        locale={props.locale}
        disabled={props.disabled}
        placeholder={props.placeholder}
        position="left"
        style={{ "flex-shrink": "0" }}
      />
      <TimePicker
        value={time()}
        onChange={handleTimeChange}
        step={props.timeStep}
        disabled={props.disabled}
        position="right"
        style={{ "flex-shrink": "0" }}
      />
    </div>
  );
}
