import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const [isDesktopMode, setIsDesktopMode] = createSignal(false);

let initialized = false;

export function useDesktopModeStore() {
  if (!initialized) {
    initialized = true;

    // Listen for tray menu toggle
    listen("toggle-desktop-mode", () => {
      toggle();
    });

    // Listen for Rust-side state changes (source of truth)
    listen<boolean>("desktop-mode-changed", (event) => {
      setIsDesktopMode(event.payload);
    });
  }

  async function enterDesktop() {
    try {
      await invoke("enter_desktop_mode");
      setIsDesktopMode(true);
    } catch (err) {
      console.error("Failed to enter desktop mode:", err);
      setIsDesktopMode(false);
    }
  }

  async function exitDesktop() {
    try {
      await invoke("exit_desktop_mode");
      setIsDesktopMode(false);
    } catch (err) {
      console.error("Failed to exit desktop mode:", err);
      // Force state reset even on error
      setIsDesktopMode(false);
    }
  }

  async function toggle() {
    if (isDesktopMode()) {
      await exitDesktop();
    } else {
      await enterDesktop();
    }
  }

  return {
    isDesktopMode,
    enterDesktop,
    exitDesktop,
    toggle,
  };
}
