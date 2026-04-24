import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

export interface BrowserTab {
  id: string;
  label: string;
  url: string;
}

const [browserTabs, setBrowserTabs] = createSignal<BrowserTab[]>([]);

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useBrowserTabStore() {
  function launchBrowser(url = "http://localhost:3000"): string {
    const id = `browser-${Date.now()}`;
    const label = new URL(url).hostname || "Browser";
    setBrowserTabs((prev) => [...prev, { id, label, url }]);
    return id;
  }

  function closeBrowser(id: string) {
    invoke("browser_destroy", { id }).catch(() => {});
    setBrowserTabs((prev) => prev.filter((t) => t.id !== id));
  }

  function updateUrl(id: string, url: string) {
    setBrowserTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, url, label: tryHostname(url) || t.label } : t))
    );
  }

  // ─── Native webview lifecycle (thin wrappers around Tauri commands) ───
  // Kept silent-on-error because the webview can legitimately be missing during tab teardown.

  async function createWebview(id: string, url: string): Promise<void> {
    await invoke("browser_create", { id, url });
  }

  async function destroyWebview(id: string): Promise<void> {
    await invoke("browser_destroy", { id }).catch(() => {});
  }

  async function navigate(id: string, url: string): Promise<void> {
    await invoke("browser_navigate", { id, url });
  }

  async function setVisible(id: string, visible: boolean): Promise<void> {
    await invoke("browser_set_visible", { id, visible }).catch(() => {});
  }

  async function setBounds(id: string, bounds: BrowserBounds): Promise<void> {
    await invoke("browser_set_bounds", { id, ...bounds }).catch(() => {});
  }

  async function goBack(id: string): Promise<void> {
    await invoke("browser_go_back", { id }).catch(() => {});
  }

  async function goForward(id: string): Promise<void> {
    await invoke("browser_go_forward", { id }).catch(() => {});
  }

  async function reload(id: string): Promise<void> {
    await invoke("browser_reload", { id }).catch(() => {});
  }

  return {
    browserTabs,
    launchBrowser,
    closeBrowser,
    updateUrl,

    // Webview ops (previously called directly from BrowserView)
    createWebview,
    destroyWebview,
    navigate,
    setVisible,
    setBounds,
    goBack,
    goForward,
    reload,
  };
}

function tryHostname(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}
