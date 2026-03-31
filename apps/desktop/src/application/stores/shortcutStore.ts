import { createSignal } from "solid-js";
import { useSettingsStore } from "./settingsStore";

export interface ShortcutAction {
  id: string;
  label: string;
  defaultShortcut: string;
  category: string;
}

export const ACTIONS: ShortcutAction[] = [
  { id: "nav-dashboard", label: "Accueil", defaultShortcut: "Ctrl+D", category: "Navigation" },
  { id: "nav-calendar", label: "Calendrier", defaultShortcut: "Ctrl+1", category: "Navigation" },
  { id: "nav-ide", label: "IDE", defaultShortcut: "Ctrl+4", category: "Navigation" },
  { id: "nav-notes", label: "Notes", defaultShortcut: "", category: "Navigation" },
  { id: "nav-flux", label: "Flux", defaultShortcut: "Ctrl+5", category: "Navigation" },
  { id: "nav-email", label: "Email", defaultShortcut: "Ctrl+6", category: "Navigation" },
  { id: "nav-library", label: "Bibliotheque", defaultShortcut: "Ctrl+7", category: "Navigation" },
  { id: "nav-vps", label: "Serveurs", defaultShortcut: "Ctrl+9", category: "Navigation" },
  { id: "nav-bench", label: "Benchmark", defaultShortcut: "", category: "Navigation" },
  { id: "command-palette", label: "Command Palette", defaultShortcut: "Ctrl+K", category: "General" },
  { id: "settings", label: "Parametres", defaultShortcut: "Ctrl+,", category: "General" },
  { id: "start-pomodoro", label: "Demarrer Pomodoro", defaultShortcut: "", category: "Timer" },
  { id: "stop-timer", label: "Arreter Timer", defaultShortcut: "", category: "Timer" },
  { id: "new-event", label: "Nouvel evenement", defaultShortcut: "Ctrl+N", category: "Actions" },
  { id: "go-today", label: "Aujourd'hui", defaultShortcut: "Ctrl+T", category: "Actions" },
];

const settings = useSettingsStore();

function loadCustomShortcuts(): Map<string, string> {
  try {
    const entries = settings.getShortcuts().custom;
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveCustomShortcuts(map: Map<string, string>) {
  settings.patchShortcuts({ custom: [...map.entries()] });
}

const [customShortcuts, setCustomShortcuts] = createSignal<Map<string, string>>(loadCustomShortcuts());

export function useShortcutStore() {
  function getShortcut(actionId: string): string {
    const custom = customShortcuts().get(actionId);
    if (custom !== undefined) return custom;
    const action = ACTIONS.find((a) => a.id === actionId);
    return action?.defaultShortcut ?? "";
  }

  function setShortcut(actionId: string, shortcut: string) {
    const map = new Map(customShortcuts());
    map.set(actionId, shortcut);
    setCustomShortcuts(map);
    saveCustomShortcuts(map);
  }

  function resetShortcut(actionId: string) {
    const map = new Map(customShortcuts());
    map.delete(actionId);
    setCustomShortcuts(map);
    saveCustomShortcuts(map);
  }

  function resetAll() {
    setCustomShortcuts(new Map());
    settings.patchShortcuts({ custom: [] });
  }

  function parseShortcut(shortcut: string): { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string } {
    const parts = shortcut.split("+").map((p) => p.trim().toLowerCase());
    const ctrl = parts.includes("ctrl");
    const shift = parts.includes("shift");
    const alt = parts.includes("alt");
    const meta = parts.includes("meta");
    const key = parts.filter((p) => !["ctrl", "shift", "alt", "meta"].includes(p)).join("+");
    return { ctrl, shift, alt, meta, key };
  }

  function matchAction(event: KeyboardEvent): string | null {
    for (const action of ACTIONS) {
      const shortcut = getShortcut(action.id);
      if (!shortcut) continue;

      const parsed = parseShortcut(shortcut);
      const eventKey = event.key === "," ? "," : event.key.toLowerCase();

      if (
        (parsed.ctrl === (event.ctrlKey || event.metaKey)) &&
        parsed.shift === event.shiftKey &&
        parsed.alt === event.altKey &&
        parsed.key === eventKey
      ) {
        return action.id;
      }
    }
    return null;
  }

  function shortcutToString(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
    if (event.shiftKey) parts.push("Shift");
    if (event.altKey) parts.push("Alt");

    const key = event.key;
    // Ignore standalone modifier keys
    if (["Control", "Shift", "Alt", "Meta"].includes(key)) return "";

    // Normalize key display
    const displayKey = key.length === 1 ? key.toUpperCase() : key;
    parts.push(displayKey);

    return parts.join("+");
  }

  function findConflict(actionId: string, shortcut: string): ShortcutAction | null {
    if (!shortcut) return null;
    for (const action of ACTIONS) {
      if (action.id === actionId) continue;
      if (getShortcut(action.id).toLowerCase() === shortcut.toLowerCase()) {
        return action;
      }
    }
    return null;
  }

  function getCategories(): string[] {
    const cats = new Set(ACTIONS.map((a) => a.category));
    return [...cats];
  }

  function getActionsByCategory(category: string): ShortcutAction[] {
    return ACTIONS.filter((a) => a.category === category);
  }

  return {
    customShortcuts,
    getShortcut,
    setShortcut,
    resetShortcut,
    resetAll,
    matchAction,
    shortcutToString,
    findConflict,
    getCategories,
    getActionsByCategory,
    ACTIONS,
  };
}
