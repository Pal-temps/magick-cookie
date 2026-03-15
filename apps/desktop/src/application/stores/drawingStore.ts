import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { NoteEntry } from "./notesStore";

const [drawings, setDrawings] = createSignal<NoteEntry[]>([]);
const [activeDrawing, setActiveDrawing] = createSignal<string | null>(null);
const [drawingContent, setDrawingContent] = createSignal<string>("");
const [isDirty, setIsDirty] = createSignal(false);
const [searchQuery, setSearchQuery] = createSignal("");

export function useDrawingStore() {
  async function fetchDrawings() {
    try {
      const list = await invoke<NoteEntry[]>("notes_list_drawings");
      setDrawings(list);
    } catch {
      setDrawings([]);
    }
  }

  async function openDrawing(path: string) {
    if (isDirty() && activeDrawing()) {
      await saveCurrentDrawing();
    }
    const content = await invoke<string>("notes_read", { path });
    setActiveDrawing(path);
    setDrawingContent(content);
    setIsDirty(false);
  }

  function updateContent(content: string) {
    setDrawingContent(content);
    setIsDirty(true);
  }

  async function saveCurrentDrawing() {
    const path = activeDrawing();
    if (!path) return;
    await invoke("notes_save", { path, content: drawingContent() });
    setIsDirty(false);
  }

  async function createDrawing(name: string) {
    const path = name.endsWith(".excalidraw") ? name : `${name}.excalidraw`;
    const emptyData = JSON.stringify({ type: "excalidraw", version: 2, elements: [], appState: {}, files: {} });
    await invoke("notes_save", { path, content: emptyData });
    await fetchDrawings();
    await openDrawing(path);
  }

  async function deleteDrawing(path: string) {
    await invoke("notes_delete", { path });
    if (activeDrawing() === path) {
      setActiveDrawing(null);
      setDrawingContent("");
      setIsDirty(false);
    }
    await fetchDrawings();
  }

  function filteredDrawings() {
    const q = searchQuery().toLowerCase();
    if (!q) return drawings();
    return drawings().filter((d) => d.name.toLowerCase().includes(q));
  }

  return {
    drawings, activeDrawing, drawingContent, isDirty,
    searchQuery, setSearchQuery,
    fetchDrawings, openDrawing, updateContent,
    saveCurrentDrawing, createDrawing, deleteDrawing, filteredDrawings,
  };
}
