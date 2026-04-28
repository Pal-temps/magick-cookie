import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import {
  aiActivityService,
  type AiActivityStats,
  type AiToolCall,
  type ToolCallStatus,
} from "../../../application/services/aiActivityService";

const STATUS_COLORS: Record<ToolCallStatus, string> = {
  ok: "var(--success, #2ecc71)",
  error: "var(--danger, #e74c3c)",
  denied: "#f39c12",
  invalid_input: "#9b59b6",
  rate_limited: "#34495e",
};

const REFRESH_INTERVAL_MS = 30_000;

export function AiActivitySettings() {
  const { t } = useT();
  const [stats, setStats] = createSignal<AiActivityStats | null>(null);
  const [recent, setRecent] = createSignal<AiToolCall[]>([]);
  const [statusFilter, setStatusFilter] = createSignal<ToolCallStatus | "">("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const [s, list] = await Promise.all([
        aiActivityService.getStats(),
        aiActivityService.list({
          status: (statusFilter() || undefined) as ToolCallStatus | undefined,
          limit: 50,
        }),
      ]);
      setStats(s);
      setRecent(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    void refresh();
    intervalId = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  function formatDuration(ms: number | null): string {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString();
  }

  const headingStyle = { margin: "0 0 4px", "font-size": "20px", "font-weight": "600" as const, color: "var(--text-primary)" };
  const subStyle = { margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" };
  const cardStyle = {
    background: "var(--bg-elevated)",
    "border-radius": "var(--radius-md)",
    padding: "16px",
    "margin-bottom": "16px",
  };
  const metricStyle = {
    "font-size": "11px",
    color: "var(--text-muted)",
    "text-transform": "uppercase" as const,
    "letter-spacing": "0.05em",
  };

  return (
    <div style={{ padding: "24px 32px", "max-width": "880px" }}>
      <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "8px" }}>
        <h2 style={headingStyle}>{t("settings.aiActivityTitle")}</h2>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          {t("common.refresh")}
        </Button>
      </div>
      <p style={subStyle}>{t("settings.aiActivityDesc")}</p>

      <Show when={error()}>
        <div style={{ padding: "12px", background: "rgba(231,76,60,0.1)", color: "var(--danger, #e74c3c)", "border-radius": "var(--radius-md)", "margin-bottom": "16px", "font-size": "12px" }}>
          {error()}
        </div>
      </Show>

      <Show when={loading() && !stats()}>
        <p style={{ color: "var(--text-muted)" }}>{t("common.loading")}</p>
      </Show>

      <Show when={stats()}>
        {/* Summary cards */}
        <div style={{ display: "grid", "grid-template-columns": "repeat(4, 1fr)", gap: "12px", "margin-bottom": "24px" }}>
          <div style={cardStyle}>
            <div style={metricStyle}>{t("settings.aiActivityTotal")}</div>
            <div style={{ "font-size": "24px", "font-weight": "600", color: "var(--text-primary)" }}>{stats()!.totalCalls}</div>
          </div>
          <div style={cardStyle}>
            <div style={metricStyle}>{t("settings.aiActivitySuccess")}</div>
            <div style={{ "font-size": "24px", "font-weight": "600", color: "var(--success, #2ecc71)" }}>{stats()!.byStatus.ok}</div>
          </div>
          <div style={cardStyle}>
            <div style={metricStyle}>{t("settings.aiActivityErrors")}</div>
            <div style={{ "font-size": "24px", "font-weight": "600", color: "var(--danger, #e74c3c)" }}>
              {stats()!.byStatus.error + stats()!.byStatus.denied + stats()!.byStatus.invalid_input + stats()!.byStatus.rate_limited}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={metricStyle}>{t("settings.aiActivityAvgLatency")}</div>
            <div style={{ "font-size": "24px", "font-weight": "600", color: "var(--text-primary)" }}>{formatDuration(stats()!.avgDurationMs)}</div>
          </div>
        </div>

        {/* Top tools */}
        <Show when={stats()!.byTool.length > 0}>
          <div style={cardStyle}>
            <div style={{ ...metricStyle, "margin-bottom": "12px" }}>{t("settings.aiActivityTopTools")}</div>
            <For each={stats()!.byTool.slice(0, 10)}>
              {(t) => (
                <div style={{ display: "flex", "justify-content": "space-between", padding: "4px 0", "font-size": "12px" }}>
                  <span style={{ "font-family": "monospace", color: "var(--text-primary)" }}>{t.toolName}</span>
                  <span style={{ color: "var(--text-muted)" }}>{t.count}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* Filter + recent calls */}
      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "12px" }}>
        <label style={{ "font-size": "12px", color: "var(--text-muted)" }}>{t("settings.aiActivityFilterStatus")}</label>
        <select
          value={statusFilter()}
          onChange={(e) => {
            setStatusFilter(e.currentTarget.value as ToolCallStatus | "");
            void refresh();
          }}
          style={{
            padding: "4px 8px",
            "border-radius": "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            "font-size": "12px",
          }}
        >
          <option value="">{t("common.all")}</option>
          <option value="ok">ok</option>
          <option value="error">error</option>
          <option value="denied">denied</option>
          <option value="invalid_input">invalid_input</option>
          <option value="rate_limited">rate_limited</option>
        </select>
      </div>

      <div style={cardStyle}>
        <div style={{ ...metricStyle, "margin-bottom": "12px" }}>
          {t("settings.aiActivityRecent")} ({recent().length})
        </div>
        <Show when={recent().length > 0} fallback={<p style={{ color: "var(--text-muted)", "font-size": "12px" }}>{t("settings.aiActivityEmpty")}</p>}>
          <For each={recent()}>
            {(call) => (
              <div style={{ display: "flex", "align-items": "center", gap: "12px", padding: "8px 0", "border-bottom": "1px solid var(--border-color)" }}>
                <span style={{ width: "8px", height: "8px", "border-radius": "50%", background: STATUS_COLORS[call.status], "flex-shrink": "0" }} />
                <span style={{ "font-family": "monospace", "font-size": "12px", color: "var(--text-primary)", "min-width": "180px" }}>{call.toolName}</span>
                <span style={{ "font-size": "11px", color: "var(--text-muted)", "min-width": "70px" }}>{call.status}</span>
                <span style={{ "font-size": "11px", color: "var(--text-muted)", "min-width": "60px" }}>{formatDuration(call.durationMs)}</span>
                <span style={{ "font-size": "11px", color: "var(--text-muted)", "margin-left": "auto" }}>{formatDate(call.createdAt)}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
