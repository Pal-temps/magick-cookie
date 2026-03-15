import { createSignal } from "solid-js";

export type Theme = "dark" | "light" | "cookie";

const STORAGE_KEY = "magick-cookie-theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "cookie") return stored;
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // Update meta theme-color for OS title bar
  const meta = document.querySelector('meta[name="theme-color"]');
  const colors: Record<Theme, string> = {
    dark: "#0d0d11",
    light: "#f8f7f4",
    cookie: "#2c1e14",
  };
  if (meta) meta.setAttribute("content", colors[theme]);
}

const [theme, setThemeSignal] = createSignal<Theme>(getInitialTheme());

// Apply on load
applyTheme(theme());

export function useThemeStore() {
  function setTheme(t: Theme) {
    setThemeSignal(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }

  function cycleTheme() {
    const order: Theme[] = ["dark", "light", "cookie"];
    const idx = order.indexOf(theme());
    setTheme(order[(idx + 1) % order.length]);
  }

  return { theme, setTheme, cycleTheme };
}
