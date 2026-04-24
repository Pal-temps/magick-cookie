import { createSignal } from "solid-js";

export interface CliTab {
  id: string;
  label: string;
  /** "claude" = auto-type claude, "shell" = plain shell */
  mode: "claude" | "shell";
}

const [cliTabs, setCliTabs] = createSignal<CliTab[]>([]);
const [activeCliTabId, setActiveCliTabId] = createSignal<string | null>(null);

export function useCliTabStore() {
  function launchCliTerminal(): string {
    const id = `claude-pty-${Date.now()}`;
    setCliTabs((prev) => [...prev, { id, label: "Claude Code", mode: "claude" }]);
    setActiveCliTabId(id);
    return id;
  }

  function launchShellTerminal(): string {
    const id = `shell-pty-${Date.now()}`;
    setCliTabs((prev) => [...prev, { id, label: "Terminal", mode: "shell" }]);
    setActiveCliTabId(id);
    return id;
  }

  function closeCliTab(id: string) {
    setCliTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeCliTabId() === id) {
      const remaining = cliTabs();
      setActiveCliTabId(remaining[0]?.id ?? null);
    }
  }

  return {
    cliTabs,
    activeCliTabId,
    setActiveCliTabId,
    launchCliTerminal,
    launchShellTerminal,
    closeCliTab,
  };
}
