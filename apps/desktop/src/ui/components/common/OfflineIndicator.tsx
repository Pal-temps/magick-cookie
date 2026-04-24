import { Show } from "solid-js";
import { useOfflineQueue } from "../../../infrastructure/offline/offlineQueue";
import { useT } from "../../../i18n/context";

export function OfflineIndicator() {
  const { isOnline, isSyncing, queue } = useOfflineQueue();
  const { t } = useT();

  return (
    <>
      <Show when={!isOnline()}>
        <div role="status" aria-live="polite" style={{
          padding: "4px 12px",
          background: "rgba(255, 170, 0, 0.15)",
          "border-bottom": "1px solid rgba(255, 170, 0, 0.3)",
          "font-size": "12px",
          color: "var(--text-primary)",
          "text-align": "center",
          "flex-shrink": "0",
        }}>
          {t("common.offlineMode")}
          <Show when={queue().length > 0}>
            {" "}&mdash; {queue().length} {queue().length > 1 ? t("common.actionsPending") : t("common.actionPending")}
          </Show>
        </div>
      </Show>
      <Show when={isOnline() && isSyncing()}>
        <div role="status" aria-live="polite" style={{
          padding: "4px 12px",
          background: "rgba(0, 170, 255, 0.1)",
          "border-bottom": "1px solid rgba(0, 170, 255, 0.2)",
          "font-size": "12px",
          color: "var(--text-primary)",
          "text-align": "center",
          "flex-shrink": "0",
        }}>
          {t("common.syncing")}
        </div>
      </Show>
    </>
  );
}
