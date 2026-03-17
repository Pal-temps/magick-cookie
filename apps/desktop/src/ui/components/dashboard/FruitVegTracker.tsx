import { createMemo, For } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { Button } from "../common/Button";

export function FruitVegTracker() {
  const { getLog, incrementLog } = useWellnessStore();

  const log = createMemo(() => getLog("fruits_veggies"));
  const value = () => log()?.value ?? 0;
  const goal = () => log()?.goal ?? 5;

  const circles = createMemo(() => {
    const g = goal();
    const v = value();
    return Array.from({ length: g }, (_, i) => i < v);
  });

  return (
    <div>
      <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "12px" }}>
        1 portion = ~80g (cru ou cuit) ou 1 fruit entier
      </div>

      {/* Visual circles */}
      <div style={{ display: "flex", gap: "8px", "justify-content": "center", "margin-bottom": "16px" }}>
        <For each={circles()}>
          {(filled) => (
            <div style={{
              width: "36px",
              height: "36px",
              "border-radius": "50%",
              background: filled ? "linear-gradient(135deg, #00b894, #55efc4)" : "var(--bg-elevated)",
              border: filled ? "2px solid #00b894" : "2px solid var(--border-color)",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              transition: "all 0.2s ease",
            }}>
              {filled && <span style={{ "font-size": "14px" }}>&#10003;</span>}
            </div>
          )}
        </For>
      </div>

      {/* Counter */}
      <div style={{ "text-align": "center", "margin-bottom": "12px" }}>
        <span style={{
          "font-size": "20px", "font-weight": "700",
          color: value() >= goal() ? "#00b894" : "var(--text-primary)",
        }}>
          {value()}
        </span>
        <span style={{ "font-size": "14px", color: "var(--text-muted)" }}> / {goal()} portions</span>
      </div>

      {/* +/- buttons */}
      <div style={{ display: "flex", gap: "8px", "justify-content": "center" }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => incrementLog("fruits_veggies", -1)}
          disabled={value() <= 0}
          style={{ width: "44px" }}
        >
          -1
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => incrementLog("fruits_veggies", 1)}
          style={{ flex: "1", "max-width": "160px" }}
        >
          +1 portion
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => incrementLog("fruits_veggies", 2)}
          style={{ width: "44px" }}
        >
          +2
        </Button>
      </div>

      <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "8px", "text-align": "center" }}>
        Un plat de legumes cuits = 2-3 portions
      </div>
    </div>
  );
}
