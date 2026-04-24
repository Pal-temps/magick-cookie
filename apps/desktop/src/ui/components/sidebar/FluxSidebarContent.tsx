import { Show, For, createMemo, createSignal, onMount } from "solid-js";
import { useFluxStore, type FluxEntityType } from "../../../application/stores/fluxStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useEmailStore } from "../../../application/stores/emailStore";
import { useRssStore } from "../../../application/stores/rssStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { emailAccountFilter, setEmailAccountFilter } from "../flux/FluxView";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";
import { CookieLoader } from "../common/CookieLoader";
import type { TaskSource } from "../../../domain/models/Task";

const rowBase = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  width: "100%",
  padding: "6px 12px",
  border: "none",
  "font-size": "12px",
  cursor: "pointer",
  "text-align": "left" as const,
  transition: "background 0.1s, opacity 0.15s",
  "border-radius": "0",
  "touch-action": "none",
};

const rowStyle = (active: boolean) => ({
  ...rowBase,
  background: active ? "var(--accent-primary)" : "transparent",
  color: active ? "#fff" : "var(--text-primary)",
  "font-weight": active ? "600" : "400",
});

const subRowStyle = (active: boolean) => ({
  ...rowBase,
  "padding-left": "28px",
  "font-size": "11px",
  background: active ? "var(--accent-primary)" : "transparent",
  color: active ? "#fff" : "var(--text-secondary)",
  "font-weight": active ? "600" : "400",
});

const badgeStyle = (active: boolean) => ({
  "margin-left": "auto",
  "font-size": "10px",
  padding: "0 6px",
  "border-radius": "8px",
  background: active ? "rgba(255,255,255,0.25)" : "var(--bg-elevated)",
  color: active ? "rgba(255,255,255,0.9)" : "var(--text-muted)",
  "flex-shrink": "0",
});

const handleStyle = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "14px",
  height: "16px",
  color: "var(--text-secondary)",
  opacity: "0.6",
  cursor: "grab",
  "flex-shrink": "0",
  transition: "opacity 0.15s, color 0.15s",
};

const SOURCES: { key: TaskSource; label: string }[] = [
  { key: "clickup", label: "ClickUp" },
  { key: "github", label: "GitHub" },
  { key: "gitlab", label: "GitLab" },
  { key: "manual", label: "Manuel" },
];

type SectionId = "all" | "task" | "email" | "rss_article";
const DEFAULT_ORDER: SectionId[] = ["all", "task", "email", "rss_article"];
const STORAGE_KEY = "flux-sidebar-order";

