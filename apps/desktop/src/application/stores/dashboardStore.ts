import { createSignal } from "solid-js";

export const WIDGET_IDS = [
  "timer",
  "daily-stats",
  "water",
  "fruits",
  "dog-walk",
  "today-events",
  "wellness",
  "streak",
  "github-prs",
  "vps",
  "analytics",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

const ORDER_KEY = "dashboard-widget-order";
const OLD_ORDER_KEY = "magick-cookie-dashboard-order"; // legacy key migration
const HIDDEN_KEY = "dashboard-hidden-widgets";

const DEFAULT_ORDER: WidgetId[] = [...WIDGET_IDS];

function loadOrder(): WidgetId[] {
  try {
    const stored = localStorage.getItem(ORDER_KEY) ?? localStorage.getItem(OLD_ORDER_KEY);
    if (stored) {
      // migrate legacy key
      if (!localStorage.getItem(ORDER_KEY)) {
        localStorage.setItem(ORDER_KEY, stored);
        localStorage.removeItem(OLD_ORDER_KEY);
      }
      const ids = JSON.parse(stored) as string[];
      const known = new Set<string>(WIDGET_IDS);
      const valid = ids.filter((id) => known.has(id)) as WidgetId[];
      const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {}
  return [...DEFAULT_ORDER];
}

function saveOrder(ids: WidgetId[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

function loadHidden(): Set<WidgetId> {
  try {
    const stored = localStorage.getItem(HIDDEN_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      const known = new Set<string>(WIDGET_IDS);
      return new Set(ids.filter((id) => known.has(id)) as WidgetId[]);
    }
  } catch {}
  return new Set();
}

function saveHidden(hidden: Set<WidgetId>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
}

const [widgetOrder, setWidgetOrder] = createSignal<WidgetId[]>(loadOrder());
const [hiddenWidgets, setHiddenWidgets] = createSignal<Set<WidgetId>>(loadHidden());

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
    setHiddenWidgets(new Set());
    saveOrder([...DEFAULT_ORDER]);
    saveHidden(new Set());
  }

  return {
    widgetOrder,
    hiddenWidgets,
    reorderWidget,
    toggleWidget,
    resetLayout,
  };
}
