// Thin facade over the cli_* Tauri commands (apps/desktop/src-tauri/src/devops/commands.rs).
// UI components import from here rather than calling invoke()/listen() directly — same
// pattern as gitService / ptyService / vaultService.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AvailableCli {
  name: string;
  version: string;
  display_name: string;
  homepage: string;
  installed: boolean;
}

export interface InstalledCli {
  name: string;
  version: string;
  path: string;
}

// Mirrors the `#[serde(tag = "phase")]` enum in commands.rs.
// Frontend code that listens to install progress should narrow on `phase` first.
export type InstallProgress =
  | { phase: "started"; name: string }
  | { phase: "downloading"; name: string }
  | { phase: "verifying"; name: string }
  | { phase: "extracting"; name: string }
  | { phase: "done"; name: string; path: string }
  | { phase: "failed"; name: string; error: string };

// Must match INSTALL_PROGRESS_EVENT in commands.rs. Changing one without the other silently
// breaks the bridge — there's a Rust unit test that pins the constant on that side.
export const INSTALL_PROGRESS_EVENT = "cli://install/progress";

export const devopsCliService = {
  listAvailable: () => invoke<AvailableCli[]>("cli_list_available"),

  listInstalled: () => invoke<InstalledCli[]>("cli_list_installed"),

  resolve: (name: string) =>
    invoke<string | null>("cli_resolve", { name }),

  install: (name: string, force = false) =>
    invoke<string>("cli_install", { name, force }),

  uninstall: (name: string) =>
    invoke<void>("cli_uninstall", { name }),

  /**
   * Subscribe to install progress events for a specific CLI.
   * `onProgress` is invoked for every event whose `name` matches the given CLI; events for
   * other CLIs are ignored so multiple installs can be tracked in parallel from different
   * components without crosstalk.
   *
   * Returns an unlisten function — call it from a `onCleanup` hook in SolidJS.
   */
  onInstallProgress: async (
    name: string,
    onProgress: (p: InstallProgress) => void,
  ): Promise<UnlistenFn> => {
    return listen<InstallProgress>(INSTALL_PROGRESS_EVENT, (event) => {
      if (event.payload.name === name) {
        onProgress(event.payload);
      }
    });
  },
};
