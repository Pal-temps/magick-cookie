import { createSignal, Show, For, onCleanup } from "solid-js";
import { useThemeStore, type Theme, type ThemeMode } from "../../../application/stores/themeStore";

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: "dark", label: "Sombre", icon: "\u{1F319}" },
  { value: "light", label: "Clair", icon: "\u2600" },
  { value: "cookie", label: "Cookie", icon: "\u{1F36A}" },
];

const modes: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "manual", label: "Manuel", icon: "\u{1F3A8}" },
  { value: "auto-system", label: "Suivre le systeme", icon: "\u{1F4BB}" },
  { value: "auto-schedule", label: "Horaire auto", icon: "\u{23F0}" },
];

export function ThemeSwitcher() {
  const { theme, setTheme, themeMode, setMode, schedule, setSchedule } = useThemeStore();
  const [open, setOpen] = createSignal(false);

  const currentModeEntry = () => modes.find((m) => m.value === themeMode()) ?? modes[0];

  function handleDocClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest("[data-theme-switcher]")) {
      setOpen(false);
    }
  }
  document.addEventListener("click", handleDocClick);
  onCleanup(() => document.removeEventListener("click", handleDocClick));

  const isManualMode = () => themeMode() === "manual";

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", "align-items": "center" }} data-theme-switcher>
      <button
        onClick={() => setOpen(!open())}
        title="Theme"
        style={{
          display: "inline-flex",
          "align-items": "center",
          "justify-content": "center",
          width: "28px",
          height: "22px",
          "margin-right": "4px",
          "border-radius": "var(--radius-sm)",
          background: open() ? "var(--bg-elevated)" : "transparent",
          border: "1px solid transparent",
          cursor: "pointer",
          "font-size": "12px",
          transition: "var(--transition-fast)",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
        onMouseLeave={(e) => { if (!open()) e.currentTarget.style.background = "transparent"; }}
      >
        {currentModeEntry().icon}
      </button>

      <Show when={open()}>
        <div style={{
          position: "absolute",
          top: "100%",
          right: "0",
          "min-width": "180px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          "border-radius": "0 0 var(--radius-md) var(--radius-md)",
          "box-shadow": `0 8px 24px var(--shadow-color)`,
          "z-index": "1000",
          padding: "4px 0",
        }}>
          {/* Mode section */}
          <div style={{
            padding: "4px 12px 2px",
            "font-size": "10px",
            "font-weight": "600",
            "text-transform": "uppercase",
            "letter-spacing": "0.05em",
            color: "var(--text-muted)",
          }}>
            Mode
          </div>
          <For each={modes}>
            {(m) => (
              <button
                onClick={() => { setMode(m.value); }}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  width: "100%",
                  padding: "6px 12px",
                  background: themeMode() === m.value ? "var(--bg-elevated)" : "transparent",
                  border: "none",
                  color: "var(--text-primary)",
                  "font-size": "12px",
                  cursor: "pointer",
                  "text-align": "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                onMouseLeave={(e) => { if (themeMode() !== m.value) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ "font-size": "13px" }}>{m.icon}</span>
                <span>{m.label}</span>
                <Show when={themeMode() === m.value}>
                  <span style={{ "margin-left": "auto", "font-size": "10px", color: "var(--accent-primary)" }}>&#10003;</span>
                </Show>
              </button>
            )}
          </For>

          {/* Schedule config — inline when auto-schedule is selected */}
          <Show when={themeMode() === "auto-schedule"}>
            <div style={{
              padding: "6px 12px 4px",
              display: "flex",
              "align-items": "center",
              gap: "4px",
              "font-size": "11px",
              color: "var(--text-muted)",
            }}>
              <span>Sombre</span>
              <input
                type="number"
                min="0"
                max="23"
                value={schedule().darkStart}
                onInput={(e) => setSchedule({ ...schedule(), darkStart: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
                style={{
                  width: "36px",
                  padding: "2px 4px",
                  "border-radius": "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  "font-size": "11px",
                  "text-align": "center",
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span>h -</span>
              <input
                type="number"
                min="0"
                max="23"
                value={schedule().darkEnd}
                onInput={(e) => setSchedule({ ...schedule(), darkEnd: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
                style={{
                  width: "36px",
                  padding: "2px 4px",
                  "border-radius": "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  "font-size": "11px",
                  "text-align": "center",
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span>h</span>
            </div>
          </Show>

          {/* Theme variant section — only in manual dark mode (to pick cookie vs dark) */}
          <Show when={isManualMode()}>
            <div style={{
              "border-top": "1px solid var(--border-color)",
              "margin-top": "4px",
              "padding-top": "4px",
            }}>
              <div style={{
                padding: "4px 12px 2px",
                "font-size": "10px",
                "font-weight": "600",
                "text-transform": "uppercase",
                "letter-spacing": "0.05em",
                color: "var(--text-muted)",
              }}>
                Variante
              </div>
              <For each={themes}>
                {(t) => (
                  <button
                    onClick={() => { setTheme(t.value); setOpen(false); }}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      width: "100%",
                      padding: "6px 12px",
                      background: theme() === t.value ? "var(--bg-elevated)" : "transparent",
                      border: "none",
                      color: "var(--text-primary)",
                      "font-size": "12px",
                      cursor: "pointer",
                      "text-align": "left",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                    onMouseLeave={(e) => { if (theme() !== t.value) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ "font-size": "13px" }}>{t.icon}</span>
                    <span>{t.label}</span>
                    <Show when={theme() === t.value}>
                      <span style={{ "margin-left": "auto", "font-size": "10px", color: "var(--accent-primary)" }}>&#10003;</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
