import { Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { useAiActivityStore } from "../../../application/stores/aiActivityStore";

function formatElapsed(startedAt: number, now: number): string {
  const seconds = Math.floor((now - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

export function AiActivityIndicator() {
  const { activities } = useAiActivityStore();
  const [now, setNow] = createSignal(Date.now());

  let timer: ReturnType<typeof setInterval>;
  onMount(() => { timer = setInterval(() => setNow(Date.now()), 1000); });
  onCleanup(() => clearInterval(timer));

  return (
    <Show when={activities().length > 0}>
      <div style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        "z-index": "9999",
        display: "flex",
        "flex-direction": "column",
        gap: "6px",
        "max-width": "300px",
      }}>
        <For each={activities()}>
          {(activity) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "8px 12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-md)",
              "box-shadow": "0 4px 12px rgba(0,0,0,0.3)",
              "font-size": "12px",
              color: "var(--text-secondary)",
              animation: "ai-activity-in 0.2s ease-out",
            }}>
              <span class="ai-activity-spinner" />
              <span style={{ flex: "1", "min-width": "0", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {activity.label}
              </span>
              <span style={{ "font-size": "10px", color: "var(--text-muted)", "font-variant-numeric": "tabular-nums", "flex-shrink": "0" }}>
                {formatElapsed(activity.startedAt, now())}
              </span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
