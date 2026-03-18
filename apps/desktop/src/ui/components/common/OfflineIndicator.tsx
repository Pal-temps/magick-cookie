import { Show } from "solid-js";
import { useOfflineQueue } from "../../../infrastructure/offline/offlineQueue";

export function OfflineIndicator() {
  const { isOnline, isSyncing, queue } = useOfflineQueue();

  return (
    <>
      <Show when={!isOnline()}>
        <div style={{
          padding: "4px 12px",
          background: "rgba(255, 170, 0, 0.15)",
          "border-bottom": "1px solid rgba(255, 170, 0, 0.3)",
          "font-size": "12px",
          color: "var(--text-primary)",
          "text-align": "center",
          "flex-shrink": "0",
        }}>
          Mode hors-ligne
          <Show when={queue().length > 0}>
            {" "}&mdash; {queue().length} action{queue().length > 1 ? "s" : ""} en attente
          </Show>
        </div>
      </Show>
      <Show when={isOnline() && isSyncing()}>
        <div style={{
          padding: "4px 12px",
          background: "rgba(0, 170, 255, 0.1)",
          "border-bottom": "1px solid rgba(0, 170, 255, 0.2)",
          "font-size": "12px",
          color: "var(--text-primary)",
          "text-align": "center",
          "flex-shrink": "0",
        }}>
          Synchronisation...
        </div>
      </Show>
    </>
  );
}
