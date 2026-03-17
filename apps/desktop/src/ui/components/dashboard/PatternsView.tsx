import { onMount, Show, For, createMemo } from "solid-js";
import { useAnalyticsStore } from "../../../application/stores/analyticsStore";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";

interface PatternsViewProps {
  onClose: () => void;
}

export function PatternsView(props: PatternsViewProps) {
  const { patterns, patternsLoading, fetchPatterns } = useAnalyticsStore();

  onMount(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    fetchPatterns(from, to);
  });

  const maxHourly = createMemo(() => {
    const p = patterns();
    if (!p) return 1;
    return Math.max(...p.hourlyDistribution.map(h => h.avgMinutes), 1);
  });

  const maxWeekday = createMemo(() => {
    const p = patterns();
    if (!p) return 1;
    return Math.max(...p.weekdayDistribution.map(d => d.avgMinutes), 1);
  });

  // Build heatmap data: 7 rows (days) x 24 cols (hours)
  // We approximate intensity from hourly + weekday distributions
  const heatmapData = createMemo(() => {
    const p = patterns();
    if (!p) return [];
    const maxH = Math.max(...p.hourlyDistribution.map(h => h.avgMinutes), 1);
    const maxD = Math.max(...p.weekdayDistribution.map(d => d.avgMinutes), 1);

    const rows: { day: string; cells: number[] }[] = [];
    for (let d = 0; d < 7; d++) {
      const dayAvg = p.weekdayDistribution[d].avgMinutes;
      const cells: number[] = [];
      for (let h = 0; h < 24; h++) {
        const hourAvg = p.hourlyDistribution[h].avgMinutes;
        // Combined intensity (geometric mean of normalized values)
        const norm = (hourAvg / maxH) * (dayAvg / maxD);
        cells.push(norm);
      }
      rows.push({ day: p.weekdayDistribution[d].dayName.slice(0, 3), cells });
    }
    return rows;
  });

  function intensityColor(value: number): string {
    if (value <= 0) return "var(--bg-elevated)";
    // Interpolate from bg-elevated to accent-primary via opacity
    const alpha = Math.min(1, Math.max(0.1, value));
    return `rgba(99, 102, 241, ${alpha})`;
  }

  const cardStyle = {
    background: "var(--bg-elevated)",
    "border-radius": "var(--radius-md)",
    padding: "16px",
  };

  return (
    <div style={{ padding: "24px", height: "100%", "overflow-y": "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
          Patterns de productivite
        </h2>
        <Button variant="ghost" size="sm" onClick={props.onClose}>Retour</Button>
      </div>

      <Show when={patternsLoading()}>
        <CookieLoader message="Chargement..." />
      </Show>

      <Show when={!patternsLoading() && patterns()}>
        {/* Best hours & days */}
        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "12px", "margin-bottom": "24px" }}>
          <div style={cardStyle}>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "8px" }}>Tes meilleures heures</div>
            <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
              {patterns()!.bestHours.length > 0
                ? patterns()!.bestHours.map(h => `${h}h`).join(", ")
                : "Pas assez de donnees"}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "8px" }}>Tes meilleurs jours</div>
            <div style={{ "font-size": "18px", "font-weight": "700", color: "var(--accent-primary)" }}>
              {patterns()!.bestDays.length > 0
                ? patterns()!.bestDays.join(", ")
                : "Pas assez de donnees"}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "8px" }}>Tendance</div>
            <Show when={patterns()!.weeklyTrend !== null} fallback={
              <div style={{ "font-size": "14px", color: "var(--text-muted)" }}>Pas de periode precedente</div>
            }>
              <div style={{
                "font-size": "22px",
                "font-weight": "700",
                color: patterns()!.weeklyTrend! >= 0 ? "#00b894" : "#d63031",
              }}>
                {patterns()!.weeklyTrend! >= 0 ? "\u2191" : "\u2193"} {Math.abs(patterns()!.weeklyTrend!)}%
              </div>
              <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>
                vs periode precedente
              </div>
            </Show>
          </div>
        </div>

        {/* Heatmap */}
        <div style={{ ...cardStyle, "margin-bottom": "24px" }}>
          <h3 style={{ margin: "0 0 12px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
            Heatmap d'activite
          </h3>
          {/* Hour labels */}
          <div style={{ display: "flex", "margin-left": "36px", "margin-bottom": "4px" }}>
            <For each={Array.from({ length: 24 }, (_, i) => i)}>
              {(h) => (
                <div style={{
                  flex: "1",
                  "text-align": "center",
                  "font-size": "8px",
                  color: "var(--text-muted)",
                }}>
                  {h % 3 === 0 ? `${h}h` : ""}
                </div>
              )}
            </For>
          </div>
          {/* Grid rows */}
          <For each={heatmapData()}>
            {(row) => (
              <div style={{ display: "flex", "align-items": "center", gap: "2px", "margin-bottom": "2px" }}>
                <div style={{ width: "32px", "font-size": "10px", color: "var(--text-muted)", "text-align": "right", "padding-right": "4px" }}>
                  {row.day}
                </div>
                <For each={row.cells}>
                  {(val) => (
                    <div style={{
                      flex: "1",
                      height: "16px",
                      "border-radius": "2px",
                      background: intensityColor(val),
                      transition: "background 0.2s",
                    }} />
                  )}
                </For>
              </div>
            )}
          </For>
          {/* Legend */}
          <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-top": "8px", "margin-left": "36px" }}>
            <span style={{ "font-size": "9px", color: "var(--text-muted)" }}>Moins</span>
            <For each={[0, 0.25, 0.5, 0.75, 1]}>
              {(val) => (
                <div style={{
                  width: "12px",
                  height: "12px",
                  "border-radius": "2px",
                  background: intensityColor(val),
                }} />
              )}
            </For>
            <span style={{ "font-size": "9px", color: "var(--text-muted)" }}>Plus</span>
          </div>
        </div>

        {/* Bar chart: Heures de focus */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 12px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
            Heures de focus
          </h3>
          <div style={{ display: "flex", gap: "1px", "align-items": "flex-end", height: "120px" }}>
            <For each={patterns()!.hourlyDistribution}>
              {(entry) => {
                const pct = () => Math.max(0, (entry.avgMinutes / maxHourly()) * 100);
                return (
                  <div style={{
                    flex: "1",
                    display: "flex",
                    "flex-direction": "column",
                    "align-items": "center",
                    height: "100%",
                    "justify-content": "flex-end",
                  }}>
                    <Show when={entry.avgMinutes > 0}>
                      <div style={{ "font-size": "7px", color: "var(--text-muted)", "margin-bottom": "2px" }}>
                        {entry.avgMinutes}
                      </div>
                    </Show>
                    <div style={{
                      width: "100%",
                      height: `${pct()}%`,
                      background: "var(--accent-primary)",
                      "border-radius": "2px 2px 0 0",
                      "min-height": entry.avgMinutes > 0 ? "2px" : "0",
                      transition: "height 0.3s ease",
                    }} />
                  </div>
                );
              }}
            </For>
          </div>
          {/* Hour labels */}
          <div style={{ display: "flex", gap: "1px", "margin-top": "4px" }}>
            <For each={patterns()!.hourlyDistribution}>
              {(entry) => (
                <div style={{
                  flex: "1",
                  "text-align": "center",
                  "font-size": "8px",
                  color: "var(--text-muted)",
                }}>
                  {entry.hour % 2 === 0 ? `${entry.hour}` : ""}
                </div>
              )}
            </For>
          </div>
          <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "8px", "text-align": "center" }}>
            Minutes de focus moyennes par heure (30 derniers jours)
          </div>
        </div>
      </Show>

      <Show when={!patternsLoading() && !patterns()}>
        <div style={{ color: "var(--text-muted)", "font-size": "13px", "text-align": "center", padding: "40px 0" }}>
          Aucune donnee disponible
        </div>
      </Show>
    </div>
  );
}
