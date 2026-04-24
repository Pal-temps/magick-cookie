import { createSignal, onCleanup } from "solid-js";
import { useSettingsStore } from "./settingsStore";

export type Theme = "dark" | "light" | "cookie";
export type ThemeMode = "manual" | "auto-system" | "auto-schedule";

export interface ThemeSchedule {
  darkStart: number; // hour 0-23
  darkEnd: number;   // hour 0-23
}

const settings = useSettingsStore();

function getInitialTheme(): Theme {
  const stored = settings.getTheme().theme;
  if (stored === "dark" || stored === "light" || stored === "cookie") return stored;
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "cookie";
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
const [themeMode, setThemeModeSignal] = createSignal<ThemeMode>(settings.getTheme().mode);
const [schedule, setScheduleSignal] = createSignal<ThemeSchedule>(settings.getTheme().schedule);

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
    settings.patchTheme({ theme: t });
    // Choosing a theme manually → switch to manual mode
    if (themeMode() !== "manual") {
      setThemeModeSignal("manual");
      settings.patchTheme({ mode: "manual" });
      teardownAutoListeners();
    }
    applyCurrentTheme();
  }

  function setMode(m: ThemeMode) {
    setThemeModeSignal(m);
    settings.patchTheme({ mode: m });
    setupAutoListeners();
    applyCurrentTheme();
  }

  function setSchedule(s: ThemeSchedule) {
    setScheduleSignal(s);
    settings.patchTheme({ schedule: s });
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
