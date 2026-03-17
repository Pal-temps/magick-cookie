import { createSignal, onCleanup } from "solid-js";

export type Theme = "dark" | "light" | "cookie";
export type ThemeMode = "manual" | "auto-system" | "auto-schedule";

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
  if (stored === "manual" || stored === "auto-system" || stored === "auto-schedule") {
    return stored;
  }
  // Migration from old modes: "light"/"dark" → "manual"
  if (stored === "light" || stored === "dark") return "manual";
  return "manual";
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
    return hour >= schedule.darkStart || hour < schedule.darkEnd;
  } else if (schedule.darkStart < schedule.darkEnd) {
    return hour >= schedule.darkStart && hour < schedule.darkEnd;
  }
  return false;
}

/**
 * In manual mode: always use the chosen theme.
 * In auto modes: switch between dark and light based on system/schedule.
 * Cookie is only available in manual mode.
 */
function resolveTheme(mode: ThemeMode, chosenTheme: Theme, schedule: ThemeSchedule): Theme {
  if (mode === "manual") return chosenTheme;
  if (mode === "auto-system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (mode === "auto-schedule") {
    return isInDarkSchedule(schedule) ? "dark" : "light";
  }
  return chosenTheme;
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

let systemMediaQuery: MediaQueryList | null = null;
let systemListener: ((e: MediaQueryListEvent) => void) | null = null;
let scheduleIntervalId: number | null = null;

function applyCurrentTheme() {
  const resolved = resolveTheme(themeMode(), theme(), schedule());
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
    systemListener = () => applyCurrentTheme();
    systemMediaQuery.addEventListener("change", systemListener);
  }

  if (mode === "auto-schedule") {
    scheduleIntervalId = window.setInterval(() => applyCurrentTheme(), 60_000);
  }
}

// Initialize on load
applyCurrentTheme();
setupAutoListeners();

export function useThemeStore() {
  onCleanup(() => teardownAutoListeners());

  function setTheme(t: Theme) {
    setThemeSignal(t);
    localStorage.setItem(STORAGE_KEY, t);
    // Choosing a theme manually → switch to manual mode
    if (themeMode() !== "manual") {
      setThemeModeSignal("manual");
      localStorage.setItem(MODE_STORAGE_KEY, "manual");
      teardownAutoListeners();
    }
    applyCurrentTheme();
  }

  function setMode(m: ThemeMode) {
    setThemeModeSignal(m);
    localStorage.setItem(MODE_STORAGE_KEY, m);
    setupAutoListeners();
    applyCurrentTheme();
  }

  function setSchedule(s: ThemeSchedule) {
    setScheduleSignal(s);
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(s));
    if (themeMode() === "auto-schedule") {
      applyCurrentTheme();
    }
  }

  function cycleTheme() {
    const order: Theme[] = ["dark", "light", "cookie"];
    const idx = order.indexOf(theme());
    setTheme(order[(idx + 1) % order.length]);
  }

  function resolvedTheme(): Theme {
    return resolveTheme(themeMode(), theme(), schedule());
  }

  return {
    theme,
    setTheme,
    cycleTheme,
    themeMode,
    setMode,
    schedule,
    setSchedule,
    resolvedTheme,
  };
}
