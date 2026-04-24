import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import type { Task } from "../../domain/models/Task";
import type { Email } from "../../domain/models/Email";
import type { RssArticle } from "./rssStore";

// ─── Types ───

export type FluxStatus = "priority" | "later" | "archived" | "dismissed";
export type FluxEntityType = "task" | "email" | "rss_article";

export interface FluxItem {
  id: string;
  entityType: FluxEntityType;
  entityId: string;
  fluxStatus: FluxStatus;
  decidedAt: string;
}

export interface FluxDecision {
  entityType: FluxEntityType;
  entityId: string;
  fluxStatus: FluxStatus;
}

export interface FluxSuggestion {
  entityType: FluxEntityType;
  entityId: string;
  entityTitle: string;
  suggestedStatus: "priority" | "later" | "archived";
  reason: string;
}

/** Normalized item for swipe/kanban display */
export interface FluxableItem {
  entityType: FluxEntityType;
  entityId: string;
  title: string;
  preview: string;
  source: string;
  priority?: string | null;
  labels?: string[];
  timestamp: string;
  url?: string | null;
}

// ─── Helpers ───

function fluxKey(type: FluxEntityType, id: string): string {
  return `${type}:${id}`;
}

export function taskToFluxable(task: Task): FluxableItem {
  return {
    entityType: "task",
    entityId: task.id,
    title: task.title,
    preview: task.description?.slice(0, 120) ?? "",
    source: task.source,
    priority: task.priority,
    labels: task.labels,
    timestamp: task.createdAt,
    url: task.url,
  };
}

export function emailToFluxable(email: Email): FluxableItem {
  return {
    entityType: "email",
    entityId: email.id,
    title: email.subject ?? "(sans sujet)",
    preview: email.bodyText?.slice(0, 120) ?? "",
    source: email.fromName ?? email.fromAddress,
    priority: email.isStarred ? "high" : null,
    labels: [],
    timestamp: email.sentAt,
  };
}

export function articleToFluxable(article: RssArticle, feedLabel?: string): FluxableItem {
  return {
    entityType: "rss_article",
    entityId: article.id,
    title: article.title ?? "(sans titre)",
    preview: article.description?.slice(0, 120) ?? "",
    source: feedLabel ?? article.author ?? "RSS",
    priority: article.isStarred ? "high" : null,
    labels: [],
    timestamp: article.publishedAt ?? article.createdAt,
    url: article.link,
  };
}

// ─── Kanban / Counts types (mirrors API) ───

export interface FluxKanbanItem {
  entityType: FluxEntityType;
  entityId: string;
  fluxStatus: FluxStatus | "undecided";
  title: string;
  source: string;
  preview: string | null;
  date: string | null;
}

export interface FluxKanbanColumn {
  status: FluxStatus | "undecided";
  items: FluxKanbanItem[];
  total: number;
}

export interface FluxCountsResult {
  [entityType: string]: {
    [status: string]: number;
  };
}

// ─── State ───

const [fluxMap, setFluxMap] = createSignal<Map<string, FluxStatus>>(new Map());
const [pendingDecisions, setPendingDecisions] = createSignal<FluxDecision[]>([]);
const [fluxQueue, setFluxQueue] = createSignal<FluxableItem[]>([]);
const [currentIndex, setCurrentIndex] = createSignal(0);
const [isFluxing, setIsFluxing] = createSignal(false);
const [isSaving, setIsSaving] = createSignal(false);
const [activeEntityType, setActiveEntityType] = createSignal<FluxEntityType | "all">("all");
const [suggestions, setSuggestions] = createSignal<FluxSuggestion[]>([]);
const [suggestLoading, setSuggestLoading] = createSignal(false);

/** Kanban columns from GET /flux/kanban — paginated per column */
const [kanbanColumns, setKanbanColumns] = createSignal<Record<string, FluxKanbanColumn>>({});
const [isKanbanLoading, setIsKanbanLoading] = createSignal(false);

/** Lightweight counts from GET /flux/counts — for sidebar badges */
const [fluxCounts, setFluxCounts] = createSignal<FluxCountsResult | null>(null);

