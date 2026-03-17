import { createMemo, createSignal, Show } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { Button } from "../common/Button";

const QUICK_AMOUNTS = [
  { label: "Verre", ml: 250 },
  { label: "Tasse", ml: 200 },
  { label: "Gourde", ml: 500 },
];

export function WaterTracker() {
  const { getLog, incrementLog, setGoal } = useWellnessStore();
  const [editingGoal, setEditingGoal] = createSignal(false);
  const [goalInput, setGoalInput] = createSignal(2000);

  const log = createMemo(() => getLog("water"));
  const value = () => log()?.value ?? 0;
  const goal = () => log()?.goal ?? 2000;
  const progress = () => Math.min(100, (value() / goal()) * 100);
  const liters = () => (value() / 1000).toFixed(1);
  const goalLiters = () => (goal() / 1000).toFixed(1);

  return (
    <div>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", "margin-bottom": "8px" }}>
        <button
          onClick={() => { setGoalInput(goal()); setEditingGoal(!editingGoal()); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            "font-size": "11px", color: "var(--text-muted)",
          }}
        >
          Objectif: {goalLiters()}L
        </button>
      </div>

      <Show when={editingGoal()}>
        <div style={{ display: "flex", gap: "6px", "margin-bottom": "12px", "align-items": "center" }}>
          <input
            type="number"
            min="500"
            max="5000"
            step="100"
            value={goalInput()}
            onInput={(e) => setGoalInput(Number(e.target.value))}
            style={{
              width: "80px", padding: "4px 8px", "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)", background: "var(--bg-elevated)",
              color: "var(--text-primary)", "font-size": "12px", "text-align": "center",
            }}
          />
          <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>ml</span>
          <Button variant="primary" size="sm" onClick={() => { setGoal("water", goalInput()); setEditingGoal(false); }}
            style={{ "font-size": "11px", padding: "2px 8px" }}>
            OK
          </Button>
        </div>
      </Show>

      {/* Progress bar */}
      <div style={{ "margin-bottom": "12px" }}>
        <div style={{
          height: "24px",
          "border-radius": "12px",
          background: "var(--bg-elevated)",
          overflow: "hidden",
          position: "relative",
        }}>
          <div style={{
            height: "100%",
            width: `${progress()}%`,
            background: "linear-gradient(90deg, #74b9ff, #0984e3)",
            "border-radius": "12px",
            transition: "width 0.3s ease",
          }} />
          <span style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            "font-size": "12px",
            "font-weight": "600",
            color: "var(--text-primary)",
          }}>
            {liters()}L / {goalLiters()}L
          </span>
        </div>
      </div>

      {/* Quick add buttons */}
      <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
        {QUICK_AMOUNTS.map((item) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => incrementLog("water", item.ml)}
            style={{ "font-size": "11px", flex: "1" }}
          >
            + {item.label} ({item.ml}ml)
          </Button>
        ))}
      </div>

      {/* Undo button */}
      <Show when={value() > 0}>
        <div style={{ "margin-top": "8px", "text-align": "right" }}>
          <button
            onClick={() => incrementLog("water", -250)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              "font-size": "11px", color: "var(--text-muted)",
            }}
          >
            Annuler -250ml
          </button>
        </div>
      </Show>
    </div>
  );
}
