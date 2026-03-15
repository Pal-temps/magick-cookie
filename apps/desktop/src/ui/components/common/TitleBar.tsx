import { createSignal, Show, For, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";

// --- Types ---

interface MenuAction {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuAction[];
}

// --- Props ---

interface TitleBarProps {
  menus: MenuDef[];
  rightSlot?: JSX.Element;
}

// --- Component ---

export function TitleBar(props: TitleBarProps) {
  const [openMenu, setOpenMenu] = createSignal<number | null>(null);
  const appWindow = getCurrentWindow();

  // Close menu on outside click
  function handleDocClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest("[data-menubar]")) {
      setOpenMenu(null);
    }
  }
  document.addEventListener("click", handleDocClick);
  onCleanup(() => document.removeEventListener("click", handleDocClick));

  function toggleMenu(idx: number) {
    setOpenMenu(openMenu() === idx ? null : idx);
  }

  function hoverMenu(idx: number) {
    if (openMenu() !== null) setOpenMenu(idx);
  }

  function handleAction(action?: () => void) {
    if (action) action();
    setOpenMenu(null);
  }

  return (
    <div style={{
      height: "32px",
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      background: "var(--bg-surface)",
      "border-bottom": "1px solid var(--border-color)",
      "flex-shrink": "0",
      "user-select": "none",
      "-webkit-app-region": "drag",
    }} data-tauri-drag-region>
      {/* Left: menus */}
      <div style={{ display: "flex", "align-items": "center", height: "100%" }} data-menubar>
        {/* App icon */}
        <div style={{
          padding: "0 10px",
          "font-size": "12px",
          "font-weight": "700",
          color: "var(--accent-primary)",
          "-webkit-app-region": "no-drag",
        }}>
          do-it-now
        </div>

        {/* Menu items */}
        <For each={props.menus}>
          {(menu, idx) => (
            <div style={{ position: "relative", height: "100%" }}>
              <button
                onClick={() => toggleMenu(idx())}
                onMouseEnter={() => hoverMenu(idx())}
                style={{
                  height: "100%",
                  padding: "0 10px",
                  background: openMenu() === idx() ? "var(--bg-elevated)" : "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  "font-size": "12px",
                  cursor: "pointer",
                  "-webkit-app-region": "no-drag",
                  transition: "background 0.1s",
                }}
              >
                {menu.label}
              </button>

              {/* Dropdown */}
              <Show when={openMenu() === idx()}>
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: "0",
                  "min-width": "200px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  "border-radius": "0 0 var(--radius-md) var(--radius-md)",
                  "box-shadow": "0 8px 24px rgba(0,0,0,0.4)",
                  "z-index": "1000",
                  padding: "4px 0",
                  "-webkit-app-region": "no-drag",
                }}>
                  <For each={menu.items}>
                    {(item) => (
                      <Show when={!item.separator} fallback={
                        <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />
                      }>
                        <button
                          onClick={() => handleAction(item.action)}
                          disabled={item.disabled}
                          style={{
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "space-between",
                            width: "100%",
                            padding: "6px 16px",
                            background: "transparent",
                            border: "none",
                            color: item.disabled ? "var(--text-muted)" : "var(--text-primary)",
                            "font-size": "12px",
                            cursor: item.disabled ? "default" : "pointer",
                            "text-align": "left",
                          }}
                          onMouseEnter={(e) => {
                            if (!item.disabled) e.currentTarget.style.background = "var(--bg-elevated)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span>{item.label}</span>
                          <Show when={item.shortcut}>
                            <span style={{ color: "var(--text-muted)", "font-size": "11px", "margin-left": "24px" }}>
                              {item.shortcut}
                            </span>
                          </Show>
                        </button>
                      </Show>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Center: drag area (implicit via parent) */}

      {/* Right side: status indicators + window controls */}
      <div style={{ display: "flex", "align-items": "center", height: "100%", "-webkit-app-region": "no-drag" }}>
        {/* Custom right slot (mini indicators) */}
        {props.rightSlot}

        {/* Window controls */}
        <button
          onClick={() => appWindow.minimize()}
          style={windowBtnStyle()}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="var(--text-secondary)" stroke-width="1.2" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          style={windowBtnStyle()}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="1" width="8" height="8" fill="none" stroke="var(--text-secondary)" stroke-width="1.2" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          style={{ ...windowBtnStyle(), width: "46px" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--cal-red)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="var(--text-secondary)" stroke-width="1.2" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="var(--text-secondary)" stroke-width="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function windowBtnStyle(): Record<string, string> {
  return {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: "36px",
    height: "100%",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "background 0.1s",
  };
}
