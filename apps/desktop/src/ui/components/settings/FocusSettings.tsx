import { useTimerStore } from "../../../application/stores/timerStore";

export function FocusSettings() {
  const { focusModeEnabled, setFocusModePreference } = useTimerStore();

  return (
    <div style={{ padding: "24px" }}>
      <h2 style={{
        "font-size": "16px",
        "font-weight": "600",
        color: "var(--text-primary)",
        "margin-bottom": "20px",
      }}>
        Mode focus
      </h2>

      <div style={{ "margin-bottom": "24px" }}>
        <label
          style={{
            display: "flex",
            "align-items": "flex-start",
            gap: "12px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={focusModeEnabled()}
            onChange={(e) => setFocusModePreference(e.currentTarget.checked)}
            style={{
              "margin-top": "2px",
              width: "16px",
              height: "16px",
              "accent-color": "var(--accent-primary)",
              cursor: "pointer",
            }}
          />
          <div>
            <div style={{
              "font-size": "13px",
              "font-weight": "500",
              color: "var(--text-primary)",
              "margin-bottom": "4px",
            }}>
              Activer le mode focus automatiquement pendant les Pomodoro
            </div>
            <div style={{
              "font-size": "11px",
              color: "var(--text-muted)",
            }}>
              Affiche une barre de progression et un badge discret pendant les sessions de travail.
              Appuyez sur Echap pour quitter le mode focus a tout moment.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
