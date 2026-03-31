import { createSignal } from "solid-js";
import { useSettingsStore } from "./settingsStore";

export const WIDGET_IDS = [
  "timer",
  "daily-stats",
  "water",
  "fruits",
  "dog-walk",
  "today-events",
  "wellness",
  "alarms",
  "streak",
  "github-prs",
  "vps",
  "analytics",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

const DEFAULT_ORDER: WidgetId[] = [...WIDGET_IDS];
const settings = useSettingsStore();

function loadOrder(): WidgetId[] {
  try {
    const ids = settings.getDashboard().widgetOrder;
    if (ids.length > 0) {
      const known = new Set<string>(WIDGET_IDS);
      const valid = ids.filter((id) => known.has(id)) as WidgetId[];
      const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {}
  return [...DEFAULT_ORDER];
}

function saveOrder(ids: WidgetId[]) {
  settings.patchDashboard({ widgetOrder: ids });
}

function loadHidden(): Set<WidgetId> {
  try {
    const ids = settings.getDashboard().hiddenWidgets;
    if (ids.length > 0) {
      const known = new Set<string>(WIDGET_IDS);
      return new Set(ids.filter((id) => known.has(id)) as WidgetId[]);
    }
  } catch {}
  return new Set();
}

function saveHidden(hidden: Set<WidgetId>) {
  settings.patchDashboard({ hiddenWidgets: [...hidden] });
}

function loadPinned(): WidgetId[] {
  try {
    const ids = settings.getDashboard().pinnedWidgets;
    if (ids?.length > 0) {
      const known = new Set<string>(WIDGET_IDS);
      return ids.filter((id) => known.has(id)) as WidgetId[];
    }
  } catch {}
  return [];
}

function savePinned(ids: WidgetId[]) {
  settings.patchDashboard({ pinnedWidgets: ids });
}

const [widgetOrder, setWidgetOrder] = createSignal<WidgetId[]>(loadOrder());
const [hiddenWidgets, setHiddenWidgets] = createSignal<Set<WidgetId>>(loadHidden());
const [pinnedWidgets, setPinnedWidgets] = createSignal<WidgetId[]>(loadPinned());

export function useDashboardStore() {
  function reorderWidget(fromId: WidgetId, toId: WidgetId) {
    if (fromId === toId) return;
    const current = [...widgetOrder()];
    const fromIdx = current.indexOf(fromId);
    const toIdx = current.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    current.splice(fromIdx, 1);
    current.splice(toIdx, 0, fromId);
    setWidgetOrder(current);
    saveOrder(current);
  }

  function toggleWidget(id: WidgetId) {
    const current = new Set(hiddenWidgets());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    setHiddenWidgets(current);
    saveHidden(current);
  }

  function resetLayout() {
    setWidgetOrder([...DEFAULT_ORDER]);
    setHiddenWidgets(new Set<WidgetId>());
    saveOrder([...DEFAULT_ORDER]);
    saveHidden(new Set<WidgetId>());
  }

  function pinWidget(id: WidgetId) {
    const current = pinnedWidgets();
    if (!current.includes(id)) {
      const next = [...current, id];
      setPinnedWidgets(next);
      savePinned(next);
    }
  }

  function unpinWidget(id: WidgetId) {
    const next = pinnedWidgets().filter((w) => w !== id);
    setPinnedWidgets(next);
    savePinned(next);
  }

  function isPinned(id: WidgetId): boolean {
    return pinnedWidgets().includes(id);
  }

  return {
    widgetOrder,
    hiddenWidgets,
    pinnedWidgets,
    reorderWidget,
    toggleWidget,
    resetLayout,
    pinWidget,
    unpinWidget,
    isPinned,
  };
}
