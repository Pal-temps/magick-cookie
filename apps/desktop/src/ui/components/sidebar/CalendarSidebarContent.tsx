import type { JSX } from "solid-js";
import { Show, For, createSignal } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { useBookmarkStore } from "../../../application/stores/bookmarkStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { CalendarList } from "./CalendarList";
import { UnscheduledTasks } from "./UnscheduledTasks";
import { ContactManager } from "./ContactManager";
import { CollapsibleSection } from "../common/CollapsibleSection";
import { Button } from "../common/Button";
import { openUrl } from "@tauri-apps/plugin-opener";

const DEFAULT_ORDER = ["favoris", "filtres", "contacts", "taches"];

export function CalendarSidebarContent() {
  const { openCreateForm, contacts } = useCalendarStore();
  const { tasks: unscheduledTasks } = useTaskStore();
  const { favorites } = useBookmarkStore();
  const { setViewMode } = useViewStore();
  const settingsStore = useSettingsStore();

  const savedOrder = (() => {
    try {
      const stored = settingsStore.getSidebar().sectionOrder;
      if (stored.length > 0) {
        const allSections = new Set(DEFAULT_ORDER);
        const valid = stored.filter((s) => allSections.has(s));
        for (const s of DEFAULT_ORDER) { if (!valid.includes(s)) valid.push(s); }
        return valid;
      }
    } catch { /* ignore */ }
    return DEFAULT_ORDER;
  })();

  const [sectionOrder, setSectionOrder] = createSignal<string[]>(savedOrder);
  const [draggedSection, setDraggedSection] = createSignal<string | null>(null);
  const [dragOverSection, setDragOverSection] = createSignal<string | null>(null);

  function handleSectionPointerDown(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientY - rect.top > 36) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    let dragging = false;

    function onPointerMove(ev: PointerEvent) {
      if (!dragging) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) < 5) return;
        dragging = true;
        el.setPointerCapture(pointerId);
        setDraggedSection(id);
      }
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!target) { setDragOverSection(null); return; }
      const section = target.closest("[data-section-id]") as HTMLElement | null;
      if (section && section.dataset.sectionId !== id) {
        setDragOverSection(section.dataset.sectionId!);
      } else {
        setDragOverSection(null);
      }
    }

    function cleanup() {
      if (dragging) {
        const from = draggedSection();
        const target = dragOverSection();
        if (from && target && from !== target) {
          const order = [...sectionOrder()];
          const fromIdx = order.indexOf(from);
          const toIdx = order.indexOf(target);
          if (fromIdx !== -1 && toIdx !== -1) {
            order.splice(fromIdx, 1);
            order.splice(toIdx, 0, from);
            setSectionOrder(order);
            settingsStore.patchSidebar({ sectionOrder: order });
          }
        }
        setDraggedSection(null);
        setDragOverSection(null);
        try { el.releasePointerCapture(pointerId); } catch {}
      }
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", cleanup);
      el.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
    }

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", cleanup);
    el.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  }

  return (
    <>
      {/* Top actions */}
      <div style={{ padding: "10px 12px", display: "flex", gap: "6px" }}>
        <Button variant="primary" onClick={openCreateForm} style={{ flex: "1" }} size="sm">
          + Evenement
        </Button>
      </div>

      {/* Scrollable sections */}
      <div style={{
        flex: "1",
        "overflow-y": "auto",
        "border-top": "1px solid var(--border-color)",
      }}>
        <For each={sectionOrder()}>
          {(sectionId) => {
            const sectionWrap = (content: JSX.Element) => (
              <div
                data-section-id={sectionId}
                onPointerDown={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (e.clientY - rect.top > 36) return;
                  handleSectionPointerDown(e, sectionId);
                }}
                style={{
                  "border-top": dragOverSection() === sectionId ? "2px solid var(--accent-primary)" : "2px solid transparent",
                  opacity: draggedSection() === sectionId ? "0.4" : "1",
                  transition: "opacity 0.15s",
                  "touch-action": "none",
                }}
              >
                {content}
                <div style={{ height: "1px", background: "var(--border-color)" }} />
              </div>
            );

            if (sectionId === "favoris") {
              return (
                <Show when={favorites().length > 0}>
                  {sectionWrap(
                    <CollapsibleSection
                      title="Favoris"
                      defaultOpen={false}
                      badge={
                        <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                          {favorites().length}
                        </span>
                      }
                    >
                      <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
                        <For each={favorites()}>
                          {(bookmark) => (
                            <button
                              onClick={() => openUrl(bookmark.url)}
                              style={{ display: "flex", "align-items": "center", gap: "6px", padding: "4px 0", "font-size": "12px", color: "var(--text-primary)", cursor: "pointer", background: "none", border: "none", width: "100%", "text-align": "left" }}
                              title={bookmark.url}
                            >
                              <span style={{ "font-size": "13px" }}>{bookmark.emoji ?? "🔗"}</span>
                              <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{bookmark.name}</span>
                            </button>
                          )}
                        </For>
                        <button
                          onClick={() => setViewMode("library")}
                          style={{ display: "flex", "align-items": "center", gap: "6px", padding: "4px 0", "font-size": "11px", color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none", width: "100%", "text-align": "left", "margin-top": "4px" }}
                        >Gerer les signets...</button>
                      </div>
                    </CollapsibleSection>
                  )}
                </Show>
              );
            }

            if (sectionId === "filtres") {
              return sectionWrap(
                <CollapsibleSection title="Filtres" defaultOpen={false}>
                  <CalendarList />
                </CollapsibleSection>
              );
            }

            if (sectionId === "contacts") {
              return sectionWrap(
                <CollapsibleSection
                  title="Contacts"
                  defaultOpen={false}
                  badge={<span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>{contacts().length}</span>}
                >
                  <ContactManager />
                </CollapsibleSection>
              );
            }

            if (sectionId === "taches") {
              return sectionWrap(
                <CollapsibleSection
                  title="Taches sans date"
                  defaultOpen={false}
                  badge={<span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>{unscheduledTasks().length}</span>}
                >
                  <UnscheduledTasks />
                </CollapsibleSection>
              );
            }

            return null;
          }}
        </For>
      </div>
    </>
  );
}
