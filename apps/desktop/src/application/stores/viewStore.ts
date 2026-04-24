import { createSignal } from "solid-js";
import type { ViewMode } from "../../domain/models/types";

const [viewMode, setViewModeRaw] = createSignal<ViewMode>("dashboard");
const [navTick, setNavTick] = createSignal(0);
const [currentDate, setCurrentDate] = createSignal(new Date());
const [selectedDate, setSelectedDate] = createSignal<Date | null>(null);
const [settingsTab, setSettingsTab] = createSignal<string | null>(null);
const [sidebarVisible, setSidebarVisible] = createSignal(true);
export type NotesMainTab = "notes" | "bookmarks" | "snippets";
const [notesMainTab, setNotesMainTabRaw] = createSignal<NotesMainTab>(
  (localStorage.getItem("notes-main-tab") as NotesMainTab) || "notes"
);
function setNotesMainTab(tab: NotesMainTab) {
  setNotesMainTabRaw(tab);
  localStorage.setItem("notes-main-tab", tab);
}

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
      case "flux":
      case "notes":
      case "ide":
      case "email":
      case "settings":
      case "tools":
      case "bench":
      case "browser":
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
      case "flux":
      case "notes":
      case "ide":
      case "email":
      case "settings":
      case "tools":
      case "bench":
      case "browser":
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

  function toggleSidebar() { setSidebarVisible((v) => !v); }

  return {
    viewMode, setViewMode, navTick, settingsTab, setSettingsTab, openSettings,
    currentDate, setCurrentDate,
    selectedDate, setSelectedDate,
    navigatePrev, navigateNext, goToToday,
    sidebarVisible, toggleSidebar,
    notesMainTab, setNotesMainTab,
  };
}
