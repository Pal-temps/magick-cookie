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
  }

  async function enterDesktop() {
    await invoke("enter_desktop_mode");
    setIsDesktopMode(true);
  }

  async function exitDesktop() {
    await invoke("exit_desktop_mode");
    setIsDesktopMode(false);
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
