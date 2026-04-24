// Facade over the pty_* Tauri commands. Each Terminal component instance owns one PTY; this
// keeps the bridge in one place so UI components never reach for `invoke` directly.

import { invoke } from "@tauri-apps/api/core";

export interface PtyDataEvent {
  id: string;
  data: string;
}

export const ptyService = {
  spawn: (id: string, cwd: string, cols: number, rows: number) =>
    invoke<void>("pty_spawn", { id, cwd, cols, rows }),

  write: (id: string, data: string) =>
    invoke<void>("pty_write", { id, data }).catch(() => {}),

  resize: (id: string, cols: number, rows: number) =>
    invoke<void>("pty_resize", { id, cols, rows }).catch(() => {}),

  kill: (id: string) =>
    invoke<void>("pty_kill", { id }).catch(() => {}),
};
