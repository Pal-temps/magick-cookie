import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { API_BASE, authHeaders } from "../../infrastructure/config";

// ─── Types (mirror Rust secrets.rs) ───

export interface SecretEntry {
  id: string;
  group: string;
  title: string;
  username: string;
  password?: string;
  url: string;
  notes: string;
  tags: string[];
}

export interface SecretGroup {
  name: string;
  path: string;
  entry_count: number;
  children: SecretGroup[];
}

// ─── Auto-lock ───

const AUTO_LOCK_KEY = "magick-cookie-autolock-minutes";
const DEFAULT_AUTO_LOCK_MINUTES = 15;

let lastActivity = Date.now();
let autoLockTimer: ReturnType<typeof setInterval> | null = null;

function resetActivity() {
  lastActivity = Date.now();
}

// ─── State ───

const [isUnlocked, setIsUnlocked] = createSignal(false);
const [entries, setEntries] = createSignal<SecretEntry[]>([]);
const [groups, setGroups] = createSignal<SecretGroup | null>(null);
const [searchQuery, setSearchQuery] = createSignal("");
const [activeGroup, setActiveGroup] = createSignal<string | null>(null);
const [autoLockMinutes, setAutoLockMinutesSignal] = createSignal(
  parseInt(localStorage.getItem(AUTO_LOCK_KEY) ?? String(DEFAULT_AUTO_LOCK_MINUTES), 10)
);

// ─── Store ───

