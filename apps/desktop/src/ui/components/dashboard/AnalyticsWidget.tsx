import { createSignal, onMount, Show, For } from "solid-js";
import { useAnalyticsStore } from "../../../application/stores/analyticsStore";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m}min`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

type Period = "7d" | "30d";

export function AnalyticsWidget() {
  const { overview, analyticsLoading, fetchOverview } = useAnalyticsStore();
  const [period, setPeriod] = createSignal<Period>("7d");

  function getRange(p: Period) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (p === "7d" ? 6 : 29));
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  function load() {
    const r = getRange(period());
    fetchOverview(r.from, r.to);
  }

  onMount(load);

  function switchPeriod(p: Period) {
    setPeriod(p);
    const r = getRange(p);
    fetchOverview(r.from, r.to);
  }

  const cardStyle = {
    background: "var(--bg-elevated)",
    "border-radius": "var(--radius-md)",
    padding: "10px",
    "text-align": "center" as const,
  };

  return (
    <div>
      <div style={{ display: "flex", "justify-content": "flex-end", "margin-bottom": "8px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          <Button size="sm" variant={period() === "7d" ? "primary" : "secondary"} onClick={() => switchPeriod("7d")}>
            7j
          </Button>
          <Button size="sm" variant={period() === "30d" ? "primary" : "secondary"} onClick={() => switchPeriod("30d")}>
            30j
          </Button>
        </div>
      </div>

      <Show when={analyticsLoading()}>
        <CookieLoader size={32} message="Chargement..." />
      </Show>

      <Show when={!analyticsLoading() && overview()}>
        {(data) => (
          <>
            <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "8px", "margin-bottom": "12px" }}>
              <div style={cardStyle}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {formatDuration(data().focus.totalSeconds)}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>Focus</div>
              </div>
              <div style={cardStyle}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {data().focus.sessionCount}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>Sessions</div>
              </div>
              <div style={cardStyle}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {data().events.total}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>Evenements</div>
              </div>
            </div>

            <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "8px", "margin-bottom": "12px" }}>
              <div style={cardStyle}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {data().email.received}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>Emails</div>
              </div>
              <div style={cardStyle}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {data().triage?.totalTriaged ?? 0}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>Tries</div>
              </div>
              <div style={cardStyle}>
                <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
                  {data().dogWalk.totalWalks}
                </div>
                <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>Balades</div>
              </div>
            </div>

            {/* Mini bar chart for focus */}
            <Show when={data().focus.dailyStats.length > 0 && data().focus.totalSeconds > 0}>
              <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "6px" }}>Focus par jour</div>
              <div style={{ display: "flex", gap: "1px", "align-items": "flex-end", height: "60px" }}>
                <For each={data().focus.dailyStats}>
                  {(day) => {
                    const max = Math.max(...data().focus.dailyStats.map((d) => d.totalSeconds), 1);
                    const pct = () => Math.max(2, (day.totalSeconds / max) * 100);
                    return (
                      <div
                        title={`${dayLabel(day.date)}: ${formatDuration(day.totalSeconds)}`}
                        style={{
                          flex: "1",
                          height: `${pct()}%`,
                          background: "var(--accent-primary)",
                          "border-radius": "2px 2px 0 0",
                          "min-height": day.totalSeconds > 0 ? "2px" : "0",
                        }}
                      />
                    );
                  }}
                </For>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
