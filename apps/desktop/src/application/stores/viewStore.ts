import { createSignal } from "solid-js";
import type { ViewMode } from "../../domain/models/types";

const [viewMode, setViewMode] = createSignal<ViewMode>("month");
const [currentDate, setCurrentDate] = createSignal(new Date());
const [selectedDate, setSelectedDate] = createSignal<Date | null>(null);

export function useViewStore() {
  function navigatePrev() {
    const d = new Date(currentDate());
    switch (viewMode()) {
      case "month": d.setMonth(d.getMonth() - 1); break;
      case "week": d.setDate(d.getDate() - 7); break;
      case "day": d.setDate(d.getDate() - 1); break;
    }
    setCurrentDate(d);
  }

  function navigateNext() {
    const d = new Date(currentDate());
    switch (viewMode()) {
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
    viewMode, setViewMode,
    currentDate, setCurrentDate,
    selectedDate, setSelectedDate,
    navigatePrev, navigateNext, goToToday,
  };
}
