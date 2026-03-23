import { createSignal, Show } from "solid-js";
import type { FluxableItem, FluxStatus } from "../../../application/stores/fluxStore";

interface FluxSwipeCardProps {
  item: FluxableItem;
  onSwipe: (status: FluxStatus) => void;
}

const THRESHOLD = 80;

const DIRECTION_CONFIG: Record<string, { status: FluxStatus; label: string; color: string; icon: string }> = {
  right: { status: "priority", label: "Prioritaire", color: "#ef4444", icon: "!!!" },
  left: { status: "later", label: "Plus tard", color: "#3b82f6", icon: "..." },
  up: { status: "archived", label: "Archiver", color: "#8b5cf6", icon: "v" },
  down: { status: "dismissed", label: "Masquer", color: "#6b7280", icon: "x" },
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

function entityTypeIcon(type: string): string {
  switch (type) {
    case "task": return "T";
    case "email": return "@";
    case "rss_article": return "R";
    default: return "?";
  }
}

function entityTypeColor(type: string): string {
  switch (type) {
    case "task": return "var(--accent-primary)";
    case "email": return "#0984e3";
    case "rss_article": return "#00b894";
    default: return "var(--text-muted)";
  }
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => cleanupDrag()}
      onPointerCancel={() => cleanupDrag()}
      style={{
        position: "absolute",
        width: "380px",
        "min-height": "280px",
        background: "var(--bg-surface)",
        "border-radius": "16px",
        border: `2px solid ${config() ? config()!.color : "var(--border-color)"}`,
        "box-shadow": "0 8px 32px rgba(0,0,0,0.2)",
        cursor: isDragging() ? "grabbing" : "grab",
        "user-select": "none",
        "touch-action": "none",
        transform: `translate(${dragX()}px, ${dragY()}px) rotate(${dragX() * 0.05}deg)`,
        transition: isDragging() ? "none" : "transform 0.25s ease, border-color 0.15s, opacity 0.25s",
        opacity: isExiting() ? "0" : "1",
        padding: "24px",
        display: "flex",
        "flex-direction": "column",
        gap: "16px",
      }}
    >
      {/* Direction indicator overlay */}
      <Show when={config()}>
        <div style={{
          position: "absolute", top: "16px", left: "0", right: "0",
          "text-align": "center", "font-size": "16px", "font-weight": "700",
          color: config()!.color, opacity: String(getOpacity()),
          "pointer-events": "none", "text-transform": "uppercase", "letter-spacing": "2px",
        }}>
          {config()!.icon} {config()!.label}
        </div>
      </Show>

      {/* Content — adapts by entity type */}
      <div style={{ "margin-top": "16px" }}>
        {/* Entity type badge + priority/source */}
        <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "12px" }}>
          <span style={{
            "font-size": "10px", "font-weight": "700", padding: "2px 6px",
            "border-radius": "var(--radius-sm)", background: entityTypeColor(props.item.entityType),
            color: "#fff",
          }}>
            {entityTypeIcon(props.item.entityType)}
          </span>
          <Show when={props.item.priority}>
            <span style={{
              "font-size": "11px", padding: "2px 8px", "border-radius": "var(--radius-sm)",
              background: priorityColor(props.item.priority), color: "#fff", "font-weight": "600",
              "text-transform": "capitalize",
            }}>
              {props.item.priority}
            </span>
          </Show>
          <span style={{ "font-size": "11px", color: "var(--text-secondary)", "margin-left": "auto" }}>
            {props.item.source}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          "font-size": "18px", "font-weight": "600", color: "var(--text-primary)",
          "line-height": "1.3", "margin-bottom": "12px",
        }}>
          {props.item.title}
        </h3>

        {/* Preview text */}
        <Show when={props.item.preview}>
          <p style={{ "font-size": "13px", color: "var(--text-secondary)", "line-height": "1.5", "margin-bottom": "8px" }}>
            {props.item.preview}
          </p>
        </Show>

        {/* Labels (tasks) */}
        <Show when={props.item.labels && props.item.labels.length > 0}>
          <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
            {props.item.labels!.slice(0, 3).map((l) => (
              <span style={{
                "font-size": "10px", padding: "2px 6px", "border-radius": "var(--radius-sm)",
                background: "var(--bg-elevated)", color: "var(--text-secondary)",
              }}>{l}</span>
            ))}
          </div>
        </Show>

        {/* Timestamp */}
        <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "8px" }}>
          {new Date(props.item.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{
        "margin-top": "auto", "padding-top": "12px",
        "border-top": "1px solid var(--border-color)",
        display: "grid", "grid-template-columns": "1fr 1fr", gap: "4px",
        "font-size": "10px", color: "var(--text-muted)",
      }}>
        <span style={{ color: "#8b5cf6" }}>&#8593; Archiver</span>
        <span style={{ "text-align": "right", color: "#ef4444" }}>Prioritaire &#8594;</span>
        <span style={{ color: "#3b82f6" }}>&#8592; Plus tard</span>
        <span style={{ "text-align": "right", color: "#6b7280" }}>Masquer &#8595;</span>
      </div>
    </div>
  );
}
