import { For } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";

const SOURCE_FILTERS = [
  { key: "connector" as const, label: "Tâches", color: "#7B68EE", shape: "round" },
  { key: "birthdays" as const, label: "Anniversaires", color: "#fd79a8", shape: "round" },
  { key: "alarms" as const, label: "Alarmes", color: "#e17055", shape: "round" },
] as const;

function FilterRow(props: { label: string; color: string; active: boolean; shape?: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        width: "100%",
        padding: "5px 4px",
        "border-radius": "var(--radius-sm)",
        "text-align": "left",
        opacity: props.active ? "1" : "0.35",
        transition: "opacity 0.15s",
      }}
    >
      <div style={{
        width: "10px",
        height: "10px",
        "border-radius": props.shape === "round" ? "50%" : "3px",
        background: props.color,
        "flex-shrink": "0",
      }} />
      <span style={{
        "font-size": "12px",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {props.label}
      </span>
    </button>
  );
}

export function CalendarList() {
  const {
    calendars, activeCalendarIds, toggleCalendarVisibility,
    showBirthdays, showConnectorEvents, showAlarms, toggleSourceFilter,
  } = useCalendarStore();

  const isSourceActive = (key: "birthdays" | "connector" | "alarms") => {
    if (key === "birthdays") return showBirthdays();
    if (key === "connector") return showConnectorEvents();
    return showAlarms();
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
      <For each={calendars().filter((c) => c.name !== "ClickUp")}>
        {(cal) => (
          <FilterRow
            label={cal.name}
            color={cal.color}
            active={activeCalendarIds().has(cal.id)}
            shape="square"
            onClick={() => toggleCalendarVisibility(cal.id)}
          />
        )}
      </For>

      <div style={{ height: "6px" }} />

      <For each={SOURCE_FILTERS}>
        {(source) => (
          <FilterRow
            label={source.label}
            color={source.color}
            active={isSourceActive(source.key)}
            shape="round"
            onClick={() => toggleSourceFilter(source.key)}
          />
        )}
      </For>
    </div>
  );
}
