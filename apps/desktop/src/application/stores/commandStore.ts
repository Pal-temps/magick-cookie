import { createSignal, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useViewStore } from "./viewStore";
import { useCalendarStore } from "./calendarStore";
import { useTaskStore } from "./taskStore";
import { useEmailStore } from "./emailStore";
import { useDesktopModeStore } from "./desktopModeStore";
import { useClipboardStore } from "./clipboardStore";

export interface CommandResult {
  id: string;
  label: string;
  sublabel?: string;
  category: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
}

interface HistoryEntry {
  id: string;
  label: string;
  category: string;
  timestamp: number;
}

const HISTORY_KEY = "magick-cookie-cmd-history";
const MAX_HISTORY = 10;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

const [isOpen, setIsOpen] = createSignal(false);
const [query, setQuery] = createSignal("");
const [selectedIndex, setSelectedIndex] = createSignal(0);
const [history, setHistory] = createSignal<HistoryEntry[]>(loadHistory());

export function useCommandStore() {
  const { setViewMode } = useViewStore();
  const { openCreateForm, contacts } = useCalendarStore();
  const { tasks } = useTaskStore();
  const { emails } = useEmailStore();
  const { enterDesktop } = useDesktopModeStore();
  const { clipboardHistory, copyToClipboard } = useClipboardStore();

  const staticNavigation: CommandResult[] = [
    { id: "nav-dashboard", label: "Accueil", sublabel: "Aller au dashboard", category: "Navigation", icon: "📍", shortcut: "Alt+1", action: () => setViewMode("dashboard") },
    { id: "nav-month", label: "Calendrier (Mois)", sublabel: "Vue mois", category: "Navigation", icon: "📍", shortcut: "Alt+2", action: () => setViewMode("month") },
    { id: "nav-week", label: "Calendrier (Semaine)", sublabel: "Vue semaine", category: "Navigation", icon: "📍", action: () => setViewMode("week") },
    { id: "nav-day", label: "Calendrier (Jour)", sublabel: "Vue jour", category: "Navigation", icon: "📍", action: () => setViewMode("day") },
    { id: "nav-notes", label: "Notes", sublabel: "Vue notes", category: "Navigation", icon: "📝", shortcut: "Alt+3", action: () => setViewMode("notes") },
    { id: "nav-triage", label: "Triage", sublabel: "Vue triage", category: "Navigation", icon: "📍", shortcut: "Alt+4", action: () => setViewMode("triage") },
    { id: "nav-email", label: "Email", sublabel: "Vue email", category: "Navigation", icon: "📧", shortcut: "Alt+5", action: () => setViewMode("email") },
    { id: "nav-chat", label: "Chat", sublabel: "Chat avec le LLM", category: "Navigation", icon: "💬", shortcut: "Alt+7", action: () => setViewMode("chat") },
    { id: "nav-settings", label: "Paramètres", sublabel: "Ouvrir settings", category: "Navigation", icon: "📍", shortcut: "Alt+6", action: () => setViewMode("settings") },
  ];

  const staticActions: CommandResult[] = [
    { id: "act-new-event", label: "Nouvel événement", sublabel: "Créer un événement", category: "Actions", icon: "⚡", action: () => openCreateForm() },
    { id: "act-desktop-mode", label: "Mode bureau", sublabel: "Passer en mode bureau", category: "Actions", icon: "⚡", action: () => enterDesktop() },
  ];

  const allStatic = [...staticNavigation, ...staticActions];

  function addToHistory(result: CommandResult) {
    const entry: HistoryEntry = {
      id: result.id,
      label: result.label,
      category: result.category,
      timestamp: Date.now(),
    };
    const current = history().filter((h) => h.id !== entry.id);
    const updated = [entry, ...current].slice(0, MAX_HISTORY);
    setHistory(updated);
    saveHistory(updated);
  }

  function historyToResults(): CommandResult[] {
    return history()
      .map((h): CommandResult | null => {
        // Try to find the original static command to reuse its action
        const original = allStatic.find((s) => s.id === h.id);
        if (original) {
          return { ...original, category: "Récents", icon: "🕑" };
        }
        // For dynamic results (tasks, contacts, emails, notes), reconstruct a basic action
        if (h.id.startsWith("task-")) {
          return { id: h.id, label: h.label, category: "Récents", icon: "🕑", action: () => setViewMode("triage") };
        }
        if (h.id.startsWith("contact-")) {
          return { id: h.id, label: h.label, category: "Récents", icon: "🕑", action: () => setViewMode("dashboard") };
        }
        if (h.id.startsWith("email-")) {
          return { id: h.id, label: h.label, category: "Récents", icon: "🕑", action: () => setViewMode("email") };
        }
        if (h.id.startsWith("note-")) {
          return { id: h.id, label: h.label, category: "Récents", icon: "🕑", action: () => setViewMode("notes") };
        }
        return null;
      })
      .filter((r): r is CommandResult => r !== null);
  }

  function matchScore(text: string, q: string): number {
    const lower = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    if (!lower.includes(lowerQ)) return -1;
    if (lower === lowerQ) return 100;
    if (lower.startsWith(lowerQ)) return 80;
    return 50;
  }

  function filterStatic(items: CommandResult[], q: string): CommandResult[] {
    return items
      .map((item) => {
        const score = Math.max(matchScore(item.label, q), matchScore(item.sublabel ?? "", q));
        return { item, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.item);
  }

  // Notes search signal for async results
  const [noteResults, setNoteResults] = createSignal<CommandResult[]>([]);

  async function searchNotes(searchQuery: string) {
    try {
      const notesList = await invoke<string[]>("notes_list");
      const filtered = notesList
        .filter((filename) => matchScore(filename, searchQuery) > 0)
        .slice(0, 5)
        .map((filename): CommandResult => ({
          id: `note-${filename}`,
          label: filename,
          sublabel: "Note",
          category: "Notes",
          icon: "📝",
          action: () => {
            setViewMode("notes");
          },
        }));
      setNoteResults(filtered);
    } catch {
      setNoteResults([]);
    }
  }

  // Track query changes for async note search
  let lastNoteQuery = "";

  const results = createMemo<CommandResult[]>(() => {
    const q = query().trim();

    if (!q) {
      const recentItems = historyToResults();
      if (recentItems.length > 0) {
        return recentItems;
      }
      return [...staticNavigation, ...staticActions];
    }

    // Prefix clip: restricts to clipboard history
    if (q.startsWith("clip:")) {
      const clipQuery = q.slice(5).trim();
      return clipboardHistory()
        .filter((e) => !clipQuery || e.text.toLowerCase().includes(clipQuery.toLowerCase()))
        .slice(0, 10)
        .map((e): CommandResult => ({
          id: `clip-${e.id}`,
          label: e.text.length > 50 ? e.text.slice(0, 50) + "..." : e.text,
          sublabel: e.text.length > 50 ? e.text : undefined,
          category: "Presse-papier",
          icon: "📋",
          action: () => { copyToClipboard(e.text); },
        }));
    }

    // Prefix n: restricts to notes only
    const isNotesOnly = q.startsWith("n:");
    const isCommandMode = q.startsWith(">");
    const searchQuery = isNotesOnly ? q.slice(2).trim() : isCommandMode ? q.slice(1).trim() : q;

    // Trigger async notes search
    if (searchQuery && searchQuery !== lastNoteQuery) {
      lastNoteQuery = searchQuery;
      searchNotes(searchQuery);
    } else if (!searchQuery) {
      lastNoteQuery = "";
      setNoteResults([]);
    }

    if (isNotesOnly) {
      if (!searchQuery) return [];
      return noteResults();
    }

    if (isCommandMode) {
      if (!searchQuery) return staticActions;
      return filterStatic(staticActions, searchQuery);
    }

    const matched: CommandResult[] = [
      ...filterStatic(staticNavigation, searchQuery),
      ...filterStatic(staticActions, searchQuery),
    ];

    // Dynamic: tasks
    const taskResults = tasks()
      .filter((t) => matchScore(t.title, searchQuery) > 0)
      .slice(0, 5)
      .map((t): CommandResult => ({
        id: `task-${t.id}`,
        label: t.title,
        sublabel: t.status,
        category: "Tâches",
        icon: "📋",
        action: () => {
          setViewMode("triage");
        },
      }));

    // Dynamic: contacts
    const contactResults = contacts()
      .filter((c) => matchScore(c.name, searchQuery) > 0)
      .slice(0, 5)
      .map((c): CommandResult => ({
        id: `contact-${c.id}`,
        label: c.name,
        sublabel: c.email ?? c.phone ?? undefined,
        category: "Contacts",
        icon: "👤",
        action: () => {
          setViewMode("dashboard");
        },
      }));

    // Dynamic: emails
    const emailResults = emails()
      .filter((e) => matchScore(e.subject ?? "", searchQuery) > 0 || matchScore(e.fromName ?? e.fromAddress, searchQuery) > 0)
      .slice(0, 5)
      .map((e): CommandResult => ({
        id: `email-${e.id}`,
        label: e.subject ?? "(sans sujet)",
        sublabel: e.fromName ?? e.fromAddress,
        category: "Emails",
        icon: "📧",
        action: () => {
          setViewMode("email");
        },
      }));

    return [...matched, ...taskResults, ...contactResults, ...emailResults, ...noteResults()];
  });

  function open() {
    setQuery("");
    setSelectedIndex(0);
    setNoteResults([]);
    lastNoteQuery = "";
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    setNoteResults([]);
    lastNoteQuery = "";
  }

  function executeSelected() {
    const items = results();
    const idx = selectedIndex();
    if (idx >= 0 && idx < items.length) {
      addToHistory(items[idx]);
      items[idx].action();
      close();
    }
  }

  function moveUp() {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results().length - 1));
  }

  function moveDown() {
    setSelectedIndex((prev) => (prev < results().length - 1 ? prev + 1 : 0));
  }

  function updateQuery(value: string) {
    setQuery(value);
    setSelectedIndex(0);
  }

  return {
    isOpen,
    query,
    selectedIndex,
    results,
    open,
    close,
    executeSelected,
    moveUp,
    moveDown,
    updateQuery,
  };
}
