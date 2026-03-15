import { Show, createSignal } from "solid-js";
import { useDesktopModeStore } from "../../application/stores/desktopModeStore";
import { useTimerStore } from "../../application/stores/timerStore";
import { useDogWalkStore } from "../../application/stores/dogWalkStore";
import { useCalendarStore } from "../../application/stores/calendarStore";
import { useWellnessStore } from "../../application/stores/wellnessStore";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function WidgetCard(props: { children: any; title?: string }) {
  return (
    <div style={{
      background: "rgba(26, 26, 36, 0.85)",
      "backdrop-filter": "blur(12px)",
      "border-radius": "16px",
      padding: "16px",
      border: "1px solid rgba(42, 42, 64, 0.6)",
      "min-width": "220px",
      "box-shadow": "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <Show when={props.title}>
        <div style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-muted)", "text-transform": "uppercase", "letter-spacing": "0.5px", "margin-bottom": "8px" }}>
          {props.title}
        </div>
      </Show>
      {props.children}
    </div>
  );
}

function ClockWidget() {
  const [time, setTime] = createSignal(new Date());
  setInterval(() => setTime(new Date()), 1000);

  return (
    <WidgetCard>
      <div style={{ "text-align": "center" }}>
        <div style={{ "font-size": "48px", "font-weight": "200", color: "var(--text-primary)", "font-variant-numeric": "tabular-nums", "line-height": "1" }}>
          {time().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ "font-size": "14px", color: "var(--text-secondary)", "margin-top": "4px", "text-transform": "capitalize" }}>
          {time().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>
    </WidgetCard>
  );
}

function TimerWidget() {
  const { timerState, remainingSeconds, pomodoroCount } = useTimerStore();

  return (
    <Show when={timerState() !== "idle"}>
      <WidgetCard title="Timer">
        <div style={{ "text-align": "center" }}>
          <div style={{
            "font-size": "32px",
            "font-weight": "700",
            "font-variant-numeric": "tabular-nums",
            color: timerState() === "focus" ? "var(--accent-primary)" : timerState() === "break" ? "var(--cal-green)" : "var(--text-muted)",
          }}>
            {formatTime(remainingSeconds())}
          </div>
          <div style={{ "font-size": "12px", color: "var(--text-secondary)", "margin-top": "4px" }}>
            {timerState() === "focus" ? "Focus" : timerState() === "break" ? "Pause" : "En pause"}
            {pomodoroCount() > 0 ? ` — Session ${pomodoroCount()}` : ""}
          </div>
        </div>
      </WidgetCard>
    </Show>
  );
}

function DogWalkWidget() {
  const { activeWalk, elapsedSeconds, todayStats } = useDogWalkStore();

  return (
    <WidgetCard title="Balade chien">
      <Show when={activeWalk()} fallback={
        <div style={{ "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
          {todayStats().walkCount > 0
            ? `${todayStats().walkCount} balade${todayStats().walkCount > 1 ? "s" : ""} — ${formatTime(todayStats().totalSeconds)}`
            : "Aucune balade aujourd'hui"
          }
        </div>
      }>
        <div style={{ "text-align": "center" }}>
          <span style={{ "font-size": "20px" }}>🐕</span>
          <div style={{ "font-size": "28px", "font-weight": "700", color: "var(--cal-green)", "font-variant-numeric": "tabular-nums" }}>
            {formatTime(elapsedSeconds())}
          </div>
          <div style={{ "font-size": "11px", color: "var(--text-secondary)", "margin-top": "2px" }}>En balade</div>
        </div>
      </Show>
    </WidgetCard>
  );
}

function NextEventsWidget() {
  const { visibleEvents } = useCalendarStore();

  const upcoming = () => {
    const now = new Date();
    return visibleEvents()
      .filter((e) => new Date(e.startAt) > now && !e.isAllDay)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 3);
  };

  return (
    <WidgetCard title="Prochains evenements">
      <Show when={upcoming().length > 0} fallback={
        <div style={{ color: "var(--text-muted)", "font-size": "13px" }}>Rien de prevu</div>
      }>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          {upcoming().map((ev) => (
            <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
              <span style={{
                "font-size": "12px",
                "font-weight": "600",
                color: "var(--accent-primary)",
                "font-variant-numeric": "tabular-nums",
                "min-width": "45px",
              }}>
                {new Date(ev.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ "font-size": "13px", color: "var(--text-primary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {ev.title}
              </span>
            </div>
          ))}
        </div>
      </Show>
    </WidgetCard>
  );
}

function WellnessWidget() {
  const { todayLogs } = useWellnessStore();

  const waterLog = () => todayLogs().find((l) => l.type === "water");
  const fruitLog = () => todayLogs().find((l) => l.type === "fruit_veg");

  return (
    <WidgetCard title="Bien-etre">
      <div style={{ display: "flex", gap: "16px", "justify-content": "center" }}>
        <Show when={waterLog()}>
          <div style={{ "text-align": "center" }}>
            <div style={{ "font-size": "16px" }}>💧</div>
            <div style={{ "font-size": "14px", "font-weight": "600", color: "var(--cal-blue)" }}>
              {waterLog()!.value}/{waterLog()!.goal}
            </div>
          </div>
        </Show>
        <Show when={fruitLog()}>
          <div style={{ "text-align": "center" }}>
            <div style={{ "font-size": "16px" }}>🍎</div>
            <div style={{ "font-size": "14px", "font-weight": "600", color: "var(--cal-green)" }}>
              {fruitLog()!.value}/{fruitLog()!.goal}
            </div>
          </div>
        </Show>
      </div>
    </WidgetCard>
  );
}

export function DesktopWidgets() {
  const { exitDesktop } = useDesktopModeStore();

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "transparent",
      display: "flex",
      "flex-direction": "column",
      "justify-content": "flex-end",
      "align-items": "flex-end",
      padding: "32px",
      gap: "12px",
      "pointer-events": "none",
      "user-select": "none",
    }}>
      {/* All widgets get pointer-events back */}
      <div style={{
        display: "flex",
        "flex-direction": "column",
        gap: "12px",
        "pointer-events": "auto",
      }}>
        <ClockWidget />
        <TimerWidget />
        <DogWalkWidget />
        <NextEventsWidget />
        <WellnessWidget />

        {/* Exit button */}
        <button
          onClick={exitDesktop}
          style={{
            background: "rgba(26, 26, 36, 0.7)",
            border: "1px solid rgba(42, 42, 64, 0.6)",
            "border-radius": "8px",
            padding: "6px 12px",
            color: "var(--text-secondary)",
            "font-size": "11px",
            cursor: "pointer",
            "text-align": "center",
            transition: "var(--transition-fast)",
          }}
        >
          Quitter le mode bureau
        </button>
      </div>
    </div>
  );
}
