import { createSignal, Show, For, onCleanup } from "solid-js";
import { useThemeStore, type Theme } from "../../../application/stores/themeStore";

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: "dark", label: "Sombre", icon: "\u{1F319}" },
  { value: "light", label: "Clair", icon: "\u2600" },
  { value: "cookie", label: "Cookie", icon: "\u{1F36A}" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = createSignal(false);

  const currentIcon = () => themes.find((t) => t.value === theme())?.icon ?? "\u{1F319}";

  function handleDocClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest("[data-theme-switcher]")) {
      setOpen(false);
    }
  }
  document.addEventListener("click", handleDocClick);
  onCleanup(() => document.removeEventListener("click", handleDocClick));

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
        {currentIcon()}
      </button>

      <Show when={open()}>
        <div style={{
          position: "absolute",
          top: "100%",
          right: "0",
          "min-width": "140px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          "border-radius": "0 0 var(--radius-md) var(--radius-md)",
          "box-shadow": `0 8px 24px var(--shadow-color)`,
          "z-index": "1000",
          padding: "4px 0",
        }}>
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
  );
}
