import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { api } from "../../../infrastructure/api/apiClient";

export function QuickCapture() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [value, setValue] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;
  let unlisten: (() => void) | null = null;

  onMount(async () => {
    unlisten = await listen<string>("global-shortcut", (event) => {
      if (event.payload === "capture") {
        setIsOpen((prev) => !prev);
        if (!isOpen()) {
          // Was just closed via toggle
          setValue("");
          setSaved(false);
        }
      }
    });
  });

  onCleanup(() => {
    unlisten?.();
  });

  function focusTextarea() {
    setTimeout(() => textareaRef?.focus(), 0);
  }

  function close() {
    setIsOpen(false);
    setValue("");
    setSaved(false);
  }

  async function save() {
    const text = value().trim();
    if (!text || saving()) return;

    setSaving(true);
    try {
      await api.post("/tasks", {
        title: text,
        source: "manual",
        status: "open",
      });
      setSaved(true);
      setTimeout(() => {
        close();
      }, 500);
    } catch (err) {
      console.error("Quick capture failed:", err);
      // Keep open so user doesn't lose their text
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  }

  return (
    <Show when={isOpen()}>
      {(() => {
        // Auto-focus when opened
        focusTextarea();
        return null;
      })()}
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "300",
          display: "flex",
          "justify-content": "center",
          "align-items": "center",
          "background-color": "rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onKeyDown={onKeyDown}
      >
        <div
          style={{
            width: "400px",
            background: saved() ? "var(--bg-surface)" : "var(--bg-surface)",
            border: saved()
              ? "1px solid #22c55e"
              : "1px solid var(--border-color)",
            "border-radius": "var(--radius-lg, 12px)",
            "box-shadow": "0 16px 48px rgba(0, 0, 0, 0.4)",
            overflow: "hidden",
            transition: "border-color 0.2s",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              "border-bottom": "1px solid var(--border-color)",
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
            }}
          >
            <span
              style={{
                color: "var(--text-primary)",
                "font-size": "14px",
                "font-weight": "600",
              }}
            >
              Capture rapide
            </span>
            <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
              <kbd
                style={{
                  padding: "2px 6px",
                  "font-size": "11px",
                  color: "var(--text-muted)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-color)",
                  "border-radius": "var(--radius-sm, 4px)",
                }}
              >
                ESC
              </kbd>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "12px 16px" }}>
            <Show
              when={!saved()}
              fallback={
                <div
                  style={{
                    padding: "24px 0",
                    "text-align": "center",
                    color: "#22c55e",
                    "font-size": "14px",
                    "font-weight": "500",
                  }}
                >
                  Tache ajoutee
                </div>
              }
            >
              <textarea
                ref={textareaRef}
                value={value()}
                onInput={(e) => setValue(e.currentTarget.value)}
                placeholder="Nouvelle tache..."
                rows={3}
                disabled={saving()}
                style={{
                  width: "100%",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-color)",
                  "border-radius": "var(--radius-sm, 4px)",
                  color: "var(--text-primary)",
                  "font-size": "14px",
                  "font-family": "inherit",
                  padding: "10px 12px",
                  resize: "none",
                  outline: "none",
                  "box-sizing": "border-box",
                }}
              />
              <div
                style={{
                  display: "flex",
                  "justify-content": "space-between",
                  "align-items": "center",
                  "margin-top": "8px",
                }}
              >
                <span
                  style={{
                    color: "var(--text-muted)",
                    "font-size": "12px",
                  }}
                >
                  Entree pour sauvegarder, Shift+Entree pour nouvelle ligne
                </span>
                <Show when={saving()}>
                  <span
                    style={{
                      color: "var(--text-muted)",
                      "font-size": "12px",
                    }}
                  >
                    ...
                  </span>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
