import { createSignal, onCleanup } from "solid-js";

export type Theme = "dark" | "light" | "cookie";
export type ThemeMode = "light" | "dark" | "auto-system" | "auto-schedule";

export interface ThemeSchedule {
  darkStart: number; // hour 0-23
  darkEnd: number;   // hour 0-23
}

const STORAGE_KEY = "magick-cookie-theme";
const MODE_STORAGE_KEY = "magick-cookie-theme-mode";
const SCHEDULE_STORAGE_KEY = "magick-cookie-theme-schedule";

const DEFAULT_SCHEDULE: ThemeSchedule = { darkStart: 20, darkEnd: 7 };

function loadSchedule(): ThemeSchedule {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.darkStart === "number" && typeof parsed.darkEnd === "number") {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SCHEDULE };
}

function loadMode(): ThemeMode {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto-system" || stored === "auto-schedule") {
    return stored;
  }
  // Migration: if user had a manual theme stored, infer mode from it
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  if (storedTheme === "light") return "light";
  if (storedTheme === "dark" || storedTheme === "cookie") return "dark";
  return "auto-system";
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "cookie") return stored;
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

function isInDarkSchedule(schedule: ThemeSchedule): boolean {
  const hour = new Date().getHours();
  if (schedule.darkStart > schedule.darkEnd) {
    // Wraps midnight: e.g. 20-7 means dark from 20:00 to 06:59
    return hour >= schedule.darkStart || hour < schedule.darkEnd;
  } else if (schedule.darkStart < schedule.darkEnd) {
    // Same day range: e.g. 8-18 means dark from 08:00 to 17:59
    return hour >= schedule.darkStart && hour < schedule.darkEnd;
  }
  return false;
}

function resolveThemeForMode(mode: ThemeMode, manualTheme: Theme, schedule: ThemeSchedule): Theme {
  switch (mode) {
    case "light":
      return "light";
    case "dark":
      return manualTheme === "light" ? "dark" : manualTheme; // preserve cookie if selected
    case "auto-system": {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    }
    case "auto-schedule":
      return isInDarkSchedule(schedule) ? "dark" : "light";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  const colors: Record<Theme, string> = {
    dark: "#0d0d11",
    light: "#f8f7f4",
    cookie: "#2c1e14",
  };
  if (meta) meta.setAttribute("content", colors[theme]);
}

const [theme, setThemeSignal] = createSignal<Theme>(getInitialTheme());
const [themeMode, setThemeModeSignal] = createSignal<ThemeMode>(loadMode());
const [schedule, setScheduleSignal] = createSignal<ThemeSchedule>(loadSchedule());

// Internals for cleanup
let systemMediaQuery: MediaQueryList | null = null;
let systemListener: ((e: MediaQueryListEvent) => void) | null = null;
let scheduleIntervalId: number | null = null;

function applyCurrentMode() {
  const resolved = resolveThemeForMode(themeMode(), theme(), schedule());
  applyTheme(resolved);
}

function teardownAutoListeners() {
  if (systemListener && systemMediaQuery) {
    systemMediaQuery.removeEventListener("change", systemListener);
    systemMediaQuery = null;
    systemListener = null;
  }
  if (scheduleIntervalId !== null) {
    clearInterval(scheduleIntervalId);
    scheduleIntervalId = null;
  }
}

function setupAutoListeners() {
  teardownAutoListeners();

  const mode = themeMode();

  if (mode === "auto-system") {
    systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemListener = () => applyCurrentMode();
    systemMediaQuery.addEventListener("change", systemListener);
  }

  if (mode === "auto-schedule") {
    scheduleIntervalId = window.setInterval(() => applyCurrentMode(), 60_000);
  }
}

// Initialize on load
applyCurrentMode();
setupAutoListeners();

export function useThemeStore() {
  // Cleanup when the component using the store unmounts (app root teardown)
  onCleanup(() => teardownAutoListeners());

  function setTheme(t: Theme) {
    setThemeSignal(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyCurrentMode();
  }

  function setMode(m: ThemeMode) {
    setThemeModeSignal(m);
    localStorage.setItem(MODE_STORAGE_KEY, m);
    setupAutoListeners();
    applyCurrentMode();
  }

  function setSchedule(s: ThemeSchedule) {
    setScheduleSignal(s);
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(s));
    if (themeMode() === "auto-schedule") {
      applyCurrentMode();
    }
  }

  function cycleTheme() {
    const order: Theme[] = ["dark", "light", "cookie"];
    const idx = order.indexOf(theme());
    setTheme(order[(idx + 1) % order.length]);
  }

  function cycleMode() {
    const order: ThemeMode[] = ["dark", "light", "auto-system", "auto-schedule"];
    const idx = order.indexOf(themeMode());
    setMode(order[(idx + 1) % order.length]);
  }

  /** The resolved (effective) theme currently applied to the document */
  function resolvedTheme(): Theme {
    return resolveThemeForMode(themeMode(), theme(), schedule());
  }

  return {
    theme,
    setTheme,
    cycleTheme,
    themeMode,
    setMode,
    cycleMode,
    schedule,
    setSchedule,
    resolvedTheme,
  };
}
