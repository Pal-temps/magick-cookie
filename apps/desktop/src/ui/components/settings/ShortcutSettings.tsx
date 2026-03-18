import { createSignal, For, Show } from "solid-js";
import { useShortcutStore } from "../../../application/stores/shortcutStore";
import { Button } from "../common/Button";

export function ShortcutSettings() {
  const {
    getShortcut,
    setShortcut,
    resetShortcut,
    resetAll,
    shortcutToString,
    findConflict,
    getCategories,
    getActionsByCategory,
    ACTIONS,
  } = useShortcutStore();

  const [recordingId, setRecordingId] = createSignal<string | null>(null);
  const [conflictWarning, setConflictWarning] = createSignal<string | null>(null);

  function startRecording(actionId: string) {
    setRecordingId(actionId);
    setConflictWarning(null);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const id = recordingId();
    if (!id) return;

    e.preventDefault();
    e.stopPropagation();

    const combo = shortcutToString(e);
    if (!combo) return; // Just a modifier key

    const conflict = findConflict(id, combo);
    if (conflict) {
      setConflictWarning(`"${combo}" est deja utilise par "${conflict.label}"`);
      return;
    }

    setShortcut(id, combo);
    setRecordingId(null);
    setConflictWarning(null);
  }

  function cancelRecording() {
    setRecordingId(null);
    setConflictWarning(null);
  }

  function clearShortcut(actionId: string) {
    setShortcut(actionId, "");
    setRecordingId(null);
    setConflictWarning(null);
  }

  return (
    <div
      style={{ padding: "24px", "max-width": "600px" }}
      onKeyDown={(e) => {
        if (recordingId()) handleKeyDown(e);
      }}
      tabIndex={-1}
    >
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <h2 style={{ margin: "0", "font-size": "18px", color: "var(--text-primary)" }}>Raccourcis clavier</h2>
        <Button variant="secondary" size="sm" onClick={() => { resetAll(); setRecordingId(null); setConflictWarning(null); }}>
          Reset tout
        </Button>
      </div>

      <Show when={conflictWarning()}>
        <div style={{
          padding: "8px 12px",
          "margin-bottom": "12px",
          background: "rgba(255, 170, 0, 0.15)",
          border: "1px solid rgba(255, 170, 0, 0.3)",
          "border-radius": "var(--radius-sm)",
          "font-size": "12px",
          color: "var(--text-primary)",
        }}>
          {conflictWarning()}
        </div>
      </Show>

      <For each={getCategories()}>
        {(category) => (
          <div style={{ "margin-bottom": "20px" }}>
            <div style={{
              "font-size": "11px",
              "font-weight": "600",
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
              color: "var(--text-muted)",
              "margin-bottom": "8px",
              "padding-bottom": "4px",
              "border-bottom": "1px solid var(--border-color)",
            }}>
              {category}
            </div>
            <For each={getActionsByCategory(category)}>
              {(action) => {
                const currentShortcut = () => getShortcut(action.id);
                const isDefault = () => {
                  const custom = getShortcut(action.id);
                  return custom === action.defaultShortcut;
                };
                const isRecording = () => recordingId() === action.id;

                return (
                  <div style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "6px 0",
                    "border-bottom": "1px solid var(--border-color)",
                  }}>
                    <span style={{ "font-size": "13px", color: "var(--text-primary)", flex: "1" }}>
                      {action.label}
                    </span>

                    <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
                      <button
                        onClick={() => isRecording() ? cancelRecording() : startRecording(action.id)}
                        style={{
                          "min-width": "120px",
                          padding: "4px 10px",
                          "font-size": "12px",
                          "font-family": "monospace",
                          "text-align": "center",
                          border: isRecording() ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
                          "border-radius": "var(--radius-sm)",
                          background: isRecording() ? "var(--accent-color)" : "var(--bg-elevated)",
                          color: isRecording() ? "#fff" : currentShortcut() ? "var(--text-primary)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {isRecording()
                          ? "Appuyez..."
                          : currentShortcut() || "Non defini"}
                      </button>

                      <Show when={isRecording()}>
                        <Button variant="ghost" size="sm" onClick={() => clearShortcut(action.id)} style={{ "font-size": "11px", padding: "2px 6px" }}>
                          Vider
                        </Button>
                      </Show>

                      <Show when={!isDefault() && !isRecording()}>
                        <button
                          onClick={() => resetShortcut(action.id)}
                          title="Reinitialiser"
                          style={{
                            padding: "2px 6px",
                            "font-size": "11px",
                            border: "none",
                            background: "transparent",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          Reset
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        )}
      </For>

      <div style={{ "margin-top": "16px", "font-size": "11px", color: "var(--text-muted)" }}>
        Cliquez sur un raccourci pour le modifier, puis appuyez sur la nouvelle combinaison de touches.
      </div>
    </div>
  );
}
