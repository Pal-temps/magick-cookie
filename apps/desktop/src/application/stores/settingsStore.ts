import { createSignal } from "solid-js";
import { DEFAULT_PREFERENCES, type UserPreferences } from "../../domain/models/UserPreferences";
import { scheduleSyncToVault } from "../services/vaultSyncService";

const STORAGE_KEY = "magick-cookie-preferences";

function loadPreferences(): UserPreferences {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing) as UserPreferences;
    } catch {
      return structuredClone(DEFAULT_PREFERENCES);
    }
  }
  return structuredClone(DEFAULT_PREFERENCES);
}

const [preferences, setPreferences] = createSignal<UserPreferences>(loadPreferences());

function persist(prefs: UserPreferences) {
  setPreferences(prefs);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  // Debounced sync to vault (sanitized, no secrets)
  scheduleSyncToVault(prefs);
}

function patch<K extends keyof Omit<UserPreferences, "version" | "locale">>(
  section: K,
  update: Partial<UserPreferences[K]>,
) {
  const current = preferences();
  const patched: UserPreferences = {
    ...current,
    [section]: { ...(current[section] as any), ...(update as any) },
  };
  persist(patched);
}

// --- Public API ---

export function useSettingsStore() {
  // Theme
  function getTheme() { return preferences().theme; }
  function patchTheme(update: Partial<UserPreferences["theme"]>) { patch("theme", update); }

  // Focus
  function getFocus() { return preferences().focus; }
  function patchFocus(update: Partial<UserPreferences["focus"]>) { patch("focus", update); }

  // Dashboard
  function getDashboard() { return preferences().dashboard; }
  function patchDashboard(update: Partial<UserPreferences["dashboard"]>) { patch("dashboard", update); }

  // Shortcuts
  function getShortcuts() { return preferences().shortcuts; }
  function patchShortcuts(update: Partial<UserPreferences["shortcuts"]>) { patch("shortcuts", update); }

  // Brief
  function getBrief() { return preferences().brief; }
  function patchBrief(update: Partial<UserPreferences["brief"]>) { patch("brief", update); }

  // Env
  function getEnv() { return preferences().env; }
  function patchEnv(update: Partial<UserPreferences["env"]>) { patch("env", update); }

  // VPS
  function getVps() { return preferences().vps; }
  function patchVps(update: Partial<UserPreferences["vps"]>) { patch("vps", update); }

  // Sidebar
  function getSidebar() { return preferences().sidebar; }
  function patchSidebar(update: Partial<UserPreferences["sidebar"]>) { patch("sidebar", update); }

  // RSS
  function getRss() { return preferences().rss ?? { retentionDays: 90 }; }
  function patchRss(update: Partial<UserPreferences["rss"]>) { patch("rss", update); }

  // Locale
  function getLocale(): "fr" | "en" { return preferences().locale ?? "fr"; }
  function setLocale(locale: "fr" | "en") {
    const current = preferences();
    persist({ ...current, locale });
  }

  // Workspace
  function getWorkspace() { return preferences().workspace ?? { rootDirs: [], manualProjects: [], favorites: [], activeProjectPath: null }; }
  function patchWorkspace(update: Partial<UserPreferences["workspace"]>) { patch("workspace", update); }

  // Infrastructure (DNS, SSH, Git remotes)
  function getInfra() { return preferences().infra ?? { ovhAppKey: "", ovhAppSecret: "", ovhConsumerKey: "", cfApiToken: "", githubToken: "", gitlabToken: "", gitlabUrl: "https://gitlab.com", servers: [] }; }
  function patchInfra(update: Partial<UserPreferences["infra"]>) { patch("infra", update); }

  // AI Tools permissions
  function getAiTools() { return preferences().aiTools ?? { disabledTools: [] }; }
  function patchAiTools(update: Partial<UserPreferences["aiTools"]>) { patch("aiTools", update); }

  // Snapshot for sync
  function getSnapshot(): UserPreferences { return preferences(); }

  // Import from server sync
  function importFromSync(data: UserPreferences) {
    persist(data);
  }

  return {
    preferences,
    getLocale, setLocale,
    getTheme, patchTheme,
    getFocus, patchFocus,
    getDashboard, patchDashboard,
    getShortcuts, patchShortcuts,
    getBrief, patchBrief,
    getEnv, patchEnv,
    getVps, patchVps,
    getSidebar, patchSidebar,
    getRss, patchRss,
    getWorkspace, patchWorkspace,
    getInfra, patchInfra,
    getAiTools, patchAiTools,
    getSnapshot,
    importFromSync,
  };
}
