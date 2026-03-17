import { onMount, onCleanup, Show, For, createSignal, createEffect } from "solid-js";
import { useDrawingStore } from "../../../application/stores/drawingStore";
import { useNotesStore } from "../../../application/stores/notesStore";
import { useThemeStore } from "../../../application/stores/themeStore";
import { mountExcalidraw, type ExcalidrawHandle } from "./excalidrawMount";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";

export function DrawingsView() {
  const store = useDrawingStore();
  const notes = useNotesStore();
  const { theme } = useThemeStore();
  const [newDrawingName, setNewDrawingName] = createSignal("");
  const [showNewDrawing, setShowNewDrawing] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  let editorContainer: HTMLDivElement | undefined;
  let excalidrawHandle: ExcalidrawHandle | null = null;

  onMount(async () => {
    // Ensure notes config is loaded (drawings share the same repo)
    const cfg = await notes.loadConfig();
    if (cfg) {
      await store.fetchDrawings();
    }
  });

  onCleanup(() => {
    if (excalidrawHandle) {
      excalidrawHandle.destroy();
      excalidrawHandle = null;
    }
  });

  // Mount/remount excalidraw when active drawing changes
  createEffect(() => {
    const path = store.activeDrawing();
    const content = store.drawingContent();

    if (!path || !editorContainer) {
      if (excalidrawHandle) {
        excalidrawHandle.destroy();
        excalidrawHandle = null;
      }
      return;
    }

    // Destroy previous instance
    if (excalidrawHandle) {
      excalidrawHandle.destroy();
      excalidrawHandle = null;
    }

    setIsLoading(true);

    const excalidrawTheme = theme() === "light" ? "light" as const : "dark" as const;

    mountExcalidraw(
      editorContainer,
      content,
      (newContent) => {
        store.updateContent(newContent);
      },
      excalidrawTheme,
    ).then((handle) => {
      excalidrawHandle = handle;
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  });

  async function handleCreateDrawing() {
    const name = newDrawingName().trim();
    if (!name) return;
    await store.createDrawing(name);
    setNewDrawingName("");
    setShowNewDrawing(false);
  }

  async function handleSave() {
    if (excalidrawHandle) {
      const content = excalidrawHandle.getContent();
      store.updateContent(content);
    }
    await store.saveCurrentDrawing();
  }

  function formatDate(ts: number): string {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("fr-FR", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  // Show config message if notes not configured
  if (!notes.config()) {
    return (
      <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--text-muted)", "font-size": "14px", padding: "40px", "text-align": "center" }}>
        Configurez d'abord vos notes (onglet Notes) pour definir le dossier de stockage des schemas.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left panel — file list */}
      <div style={{
        width: "240px",
        "min-width": "240px",
        "border-right": "1px solid var(--border-color)",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
      }}>
        {/* Search + actions */}
        <div style={{ padding: "8px", display: "flex", "flex-direction": "column", gap: "6px", "border-bottom": "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            <input
              type="text"
              placeholder="Rechercher..."
              value={store.searchQuery()}
              onInput={(e) => store.setSearchQuery(e.currentTarget.value)}
              style={{ ...inputStyle(), flex: "1" }}
            />
            <Button size="sm" variant="secondary" onClick={() => setShowNewDrawing(!showNewDrawing())}>+</Button>
          </div>
          <Show when={showNewDrawing()}>
            <div style={{ display: "flex", gap: "4px" }}>
              <input
                type="text"
                placeholder="Nom du schema..."
                value={newDrawingName()}
                onInput={(e) => setNewDrawingName(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateDrawing(); if (e.key === "Escape") setShowNewDrawing(false); }}
                style={{ ...inputStyle(), flex: "1", "font-size": "12px" }}
                autofocus
              />
              <Button size="sm" variant="primary" onClick={handleCreateDrawing}>OK</Button>
            </div>
          </Show>
        </div>

        {/* Drawing list */}
        <div style={{ flex: "1", "overflow-y": "auto" }}>
          <For each={store.filteredDrawings()}>
            {(drawing) => (
              <button
                onClick={() => store.openDrawing(drawing.path)}
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  width: "100%",
                  padding: "8px 10px",
                  "text-align": "left",
                  cursor: "pointer",
                  background: store.activeDrawing() === drawing.path ? "var(--accent-primary)" : "transparent",
                  color: "var(--text-primary)",
                  "border-bottom": "1px solid var(--border-color)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (store.activeDrawing() !== drawing.path) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (store.activeDrawing() !== drawing.path) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ "font-size": "13px", "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                  {drawing.name}
                </div>
                <span style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>
                  {formatDate(drawing.modified)}
                </span>
              </button>
            )}
          </For>
          <Show when={store.filteredDrawings().length === 0}>
            <div style={{ padding: "20px", "text-align": "center", "font-size": "12px", color: "var(--text-muted)" }}>
              Aucun schema
            </div>
          </Show>
        </div>
      </div>

      {/* Right panel — Excalidraw editor */}
      <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{
          padding: "6px 12px",
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "border-bottom": "1px solid var(--border-color)",
          "flex-shrink": "0",
        }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <Show when={store.activeDrawing()}>
              <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                {store.activeDrawing()}
              </span>
              <Show when={store.isDirty()}>
                <span style={{ "font-size": "11px", color: "var(--cal-orange)", "font-weight": "600" }}>*</span>
              </Show>
            </Show>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <Show when={store.activeDrawing()}>
              <Button size="sm" variant="secondary" onClick={handleSave} disabled={!store.isDirty()}>
                Sauver
              </Button>
              <Button size="sm" variant="danger" onClick={() => {
                const path = store.activeDrawing();
                if (path && confirm(`Supprimer ${path} ?`)) {
                  store.deleteDrawing(path);
                }
              }}>
                Suppr.
              </Button>
            </Show>
          </div>
        </div>

        {/* Editor container */}
        <Show when={store.activeDrawing()} fallback={
          <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--text-muted)", "font-size": "14px" }}>
            Selectionnez ou creez un schema
          </div>
        }>
          <div style={{ flex: "1", position: "relative", overflow: "hidden" }}>
            <Show when={isLoading()}>
              <div style={{
                position: "absolute",
                inset: "0",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                background: "var(--bg-base)",
                "z-index": "10",
              }}>
                <CookieLoader message="Chargement d'Excalidraw..." />
              </div>
            </Show>
            <div
              ref={editorContainer}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}

function inputStyle(): Record<string, string> {
  return {
    padding: "6px 10px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
  };
}
