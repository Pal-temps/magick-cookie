import { createMemo, For } from "solid-js";
import { useWellnessStore } from "../../../application/stores/wellnessStore";
import { Button } from "../common/Button";
import { useT } from "../../../i18n/context";

export function FruitVegTracker() {
  const { getLog, incrementLog } = useWellnessStore();
  const { t } = useT();

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
      {/* Circles + counter inline */}
      <div style={{ display: "flex", "align-items": "center", gap: "10px", "margin-bottom": "10px" }}>
        <div style={{ display: "flex", gap: "5px", "flex-wrap": "wrap" }}>
          <For each={circles()}>
            {(filled) => (
              <div style={{
                width: "20px",
                height: "20px",
                "border-radius": "50%",
                background: filled ? "linear-gradient(135deg, #00b894, #55efc4)" : "var(--bg-elevated)",
                border: filled ? "2px solid #00b894" : "2px solid var(--border-color)",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                transition: "all 0.2s ease",
                "flex-shrink": "0",
              }}>
                {filled && <span style={{ "font-size": "10px", "line-height": "1" }}>&#10003;</span>}
              </div>
            )}
          </For>
        </div>
        <span style={{
          "font-size": "13px", "font-weight": "600", "white-space": "nowrap",
          color: value() >= goal() ? "#00b894" : "var(--text-primary)",
        }}>
          {value()}/{goal()}
        </span>
      </div>

      {/* +/- buttons */}
      <div style={{ display: "flex", gap: "6px" }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => incrementLog("fruits_veggies", -1)}
          disabled={value() <= 0}
          style={{ width: "36px", "font-size": "12px" }}
        >
          -1
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => incrementLog("fruits_veggies", 1)}
          style={{ flex: "1", "font-size": "12px" }}
        >
          +1
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => incrementLog("fruits_veggies", 2)}
          style={{ width: "36px", "font-size": "12px" }}
        >
          +2
        </Button>
      </div>

      <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "6px" }}>
        {t("dashboard.portionHint")}
      </div>
    </div>
  );
}
