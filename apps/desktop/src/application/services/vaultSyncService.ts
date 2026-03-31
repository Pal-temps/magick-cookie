import { invoke } from "@tauri-apps/api/core";
import { type UserPreferences } from "../../domain/models/UserPreferences";

// ─── Vault export (preferences are now secret-free, safe to write as-is) ───

let syncTimer: ReturnType<typeof setTimeout> | null = null;

async function exportConfigToVault(prefs: UserPreferences) {
  try {
    await invoke("vault_write_json", {
      relPath: "_config/preferences.json",
      content: JSON.stringify(prefs, null, 2),
    });
  } catch (e) {
    console.debug("vault sync skipped:", e);
  }
}

/**
 * Debounced sync: writes preferences to the vault.
 * No sanitization needed — secrets are in the KDBX vault, not in preferences.
 */
export function scheduleSyncToVault(prefs: UserPreferences) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => exportConfigToVault(prefs), 2000);
}

/**
 * Immediate sync: called on startup.
 */
export async function syncConfigsToVault(prefs: UserPreferences) {
  await exportConfigToVault(prefs);
}

/**
 * Scaffold vault directory structure.
 */
export async function ensureVaultStructure() {
  try {
    await invoke("vault_ensure_structure");
  } catch (e) {
    console.debug("vault scaffold skipped:", e);
  }
}

/**
 * Get the vault path from Tauri config.
 */
export async function getVaultPath(): Promise<string | null> {
  try {
    const config = await invoke<{ path: string; remote: string }>("notes_get_config");
    return config.path || null;
  } catch {
    return null;
  }
}
