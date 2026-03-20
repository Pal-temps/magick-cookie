import { onMount, onCleanup } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { useAlarmStore } from "../../../application/stores/alarmStore";

interface CellContextMenuProps {
  x: number;
  y: number;
  date: Date;
  hour?: number;
  onClose: () => void;
}

export function CellContextMenu(props: CellContextMenuProps) {
  const { openCreateFormAtDate } = useCalendarStore();
  const { createAlarm } = useAlarmStore();

  let menuRef: HTMLDivElement | undefined;

  function handleClickOutside(e: MouseEvent) {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  }

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  function handleNewEvent() {
    openCreateFormAtDate(props.date, props.hour);
    props.onClose();
  }

  function handleNewAlarm() {
    const time = props.hour !== undefined
      ? `${String(props.hour).padStart(2, "0")}:00`
      : "08:00";
    createAlarm({
      time,
      label: "Nouvelle alarme",
      repeatPattern: "once",
      enabled: true,
    });
    props.onClose();
  }

  const itemStyle = {
    display: "block",
    width: "100%",
    padding: "6px 12px",
    "font-size": "12px",
    color: "var(--text-primary)",
    background: "none",
    border: "none",
    "text-align": "left" as const,
    cursor: "pointer",
    "border-radius": "var(--radius-sm)",
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: `${props.x}px`,
        top: `${props.y}px`,
        "min-width": "160px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        "border-radius": "var(--radius-md)",
        "box-shadow": "0 4px 12px rgba(0,0,0,0.3)",
        "z-index": "1000",
        padding: "4px",
      }}
    >
      <button
        style={itemStyle}
        onClick={handleNewEvent}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        Nouvel evenement
      </button>
      <button
        style={itemStyle}
        onClick={handleNewAlarm}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        Nouvelle alarme
      </button>
    </div>
  );
}
