import { createSignal } from "solid-js";

export interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: number;
}

const MAX_ENTRIES = 20;
const [clipboardHistory, setClipboardHistory] = createSignal<ClipboardEntry[]>([]);

function addEntry(text: string) {
  if (!text || text.trim().length === 0) return;
  setClipboardHistory((prev) => {
    const filtered = prev.filter((e) => e.text !== text);
    return [
      { id: crypto.randomUUID(), text, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_ENTRIES);
  });
}

export function useClipboardStore() {
  function init() {
    document.addEventListener("copy", () => {
      setTimeout(async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) addEntry(text);
        } catch {
          // Clipboard access denied — ignore
        }
      }, 100);
    });
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    addEntry(text);
  }

  return { clipboardHistory, init, copyToClipboard };
}