export function useSecretsStore() {

  function startAutoLock() {
    stopAutoLock();
    // Track user activity
    for (const evt of ["mousedown", "keydown", "scroll", "touchstart"] as const) {
      document.addEventListener(evt, resetActivity, { passive: true });
    }
    // Check every 30s if idle time exceeded
    autoLockTimer = setInterval(async () => {
      const minutes = autoLockMinutes();
      if (minutes <= 0 || !isUnlocked()) return;
      const elapsed = (Date.now() - lastActivity) / 60_000;
      if (elapsed >= minutes) {
        await lock();
      }
    }, 30_000);
  }

  function stopAutoLock() {
    if (autoLockTimer) {
      clearInterval(autoLockTimer);
      autoLockTimer = null;
    }
    for (const evt of ["mousedown", "keydown", "scroll", "touchstart"] as const) {
      document.removeEventListener(evt, resetActivity);
    }
  }

  function setAutoLockMinutes(minutes: number) {
    setAutoLockMinutesSignal(minutes);
    localStorage.setItem(AUTO_LOCK_KEY, String(minutes));
  }

  async function checkUnlocked(): Promise<boolean> {
    const unlocked = await invoke<boolean>("secrets_is_unlocked");
    setIsUnlocked(unlocked);
    if (unlocked) startAutoLock();
    return unlocked;
  }

  async function unlock(masterPassword: string): Promise<void> {
    await invoke("secrets_init", { masterPassword });
    setIsUnlocked(true);
    resetActivity();
    startAutoLock();
    await fetchGroups();
    await fetchEntries();
    // Migrate legacy secrets on first unlock
    await migrateLegacySecrets();
    // Sync app secrets to backend
    await syncAppSecretsToBackend();
  }

  async function lock(): Promise<void> {
    stopAutoLock();
    await invoke("secrets_lock");
    setIsUnlocked(false);
    setEntries([]);
    setGroups(null);
  }

  async function fetchEntries(group?: string): Promise<void> {
    try {
      const list = await invoke<SecretEntry[]>("secrets_list", { group: group ?? null });
      setEntries(list);
    } catch (e) { console.error("fetchEntries error:", e); }
  }

  async function fetchGroups(): Promise<void> {
    try {
      const tree = await invoke<SecretGroup>("secrets_groups");
      setGroups(tree);
    } catch (e) { console.error("fetchGroups error:", e); }
  }

  async function getPassword(id: string): Promise<string> {
    try {
      const entry = await invoke<SecretEntry>("secrets_get", { id });
      return entry.password ?? "";
    } catch (e) {
      console.error("getPassword error:", e);
      return "";
    }
  }

  async function saveEntry(entry: SecretEntry): Promise<void> {
    try {
      await invoke("secrets_set", { entry });
      await fetchEntries(activeGroup() ?? undefined);
      await fetchGroups();
    } catch (e) { console.error("saveEntry error:", e); }
  }

  async function deleteEntry(id: string): Promise<void> {
    try {
      await invoke("secrets_delete", { id });
      await fetchEntries(activeGroup() ?? undefined);
      await fetchGroups();
    } catch (e) { console.error("deleteEntry error:", e); }
  }

  async function search(query: string): Promise<SecretEntry[]> {
    setSearchQuery(query);
    try {
      if (!query.trim()) {
        await fetchEntries(activeGroup() ?? undefined);
        return entries();
      }
      const results = await invoke<SecretEntry[]>("secrets_search", { query });
      setEntries(results);
      return results;
    } catch (e) {
      console.error("search error:", e);
      return [];
    }
  }

  // ─── App secrets shortcuts ───

  async function getAppSecret(key: string): Promise<string | null> {
    try {
      return await invoke<string>("secrets_get_app_secret", { key });
    } catch {
      return null;
    }
  }

  async function setAppSecret(key: string, value: string): Promise<void> {
    await invoke("secrets_set_app_secret", { key, value });
  }

  // ─── Password generator ───

  function generatePassword(length = 20, options?: { uppercase?: boolean; lowercase?: boolean; digits?: boolean; symbols?: boolean }): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    let chars = "";
    if (options?.uppercase !== false) chars += upper;
    if (options?.lowercase !== false) chars += lower;
    if (options?.digits !== false) chars += digits;
    if (options?.symbols !== false) chars += symbols;

    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => chars[b % chars.length]).join("");
  }

  // ─── Legacy migration ───

  async function migrateLegacySecrets(): Promise<void> {
    const MIGRATION_KEY = "magick-cookie-secrets-migrated";
    if (localStorage.getItem(MIGRATION_KEY) === "true") return;

    try {
      // Migrate infra secrets from preferences
      const prefsStr = localStorage.getItem("magick-cookie-preferences");
      if (prefsStr) {
        const prefs = JSON.parse(prefsStr);
        const infra = prefs?.infra;
        if (infra) {
          if (infra.ovhAppKey) await setAppSecret("ovh_app_key", infra.ovhAppKey);
          if (infra.ovhAppSecret) await setAppSecret("ovh_app_secret", infra.ovhAppSecret);
          if (infra.ovhConsumerKey) await setAppSecret("ovh_consumer_key", infra.ovhConsumerKey);
          if (infra.cfApiToken) await setAppSecret("cf_api_token", infra.cfApiToken);
          if (infra.githubToken) await setAppSecret("github_token", infra.githubToken);
          if (infra.gitlabToken) await setAppSecret("gitlab_token", infra.gitlabToken);

          // Clean secrets from preferences
          delete infra.ovhAppKey;
          delete infra.ovhAppSecret;
          delete infra.ovhConsumerKey;
          delete infra.cfApiToken;
          delete infra.githubToken;
          delete infra.gitlabToken;

          // Clean server passwords
          if (Array.isArray(infra.servers)) {
            for (const server of infra.servers) {
              if (server.password) {
                await setAppSecret(`ssh_password_${server.id}`, server.password);
                delete server.password;
              }
              if (server.keyPath) {
                await setAppSecret(`ssh_keypath_${server.id}`, server.keyPath);
                delete server.keyPath;
              }
            }
          }

          localStorage.setItem("magick-cookie-preferences", JSON.stringify(prefs));
        }
      }

      // Migrate AI provider keys
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("ide-apikey-")) {
          const provider = key.replace("ide-apikey-", "");
          const value = localStorage.getItem(key);
          if (value) {
            await setAppSecret(`ai_apikey_${provider}`, value);
            localStorage.removeItem(key);
          }
        }
      }

      localStorage.setItem(MIGRATION_KEY, "true");
    } catch (e) {
      console.error("Secret migration error:", e);
    }
  }

  // ─── KDBX storage mode ───

  async function isLocalMode(): Promise<boolean> {
    try {
      return await invoke<boolean>("secrets_is_local_mode");
    } catch {
      return true; // fall back to local when notes/git isn't configured
    }
  }

  async function setLocalMode(local: boolean): Promise<void> {
    await invoke("secrets_set_local_mode", { local });
  }

  async function exportKdbx(outputPath: string): Promise<void> {
    await invoke("secrets_export_kdbx", { outputPath });
  }

  async function importKdbx(inputPath: string, importPassword: string): Promise<number> {
    return invoke<number>("secrets_import_kdbx", { inputPath, importPassword });
  }

  async function deleteGroup(path: string): Promise<void> {
    await invoke("secrets_delete_group", { path });
  }

  // ─── Sync app secrets to backend API ───

  async function syncAppSecretsToBackend(): Promise<void> {
    try {
      const secrets: Record<string, string> = {};

      // Read all app secrets
      for (const key of [
        "ovh_app_key", "ovh_app_secret", "ovh_consumer_key",
        "cf_api_token", "github_token", "gitlab_token",
      ]) {
        const val = await getAppSecret(key);
        if (val) secrets[key] = val;
      }

      // Map to infraConfig format
      const infraConfig: Record<string, unknown> = {
        ovhAppKey: secrets.ovh_app_key ?? "",
        ovhAppSecret: secrets.ovh_app_secret ?? "",
        ovhConsumerKey: secrets.ovh_consumer_key ?? "",
        cfApiToken: secrets.cf_api_token ?? "",
        githubToken: secrets.github_token ?? "",
        gitlabToken: secrets.gitlab_token ?? "",
      };

      // Get vault path
      try {
        const config = await invoke<{ path: string }>("notes_get_config");
        if (config.path) infraConfig.vaultPath = config.path;
      } catch { /* vault not configured */ }

      // Get servers from preferences (non-secret metadata)
      const prefsStr = localStorage.getItem("magick-cookie-preferences");
      if (prefsStr) {
        const prefs = JSON.parse(prefsStr);
        if (prefs?.infra?.servers) infraConfig.servers = prefs.infra.servers;
      }

      await fetch(`${API_BASE}/infra/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(infraConfig),
      });
    } catch { /* API might not be running */ }
  }

  return {
    // State
    isUnlocked,
    entries,
    groups,
    searchQuery,
    activeGroup,
    setActiveGroup,

    // Actions
    checkUnlocked,
    unlock,
    lock,
    fetchEntries,
    fetchGroups,
    getPassword,
    saveEntry,
    deleteEntry,
    search,
    getAppSecret,
    setAppSecret,
    generatePassword,
    syncAppSecretsToBackend,

    // KDBX storage mode + import/export
    isLocalMode,
    setLocalMode,
    exportKdbx,
    importKdbx,
    deleteGroup,

    // Auto-lock
    autoLockMinutes,
    setAutoLockMinutes,
  };
}