function loadOrder(): SectionId[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const parsed = JSON.parse(v) as SectionId[];
      // Ensure all sections are present
      const set = new Set(parsed);
      for (const s of DEFAULT_ORDER) { if (!set.has(s)) parsed.push(s); }
      return parsed.filter((s) => DEFAULT_ORDER.includes(s));
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

export function FluxSidebarContent() {
  const flux = useFluxStore();
  const taskStore = useTaskStore();
  const emailStore = useEmailStore();
  const rssStore = useRssStore();
  const { openSettings } = useViewStore();

  // Fetch server counts on mount if not already loaded
  onMount(() => {
    if (!flux.fluxCounts()) {
      flux.fetchCounts();
    }
  });

  // ─── Collapsible sections ───
  const [expandedSections, setExpandedSections] = createSignal<Set<SectionId>>(new Set());
  function toggleExpanded(id: SectionId) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const isExpanded = (id: SectionId) => expandedSections().has(id);
  const hasChildren = (id: SectionId) => id === "task" || id === "email" || id === "rss_article";

  // ─── Section order (drag-reorderable) ───
  const [sectionOrder, setSectionOrder] = createSignal<SectionId[]>(loadOrder());
  const [dragId, setDragId] = createSignal<SectionId | null>(null);
  const [dropId, setDropId] = createSignal<SectionId | null>(null);
  const [ghostPos, setGhostPos] = createSignal({ x: 0, y: 0 });
  const [dragLabel, setDragLabel] = createSignal("");

  function commitReorder() {
    const from = dragId(), to = dropId();
    setDragId(null);
    setDropId(null);
    if (!from || !to || from === to) return;
    const order = [...sectionOrder()];
    const fi = order.indexOf(from), ti = order.indexOf(to);
    if (fi === -1 || ti === -1) return;
    order.splice(fi, 1);
    order.splice(ti, 0, from);
    setSectionOrder(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }

  function handleDragStart(id: SectionId, label: string, e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    setDragId(id);
    setDragLabel(label);
    setGhostPos({ x: e.clientX, y: e.clientY });
  }

  function handleDragMove(e: PointerEvent) {
    if (!dragId()) return;
    setGhostPos({ x: e.clientX, y: e.clientY });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const section = el?.closest("[data-flux-section]") as HTMLElement | null;
    setDropId(section ? section.dataset.fluxSection as SectionId : null);
  }

  function handleDragEnd() {
    if (dragId()) commitReorder();
  }

  // ─── Counts (server-side via /flux/counts, with in-memory fallback) ───
  const countsData = () => flux.fluxCounts();

  /** Sum all status counts for a given entity type */
  function sumEntityCounts(entityType: string): number {
    const c = countsData();
    if (!c || !c[entityType]) return 0;
    const statuses = c[entityType];
    let total = 0;
    for (const key of Object.keys(statuses)) {
      total += statuses[key] ?? 0;
    }
    return total;
  }

  // Server-side counts with fallback to in-memory for instant display before API responds
  const taskCount = createMemo(() => {
    const c = countsData();
    if (c?.task) return sumEntityCounts("task");
    // Fallback: use totalTasks from paginated response, or loaded array length
    return taskStore.totalTasks() || taskStore.tasks().length;
  });

  const emailCount = createMemo(() => {
    const c = countsData();
    if (c?.email) return sumEntityCounts("email");
    return emailStore.emails().filter((e) => !e.isArchived && !e.isRead).length;
  });

  const articleCount = createMemo(() => {
    const c = countsData();
    if (c?.rss_article) return sumEntityCounts("rss_article");
    return rssStore.articles().filter((a) => !a.isRead).length;
  });

  const totalCount = createMemo(() => taskCount() + emailCount() + articleCount());

  // Sub-counts still use in-memory data (per-source/account/feed breakdown
  // is not provided by /flux/counts — those are inexpensive to compute locally)
  const taskCountBySource = createMemo(() => {
    const map: Record<string, number> = {};
    for (const t of taskStore.tasks()) { map[t.source] = (map[t.source] || 0) + 1; }
    return map;
  });

  const emailCountByAccount = createMemo(() => {
    const map: Record<string, number> = {};
    for (const e of emailStore.emails()) {
      if (!e.isArchived && !e.isRead) { map[e.accountId] = (map[e.accountId] || 0) + 1; }
    }
    return map;
  });

  const articleCountByFeed = createMemo(() => {
    const map: Record<string, number> = {};
    for (const a of rssStore.articles()) {
      if (!a.isRead) { map[a.feedId] = (map[a.feedId] || 0) + 1; }
    }
    return map;
  });

  // ─── Active state ───
  const isEntityActive = (type: FluxEntityType | "all") => flux.activeEntityType() === type;
  const isSourceActive = (src: TaskSource) => isEntityActive("task") && taskStore.sourceFilter() === src;
  const isAccountActive = (accId: string) => isEntityActive("email") && emailAccountFilter() === accId;
  const isFeedActive = (feedId: string) => isEntityActive("rss_article") && rssStore.activeFeedId() === feedId;

  function selectEntity(type: FluxEntityType | "all") {
    flux.setActiveEntityType(type);
    if (type === "task") taskStore.setSourceFilter("all");
    if (type === "email") setEmailAccountFilter("all");
  }

  function selectSource(src: TaskSource) {
    flux.setActiveEntityType("task");
    taskStore.setSourceFilter(src);
    taskStore.fetchTasks();
  }

  function selectAccount(accId: string) {
    flux.setActiveEntityType("email");
    setEmailAccountFilter(accId);
  }

  // ─── Section labels & counts ───
  const sectionLabel = (id: SectionId) => {
    switch (id) {
      case "all": return "Tout";
      case "task": return "Taches";
      case "email": return "Emails";
      case "rss_article": return "Articles";
    }
  };

  const sectionCount = (id: SectionId) => {
    switch (id) {
      case "all": return totalCount();
      case "task": return taskCount();
      case "email": return emailCount();
      case "rss_article": return articleCount();
    }
  };

  // ─── Drag handle SVG ───
  const DragDots = () => (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
      <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
      <circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/>
      <circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/>
    </svg>
  );

  // ─── Section renderer ───
  function renderSection(id: SectionId) {
    const isDragging = () => dragId() === id;
    const isDropTarget = () => dropId() === id && dragId() && dragId() !== id;
    const active = () => id === "all" ? isEntityActive("all") : id === "task" ? (isEntityActive("task") && taskStore.sourceFilter() === "all") : id === "email" ? (isEntityActive("email") && emailAccountFilter() === "all") : isEntityActive("rss_article");

    return (
      <div
        data-flux-section={id}
        style={{
          opacity: isDragging() ? "0.4" : "1",
          "border-top": isDropTarget() ? "2px solid var(--accent-primary)" : "2px solid transparent",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => {
          const handle = e.currentTarget.querySelector("[data-drag-handle]") as HTMLElement | null;
          if (handle) { handle.style.opacity = "1"; handle.style.color = "var(--accent-primary)"; }
        }}
        onMouseLeave={(e) => {
          const handle = e.currentTarget.querySelector("[data-drag-handle]") as HTMLElement | null;
          if (handle) { handle.style.opacity = "0.6"; handle.style.color = "var(--text-secondary)"; }
        }}
      >
        {/* Main row */}
        <div style={rowStyle(active())}>
          <span
            data-drag-handle
            style={handleStyle}
            onPointerDown={(e) => handleDragStart(id, sectionLabel(id), e)}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          ><DragDots /></span>
          <Show when={hasChildren(id)} fallback={
            <span style={{ width: "10px", "flex-shrink": "0" }} />
          }>
            <svg
              width="10" height="10" viewBox="0 0 12 12" fill="none"
              style={{ "flex-shrink": "0", transition: "transform 0.15s", transform: isExpanded(id) ? "rotate(90deg)" : "rotate(0deg)", color: active() ? "#fff" : "var(--text-muted)" }}
            >
              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </Show>
          <span
            style={{ flex: "1", cursor: "pointer" }}
            onClick={() => { selectEntity(id); if (hasChildren(id)) toggleExpanded(id); }}
          >{sectionLabel(id)}</span>
          <span style={badgeStyle(active())} onClick={() => { selectEntity(id); if (hasChildren(id)) toggleExpanded(id); }}>{sectionCount(id)}</span>
        </div>

        {/* Sub-items for Taches */}
        <Show when={id === "task" && isExpanded("task")}>
          <For each={SOURCES}>
            {(src) => {
              const count = () => taskCountBySource()[src.key] || 0;
              const configured = () => taskStore.isConnectorConfigured(src.key);
              return (
                <button
                  style={{ ...subRowStyle(isSourceActive(src.key)), opacity: configured() ? "1" : "0.4" }}
                  onClick={() => selectSource(src.key)}
                >
                  <span>{src.label}</span>
                  <span style={badgeStyle(isSourceActive(src.key))}>{count()}</span>
                </button>
              );
            }}
          </For>
        </Show>

        {/* Sub-items for Emails */}
        <Show when={id === "email" && isExpanded("email")}>
          <For each={emailStore.accounts()}>
            {(acc) => {
              const count = () => emailCountByAccount()[acc.id] || 0;
              return (
                <button style={subRowStyle(isAccountActive(acc.id))} onClick={() => selectAccount(acc.id)}>
                  <span>{acc.label || acc.email}</span>
                  <span style={badgeStyle(isAccountActive(acc.id))}>{count()}</span>
                </button>
              );
            }}
          </For>
        </Show>

        {/* Sub-items for Articles (RSS feeds) */}
        <Show when={id === "rss_article" && isExpanded("rss_article")}>
          <For each={rssStore.feeds()}>
            {(feed) => {
              const count = () => articleCountByFeed()[feed.id] || rssStore.unreadPerFeed()[feed.id] || 0;
              const active = () => isFeedActive(feed.id);
              return (
                <button style={subRowStyle(active())} onClick={() => { flux.setActiveEntityType("rss_article"); rssStore.setActiveFeedId(feed.id); }}>
                  <span>{feed.label}</span>
                  <span style={badgeStyle(active())}>{count()}</span>
                </button>
              );
            }}
          </For>
        </Show>
      </div>
    );
  }

  return (
    <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden", "border-top": "1px solid var(--border-color)" }}>
      {/* Navigation — drag-reorderable sections */}
      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <For each={sectionOrder()}>
          {(id) => renderSection(id)}
        </For>
      </div>

      {/* Drag ghost */}
      <Show when={dragId()}>
        <div style={{
          position: "fixed",
          left: `${ghostPos().x + 12}px`,
          top: `${ghostPos().y - 12}px`,
          "z-index": "1000",
          padding: "4px 10px",
          background: "var(--bg-surface)",
          border: "1.5px solid var(--accent-primary)",
          "border-radius": "var(--radius-md)",
          "font-size": "11px",
          "font-weight": "600",
          color: "var(--accent-primary)",
          "pointer-events": "none",
          "box-shadow": "0 4px 16px var(--shadow-color)",
          "white-space": "nowrap",
        }}>
          {dragLabel()}
        </div>
      </Show>

      {/* Actions */}
      <div style={{
        padding: "10px 12px",
        "border-top": "1px solid var(--border-color)",
        display: "flex",
        "flex-direction": "column",
        gap: "6px",
        "flex-shrink": "0",
      }}>
        <Show when={isEntityActive("task") && taskStore.sourceFilter() !== "all" && taskStore.sourceFilter() !== "manual"}>
          <Show when={taskStore.isConnectorConfigured(taskStore.sourceFilter())} fallback={
            <Button size="sm" variant="primary" onClick={() => openSettings("connectors")} style={{ width: "100%" }}>
              Configurer {taskStore.sourceFilter()}
            </Button>
          }>
            <Button size="sm" variant="secondary" onClick={() => taskStore.syncConnector(taskStore.sourceFilter() as string)} disabled={taskStore.isSyncing()} style={{ width: "100%" }}>
              <Show when={taskStore.isSyncing()} fallback={`Sync ${taskStore.sourceFilter()}`}>
                <CookieLoader size={14} /> Sync...
              </Show>
            </Button>
          </Show>
        </Show>

        <AiButton
          onClick={() => flux.fetchSuggestions(flux.activeEntityType() === "all" ? undefined : flux.activeEntityType() as FluxEntityType)}
          disabled={flux.suggestLoading()}
          size="sm"
          style={{ width: "100%" }}
        >{flux.suggestLoading() ? "..." : "IA Tri"}</AiButton>
      </div>
    </div>
  );
}
