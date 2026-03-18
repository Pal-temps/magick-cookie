import { onMount, createSignal, For, Show } from "solid-js";
import { useEnvStore } from "../../../application/stores/envStore";
import { Button } from "../common/Button";

function statusDotColor(status: string): string {
  if (status === "up") return "#00b894";
  if (status === "down") return "#d63031";
  return "#b2bec3"; // checking / gray
}

function statusLabel(status: string): string {
  if (status === "up") return "En ligne";
  if (status === "down") return "Hors ligne";
  return "Verification...";
}

export function EnvChecker() {
  const { checks, runChecks, addCheck, removeCheck } = useEnvStore();
  const [newName, setNewName] = createSignal("");
  const [newUrl, setNewUrl] = createSignal("");

  onMount(() => {
    runChecks();
  });

  function handleAdd() {
    const name = newName().trim();
    const url = newUrl().trim();
    if (!name || !url) return;
    addCheck(name, url);
    setNewName("");
    setNewUrl("");
    runChecks();
  }

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
        <span style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
          Environnement
        </span>
        <Button size="sm" variant="secondary" onClick={runChecks}>
          Rafraichir
        </Button>
      </div>

      {/* Service list */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        <For each={checks()}>
          {(check, index) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
              padding: "8px 12px",
              background: "var(--bg-elevated)",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
            }}>
              <span style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                "border-radius": "50%",
                background: statusDotColor(check.status),
                "flex-shrink": "0",
                transition: "background 0.2s",
              }} />
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                  {check.name}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                  {check.url}
                </div>
              </div>
              <span style={{
                "font-size": "11px",
                color: statusDotColor(check.status),
                "font-weight": "500",
                "white-space": "nowrap",
              }}>
                {statusLabel(check.status)}
              </span>
              <Show when={index() >= 2}>
                <button
                  onClick={() => removeCheck(index())}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    "font-size": "14px",
                    padding: "2px 4px",
                    "line-height": "1",
                  }}
                  title="Supprimer"
                >
                  x
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Add custom service */}
      <div style={{
        display: "flex",
        gap: "6px",
        "align-items": "flex-end",
        padding: "10px 12px",
        background: "var(--bg-surface)",
        "border-radius": "var(--radius-md)",
        border: "1px solid var(--border-color)",
      }}>
        <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: "4px" }}>
          <label style={{ "font-size": "11px", color: "var(--text-muted)" }}>Nom</label>
          <input
            type="text"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            placeholder="Mon service"
            style={{
              padding: "5px 8px",
              "font-size": "12px",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)",
              outline: "none",
            }}
          />
        </div>
        <div style={{ flex: "2", display: "flex", "flex-direction": "column", gap: "4px" }}>
          <label style={{ "font-size": "11px", color: "var(--text-muted)" }}>URL</label>
          <input
            type="text"
            value={newUrl()}
            onInput={(e) => setNewUrl(e.currentTarget.value)}
            placeholder="http://localhost:8080/health"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            style={{
              padding: "5px 8px",
              "font-size": "12px",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)",
              outline: "none",
            }}
          />
        </div>
        <Button size="sm" variant="primary" onClick={handleAdd}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
