import { createSignal } from "solid-js";
import type { ViewMode } from "../../domain/models/types";

const [viewMode, setViewModeRaw] = createSignal<ViewMode>("dashboard");
const [navTick, setNavTick] = createSignal(0);
const [currentDate, setCurrentDate] = createSignal(new Date());
const [selectedDate, setSelectedDate] = createSignal<Date | null>(null);
const [settingsTab, setSettingsTab] = createSignal<string | null>(null);

function setViewMode(mode: ViewMode) {
  setViewModeRaw(mode);
  setNavTick((n) => n + 1);
}

function openSettings(tab: string) {
  setSettingsTab(tab);
  setViewModeRaw("settings");
  setNavTick((n) => n + 1);
}

export function useViewStore() {
  function navigatePrev() {
    const d = new Date(currentDate());
    switch (viewMode()) {
      case "triage":
      case "notes":
      case "email":
      case "chat":
      case "settings":
      case "tools":
      case "dashboard": return;
      case "month": d.setMonth(d.getMonth() - 1); break;
      case "week": d.setDate(d.getDate() - 7); break;
      case "day": d.setDate(d.getDate() - 1); break;
    }
    setCurrentDate(d);
  }

  function navigateNext() {
    const d = new Date(currentDate());
    switch (viewMode()) {
      case "triage":
      case "notes":
      case "email":
      case "chat":
      case "settings":
      case "tools":
      case "dashboard": return;
      case "month": d.setMonth(d.getMonth() + 1); break;
      case "week": d.setDate(d.getDate() + 7); break;
      case "day": d.setDate(d.getDate() + 1); break;
    }
    setCurrentDate(d);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  return {
    viewMode, setViewMode, navTick, settingsTab, setSettingsTab, openSettings,
    currentDate, setCurrentDate,
    selectedDate, setSelectedDate,
    navigatePrev, navigateNext, goToToday,
  };
}
