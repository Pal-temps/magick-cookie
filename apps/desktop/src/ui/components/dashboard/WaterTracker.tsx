import { createMemo, createSignal, Show } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { useT } from "../../../i18n/context";

const QUICK_AMOUNTS = [
  { labelKey: "dashboard.glass", ml: 200, icon: "\u{1F95B}" },
  { labelKey: "dashboard.cup", ml: 250, icon: "\u{2615}" },
  { labelKey: "dashboard.bottle", ml: 500, icon: "\u{1FAD7}" },
];

export function WaterTracker() {
  const { getLog, incrementLog, setGoal } = useWellnessStore();
  const { t } = useT();
  const [editingGoal, setEditingGoal] = createSignal(false);
  const [goalInput, setGoalInput] = createSignal(2000);

  const log = createMemo(() => getLog("water"));
  const value = () => log()?.value ?? 0;
  const goal = () => log()?.goal ?? 2000;
  const progress = () => Math.min(100, (value() / goal()) * 100);
  const liters = () => (value() / 1000).toFixed(1);
  const goalLiters = () => (goal() / 1000).toFixed(1);
  const done = () => value() >= goal();

  return (
    <div>
      {/* Big number + progress ring */}
      <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "12px" }}>
        <div style={{ position: "relative", width: "56px", height: "56px", "flex-shrink": "0" }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-elevated)" stroke-width="4" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              stroke={done() ? "#00b894" : "#0984e3"}
              stroke-width="4"
              stroke-dasharray={`${2 * Math.PI * 24}`}
              stroke-dashoffset={`${2 * Math.PI * 24 * (1 - progress() / 100)}`}
              stroke-linecap="round"
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
          </svg>
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            "font-size": "11px", "font-weight": "700", color: done() ? "#00b894" : "var(--text-primary)",
          }}>
            {Math.round(progress())}%
          </div>
        </div>
        <div style={{ flex: "1", "min-width": "0" }}>
          <div style={{ "font-size": "20px", "font-weight": "700", color: done() ? "#00b894" : "var(--text-primary)", "line-height": "1.1" }}>
            {liters()}L
          </div>
          <button
            onClick={() => { setGoalInput(goal()); setEditingGoal(!editingGoal()); }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "0",
              "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px",
            }}
          >
            / {goalLiters()}L {editingGoal() ? "▴" : "▾"}
          </button>
        </div>
        {/* Undo */}
        <Show when={value() > 0}>
          <button
            onClick={() => incrementLog("water", -250)}
            title={t("dashboard.undoAmount")}
            style={{
              display: "flex", "align-items": "center", "justify-content": "center",
              width: "28px", height: "28px", "border-radius": "var(--radius-sm)",
              border: "1px solid var(--border-color)", background: "transparent",
              color: "var(--text-muted)", cursor: "pointer", "font-size": "14px",
              "flex-shrink": "0",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
            </svg>
          </button>
        </Show>
      </div>

      {/* Goal editor */}
      <Show when={editingGoal()}>
        <div style={{
          display: "flex", gap: "6px", "margin-bottom": "10px", "align-items": "center",
          padding: "8px", "border-radius": "var(--radius-md)", background: "var(--bg-elevated)",
          border: "1px solid var(--border-color)",
        }}>
          <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>{t("dashboard.goal")}</span>
          <input
            type="range" min="500" max="4000" step="100"
            value={goalInput()}
            onInput={(e) => setGoalInput(Number(e.target.value))}
            style={{ flex: "1", "accent-color": "#0984e3" }}
          />
          <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary)", "min-width": "40px", "text-align": "right" }}>
            {(goalInput() / 1000).toFixed(1)}L
          </span>
          <button
            onClick={() => { setGoal("water", goalInput()); setEditingGoal(false); }}
            style={{
              padding: "3px 10px", "border-radius": "var(--radius-md)",
              border: "none", background: "#0984e3", color: "#fff",
              "font-size": "11px", "font-weight": "600", cursor: "pointer",
            }}
          >OK</button>
        </div>
      </Show>

      {/* Quick add buttons */}
      <div style={{ display: "flex", gap: "6px" }}>
        {QUICK_AMOUNTS.map((item) => (
          <button
            onClick={() => incrementLog("water", item.ml)}
            style={{
              flex: "1",
              display: "flex", "flex-direction": "column", "align-items": "center",
              gap: "2px", padding: "8px 4px",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "var(--transition-fast)",
              "font-size": "12px",
            }}
          >
            <span style={{ "font-size": "16px", "line-height": "1" }}>{item.icon}</span>
            <span style={{ "font-size": "11px", "font-weight": "600" }}>+{item.ml}ml</span>
          </button>
        ))}
      </div>
    </div>
  );
}
