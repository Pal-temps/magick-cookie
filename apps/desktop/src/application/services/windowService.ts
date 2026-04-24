// Facade over Tauri multi-window commands. Used when a feature needs to open content in a
// separate native window (detached AI sessions, detached system terminals, etc.).

import { invoke } from "@tauri-apps/api/core";

export interface DetachedWindowOptions {
  label: string;
  title: string;
  route: string;
}

export const windowService = {
  openDetached: (opts: DetachedWindowOptions) =>
    invoke<void>("open_detached_window", opts),
};
