import { createSignal, createEffect, on, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { FluxKanbanItem, FluxStatus } from "../../../application/stores/fluxStore";

export interface VirtualKanbanColumnProps {
  items: FluxKanbanItem[];
  total: number;
  status: FluxStatus | "undecided";
  color: string;
  title: string;
  isDropTarget?: boolean;
  onItemOpen: (item: FluxKanbanItem) => void;
  onItemPointerDown: (item: FluxKanbanItem, e: PointerEvent) => void;
  onLoadMore: () => void;
}

const ITEM_HEIGHT = 64;
const OVERSCAN = 5;
const LOAD_MORE_THRESHOLD = 200; // px from bottom

function entityTypeClass(type: string): string {
  if (type === "task") return "taskjar-card-type taskjar-card-type--task";
  if (type === "email") return "taskjar-card-type taskjar-card-type--email";
  return "taskjar-card-type taskjar-card-type--rss";
}

function entityTypeLabel(type: string): string {
  if (type === "task") return "T";
  if (type === "email") return "@";
  return "R";
}

export function VirtualKanbanColumn(props: VirtualKanbanColumnProps) {
  let scrollRef!: HTMLDivElement;
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);

  const virtualizer = createVirtualizer({
    get count() { return props.items.length; },
    getScrollElement: () => scrollRef,
    estimateSize: () => ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  function handleScroll() {
    if (!scrollRef) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (
      distanceFromBottom < LOAD_MORE_THRESHOLD &&
      props.items.length < props.total &&
      !isLoadingMore()
    ) {
      setIsLoadingMore(true);
      props.onLoadMore();
      // Reset loading flag after a short delay to avoid rapid re-triggers
      setTimeout(() => setIsLoadingMore(false), 1000);
    }
  }

  // Reset loading state when items change (new data arrived)
  createEffect(on(() => props.items.length, () => {
    setIsLoadingMore(false);
  }));

  return (
    <div
      data-flux-status={props.status}
      class={`taskjar-column ${props.isDropTarget ? "taskjar-column--drop" : ""}`}
    >
      <div class="taskjar-column-header">
        <div class="taskjar-column-dot" style={{ background: props.color }} />
        <span class="taskjar-column-name">{props.title}</span>
        <span class="taskjar-column-count">{props.total}</span>
      </div>

      <div
        ref={scrollRef}
        class="taskjar-column-items"
        onScroll={handleScroll}
      >
        <Show when={props.items.length > 0} fallback={
          <div class="taskjar-empty">Vide</div>
        }>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((vItem) => {
              const item = props.items[vItem.index];
              if (!item) return null;
              return (
                <div
                  data-index={vItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  <div
                    class="taskjar-card"
                    onPointerDown={(e) => props.onItemPointerDown(item, e)}
                  >
                    <div class="taskjar-card-meta">
                      <span class={entityTypeClass(item.entityType)}>
                        {entityTypeLabel(item.entityType)}
                      </span>
                      <span class="taskjar-card-source">{item.source}</span>
                    </div>
                    <div
                      class="taskjar-card-title taskjar-card-title--link"
                      onClick={(e) => { e.stopPropagation(); props.onItemOpen(item); }}
                    >
                      {item.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Show>
      </div>
    </div>
  );
}
