import { createSignal, Show } from "solid-js";
import type { FluxableItem, FluxStatus } from "../../../application/stores/fluxStore";
import "../../styles/taskjar.css";

interface FluxSwipeCardProps {
  item: FluxableItem;
  onSwipe: (status: FluxStatus) => void;
}

const THRESHOLD = 80;

const DIRECTION_CONFIG: Record<string, { status: FluxStatus; label: string; color: string }> = {
  right: { status: "priority", label: "Prioritaire", color: "#f87171" },
  left: { status: "later", label: "Plus tard", color: "#60a5fa" },
  up: { status: "archived", label: "Archiver", color: "#a78bfa" },
  down: { status: "dismissed", label: "Masquer", color: "#6b7280" },
};

function priorityColor(priority: string | null | undefined): string {
  switch (priority) {
    case "urgent": return "#ef4444";
    case "high": return "#f97316";
    case "normal": return "#3b82f6";
    case "low": return "#9ca3af";
    default: return "var(--text-muted)";
  }
}

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

export function FluxSwipeCard(props: FluxSwipeCardProps) {
  const [dragX, setDragX] = createSignal(0);
  const [dragY, setDragY] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isExiting, setIsExiting] = createSignal(false);
  let startX = 0;
  let startY = 0;
  let activePointerId: number | null = null;
  let activeTarget: HTMLElement | null = null;

  function getDirection(): string | null {
    const x = dragX();
    const y = dragY();
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    if (absX < THRESHOLD && absY < THRESHOLD) return null;
    if (absX > absY) return x > 0 ? "right" : "left";
    return y < 0 ? "up" : "down";
  }

  function getOpacity(): number {
    const dist = Math.max(Math.abs(dragX()), Math.abs(dragY()));
    return Math.min(1, dist / THRESHOLD);
  }

  function cleanupDrag() {
    if (!isDragging() || isExiting()) return;
    setIsDragging(false);

    if (activeTarget && activePointerId !== null) {
      try { activeTarget.releasePointerCapture(activePointerId); } catch {}
    }
    window.removeEventListener("blur", cleanupDrag);
    activePointerId = null;
    activeTarget = null;

    const dir = getDirection();
    if (dir) {
      setIsExiting(true);
      setDragX(dragX() * 3);
      setDragY(dragY() * 3);
      setTimeout(() => {
        props.onSwipe(DIRECTION_CONFIG[dir].status);
        setDragX(0);
        setDragY(0);
        setIsExiting(false);
      }, 250);
    } else {
      setDragX(0);
      setDragY(0);
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (isExiting()) return;
    const target = e.currentTarget as HTMLElement;
    activePointerId = e.pointerId;
    activeTarget = target;
    target.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    setIsDragging(true);
    window.addEventListener("blur", cleanupDrag);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging() || isExiting()) return;
    setDragX(e.clientX - startX);
    setDragY(e.clientY - startY);
  }

  const dir = () => getDirection();
  const config = () => dir() ? DIRECTION_CONFIG[dir()!] : null;

  return (
    <div
      class={`taskjar-scard ${isDragging() ? "taskjar-scard--dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => cleanupDrag()}
      onPointerCancel={() => cleanupDrag()}
      style={{
        transform: `translate(${dragX()}px, ${dragY()}px) rotate(${dragX() * 0.05}deg)`,
        "border-color": config() ? config()!.color : undefined,
        opacity: isExiting() ? "0" : "1",
        cursor: isDragging() ? "grabbing" : "grab",
      }}
    >
      {/* Direction indicator */}
      <Show when={config()}>
        <div
          class="taskjar-scard-indicator"
          style={{ color: config()!.color, opacity: String(getOpacity()) }}
        >
          {config()!.label}
        </div>
      </Show>

      {/* Content */}
      <div class="taskjar-scard-body">
        <div class="taskjar-scard-meta">
          <span class={entityTypeClass(props.item.entityType)}>
            {entityTypeLabel(props.item.entityType)}
          </span>
          <Show when={props.item.priority}>
            <span
              class="taskjar-scard-priority"
              style={{ background: priorityColor(props.item.priority) }}
            >
              {props.item.priority}
            </span>
          </Show>
          <span class="taskjar-scard-source">{props.item.source}</span>
        </div>

        <h3 class="taskjar-scard-title">{props.item.title}</h3>

        <Show when={props.item.preview}>
          <p class="taskjar-scard-preview">{props.item.preview}</p>
        </Show>

        <Show when={props.item.labels && props.item.labels.length > 0}>
          <div class="taskjar-scard-labels">
            {props.item.labels!.slice(0, 3).map((l) => (
              <span class="taskjar-scard-label">{l}</span>
            ))}
          </div>
        </Show>

        <div class="taskjar-scard-date">
          {new Date(props.item.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>

      {/* Bottom hints */}
      <div class="taskjar-scard-hints">
        <span style={{ color: "#a78bfa" }}>&#8593; Archiver</span>
        <span style={{ "text-align": "right", color: "#f87171" }}>Prioritaire &#8594;</span>
        <span style={{ color: "#60a5fa" }}>&#8592; Plus tard</span>
        <span style={{ "text-align": "right", color: "#6b7280" }}>Masquer &#8595;</span>
      </div>
    </div>
  );
}