const KANBAN_PAGE_SIZE = 50;

// ─── Store ───

export function useFluxStore() {
  async function fetchFlux(entityType?: FluxEntityType) {
    const qs = entityType ? `?type=${entityType}` : "";
    const data = await api.get<FluxItem[]>(`/flux${qs}`);
    // Backward compat: data might be an array (old API) or undefined
    const items = Array.isArray(data) ? data : [];
    const map = new Map<string, FluxStatus>();
    for (const item of items) {
      map.set(fluxKey(item.entityType, item.entityId), item.fluxStatus);
    }
    setFluxMap(map);
  }

  /** Fetch kanban columns from GET /flux/kanban — paginated, enriched by the API */
  async function fetchKanban(limit: number = KANBAN_PAGE_SIZE) {
    setIsKanbanLoading(true);
    try {
      const columns = await api.get<FluxKanbanColumn[]>(`/flux/kanban?limit=${limit}`);
      if (!Array.isArray(columns)) return;
      const record: Record<string, FluxKanbanColumn> = {};
      for (const col of columns) {
        record[col.status] = col;
      }
      setKanbanColumns(record);

      // Also populate fluxMap from kanban data so swipe/move still works
      const map = new Map(fluxMap());
      for (const col of columns) {
        if (col.status === "undecided") continue;
        for (const item of col.items) {
          map.set(fluxKey(item.entityType, item.entityId), item.fluxStatus as FluxStatus);
        }
      }
      setFluxMap(map);
    } finally {
      setIsKanbanLoading(false);
    }
  }

  /** Fetch lightweight counts for sidebar badges: GET /flux/counts */
  async function fetchCounts() {
    try {
      const data = await api.get<FluxCountsResult>("/flux/counts");
      if (data && typeof data === "object") {
        setFluxCounts(data);
      }
    } catch (e) {
      console.error("[flux] Failed to fetch counts:", e);
    }
  }

  /** Load more items for a single kanban column: GET /flux?status=X&limit=50&offset=N */
  async function loadMoreColumn(status: FluxStatus | "undecided", offset: number) {
    try {
      if (status === "undecided") {
        // Undecided items are not in flux table — fetched differently
        // For now, re-fetch kanban with higher limit (will be improved in step 5)
        return;
      }
      const raw = await api.getRaw<{ data: FluxItem[]; total: number }>(
        `/flux?status=${status}&limit=${KANBAN_PAGE_SIZE}&offset=${offset}`
      );
      const items = raw?.data ?? [];
      const total = raw?.total ?? 0;

      if (items.length === 0) return;

      // We need to enrich these FluxItems to FluxKanbanItems.
      // For now, convert with minimal metadata (title will show entityId).
      // The kanban view should ideally call an enrichment endpoint or
      // the API should return enriched items. As a pragmatic step,
      // append raw flux items with entity info as-is.
      setKanbanColumns((prev) => {
        const col = prev[status];
        if (!col) return prev;
        const newItems: FluxKanbanItem[] = items.map((fi) => ({
          entityType: fi.entityType,
          entityId: fi.entityId,
          fluxStatus: fi.fluxStatus,
          title: fi.entityId, // placeholder — will be enriched by kanban view
          source: fi.entityType,
          preview: null,
          date: fi.decidedAt,
        }));
        return {
          ...prev,
          [status]: {
            ...col,
            items: [...col.items, ...newItems],
            total,
          },
        };
      });

      // Update fluxMap
      const map = new Map(fluxMap());
      for (const fi of items) {
        map.set(fluxKey(fi.entityType, fi.entityId), fi.fluxStatus);
      }
      setFluxMap(map);
    } catch (e) {
      console.error(`[flux] Failed to load more for column ${status}:`, e);
    }
  }

  function startFlux(items: FluxableItem[]) {
    const map = fluxMap();
    const undecided = items.filter((i) => !map.has(fluxKey(i.entityType, i.entityId)));
    setFluxQueue(undecided);
    setCurrentIndex(0);
    setPendingDecisions([]);
    setIsFluxing(true);
  }

  function currentItem(): FluxableItem | null {
    const queue = fluxQueue();
    const idx = currentIndex();
    return idx < queue.length ? queue[idx] : null;
  }

  function remainingCount(): number {
    return Math.max(0, fluxQueue().length - currentIndex());
  }

  function swipe(status: FluxStatus) {
    const item = currentItem();
    if (!item) return;

    setPendingDecisions((prev) => [...prev, {
      entityType: item.entityType,
      entityId: item.entityId,
      fluxStatus: status,
    }]);
    setFluxMap((prev) => {
      const next = new Map(prev);
      next.set(fluxKey(item.entityType, item.entityId), status);
      return next;
    });
    setCurrentIndex((i) => i + 1);
  }

  function undoLast() {
    const decisions = pendingDecisions();
    if (decisions.length === 0) return;

    const last = decisions[decisions.length - 1];
    setPendingDecisions((prev) => prev.slice(0, -1));
    setFluxMap((prev) => {
      const next = new Map(prev);
      next.delete(fluxKey(last.entityType, last.entityId));
      return next;
    });
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  async function saveFlux() {
    const decisions = pendingDecisions();
    if (decisions.length === 0) return;

    setIsSaving(true);
    try {
      await api.post("/flux/bulk", { items: decisions });
      setPendingDecisions([]);
    } finally {
      setIsSaving(false);
    }
  }

  function stopFlux() {
    setIsFluxing(false);
  }

  async function finishFlux() {
    await saveFlux();
    setIsFluxing(false);
  }

  function getItemStatus(type: FluxEntityType, id: string): FluxStatus | null {
    return fluxMap().get(fluxKey(type, id)) ?? null;
  }

  function getItemsByStatus(status: FluxStatus, items: FluxableItem[]): FluxableItem[] {
    const map = fluxMap();
    return items.filter((i) => map.get(fluxKey(i.entityType, i.entityId)) === status);
  }

  function getUndecidedItems(items: FluxableItem[]): FluxableItem[] {
    const map = fluxMap();
    return items.filter((i) => !map.has(fluxKey(i.entityType, i.entityId)));
  }

  async function moveItem(type: FluxEntityType, id: string, newStatus: FluxStatus) {
    setFluxMap((prev) => {
      const next = new Map(prev);
      next.set(fluxKey(type, id), newStatus);
      return next;
    });
    await api.post("/flux", { entityType: type, entityId: id, fluxStatus: newStatus });
  }

  async function undecideItem(type: FluxEntityType, id: string) {
    setFluxMap((prev) => {
      const next = new Map(prev);
      next.delete(fluxKey(type, id));
      return next;
    });
    try {
      await api.delete(`/flux/${type}/${id}`);
    } catch (e) {
      console.error("Failed to remove flux decision:", e);
    }
  }

  async function fetchSuggestions(entityType?: FluxEntityType) {
    const { trackAiActivity } = await import("./aiActivityStore");
    setSuggestLoading(true);
    try {
      const body = entityType ? { entityType } : {};
      const data = await trackAiActivity("Auto-tri IA", () =>
        api.post<FluxSuggestion[]>("/flux/suggest", body)
      );
      setSuggestions(data);
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    } finally {
      setSuggestLoading(false);
    }
  }

  function clearSuggestions() {
    setSuggestions([]);
  }

  return {
    // State
    fluxMap, pendingDecisions, fluxQueue, currentIndex,
    isFluxing, isSaving, activeEntityType, setActiveEntityType,
    suggestions, suggestLoading,
    kanbanColumns, isKanbanLoading,
    fluxCounts,

    // Actions
    fetchFlux, fetchKanban, fetchCounts, loadMoreColumn,
    startFlux, currentItem, remainingCount,
    swipe, undoLast, saveFlux, stopFlux, finishFlux,
    getItemStatus, getItemsByStatus, getUndecidedItems,
    moveItem, undecideItem,
    fetchSuggestions, clearSuggestions,
  };
}
