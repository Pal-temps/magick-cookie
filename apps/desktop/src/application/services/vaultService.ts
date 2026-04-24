// Facade over the vault_* Tauri commands. Centralises path-based read/write/delete calls so UI
// components never talk to `invoke` directly for vault operations.

import { invoke } from "@tauri-apps/api/core";

export const vaultService = {
  readJson: <T>(relPath: string) =>
    invoke<T | null>("vault_read_json", { relPath }),

  writeJson: (relPath: string, content: string) =>
    invoke<void>("vault_write_json", { relPath, content }),

  deleteFile: (relPath: string) =>
    invoke<void>("vault_delete_file", { relPath }),

  ensureStructure: () =>
    invoke<void>("vault_ensure_structure"),
};
