import { createSignal } from "solid-js";
import { DEFAULT_PREFERENCES, type UserPreferences } from "../../domain/models/UserPreferences";

const STORAGE_KEY = "magick-cookie-preferences";

// Legacy keys to migrate from
const LEGACY_KEYS = [
  "magick-cookie-theme",
  "magick-cookie-theme-mode",
  "magick-cookie-theme-schedule",
  "magick-cookie-shortcuts",
  "magick-cookie-focus-mode",
  "dashboard-widget-order",
  "magick-cookie-dashboard-order",
  "dashboard-hidden-widgets",
  "magick-cookie-brief-templates",
  "magick-cookie-brief-active-template",
  "env-custom-checks",
  "magick-cookie-vps-notifications",
  "sidebar-section-order",
];

function migrateLegacy(): UserPreferences {
  const prefs: UserPreferences = structuredClone(DEFAULT_PREFERENCES);

  // Theme
  const storedTheme = localStorage.getItem("magick-cookie-theme");
  if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "cookie") {
    prefs.theme.theme = storedTheme;
  }
  const storedMode = localStorage.getItem("magick-cookie-theme-mode");
  if (storedMode === "manual" || storedMode === "auto-system" || storedMode === "auto-schedule") {
    prefs.theme.mode = storedMode;
  }
  try {
    const raw = localStorage.getItem("magick-cookie-theme-schedule");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.darkStart === "number" && typeof parsed.darkEnd === "number") {
        prefs.theme.schedule = parsed;
      }
    }
  } catch {}

  // Shortcuts
  try {
    const raw = localStorage.getItem("magick-cookie-shortcuts");
    if (raw) prefs.shortcuts.custom = JSON.parse(raw) as [string, string][];
  } catch {}

  // Focus
  const focusRaw = localStorage.getItem("magick-cookie-focus-mode");
  if (focusRaw !== null) prefs.focus.enabled = focusRaw !== "false";

  // Dashboard
  try {
    const orderRaw = localStorage.getItem("dashboard-widget-order") ?? localStorage.getItem("magick-cookie-dashboard-order");
    if (orderRaw) prefs.dashboard.widgetOrder = JSON.parse(orderRaw) as string[];
  } catch {}
  try {
    const hiddenRaw = localStorage.getItem("dashboard-hidden-widgets");
    if (hiddenRaw) prefs.dashboard.hiddenWidgets = JSON.parse(hiddenRaw) as string[];
  } catch {}

  // Brief
  try {
    const tplRaw = localStorage.getItem("magick-cookie-brief-templates");
    if (tplRaw) prefs.brief.customTemplates = JSON.parse(tplRaw);
  } catch {}
  const activeId = localStorage.getItem("magick-cookie-brief-active-template");
  if (activeId) prefs.brief.activeTemplateId = activeId;

  // Env
  try {
    const envRaw = localStorage.getItem("env-custom-checks");
    if (envRaw) prefs.env.customChecks = JSON.parse(envRaw);
  } catch {}

  // VPS
  const vpsRaw = localStorage.getItem("magick-cookie-vps-notifications");
  if (vpsRaw !== null) prefs.vps.notificationsEnabled = vpsRaw !== "false";

  // Sidebar
  try {
    const sidebarRaw = localStorage.getItem("sidebar-section-order");
    if (sidebarRaw) prefs.sidebar.sectionOrder = JSON.parse(sidebarRaw);
  } catch {}

  return prefs;
}

function loadPreferences(): UserPreferences {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing) as UserPreferences;
    } catch {
      return structuredClone(DEFAULT_PREFERENCES);
    }
  }

  // First time: migrate from legacy keys
  const migrated = migrateLegacy();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));

  // Remove legacy keys
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }

  return migrated;
}

const [preferences, setPreferences] = createSignal<UserPreferences>(loadPreferences());

function persist(prefs: UserPreferences) {
  setPreferences(prefs);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function patch<K extends keyof Omit<UserPreferences, "version">>(
  section: K,
  update: Partial<UserPreferences[K]>,
) {
  const current = preferences();
  const patched: UserPreferences = {
    ...current,
    [section]: { ...current[section], ...update },
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

  // Snapshot for sync
  function getSnapshot(): UserPreferences { return preferences(); }

  // Import from server sync
  function importFromSync(data: UserPreferences) {
    persist(data);
  }

  return {
    preferences,
    getTheme, patchTheme,
    getFocus, patchFocus,
    getDashboard, patchDashboard,
    getShortcuts, patchShortcuts,
    getBrief, patchBrief,
    getEnv, patchEnv,
    getVps, patchVps,
    getSidebar, patchSidebar,
    getRss, patchRss,
    getSnapshot,
    importFromSync,
  };
}
