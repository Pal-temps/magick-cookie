import { onMount, onCleanup, createEffect, createSignal, Show, For } from "solid-js";
import { useVpsStore } from "../../../application/stores/vpsStore";
import type { VpsLogLine, VpsAlert } from "../../../application/stores/vpsStore";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";

const LEVEL_COLORS: Record<string, string> = {
  ERROR: "#d63031",
  CRITICAL: "#d63031",
  WARNING: "#fdcb6e",
};

const LEVELS = ["ALL", "ERROR", "WARNING", "INFO", "DEBUG"] as const;

function logLineColor(level: string): string {
  if (level === "ERROR" || level === "CRITICAL") return "#d63031";
  if (level === "WARNING") return "#fdcb6e";
  if (level === "DEBUG") return "var(--text-muted)";
  return "var(--text-primary)";
}

function severityColor(severity: string): string {
  if (severity === "error") return "#d63031";
  if (severity === "warning") return "#fdcb6e";
  return "var(--text-muted)";
}

function statusDotColor(status: string): string {
  if (status === "up") return "#00b894";
  if (status === "down") return "#d63031";
  return "#fdcb6e";
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

export function VpsView() {
  const store = useVpsStore();
  const [alertsOpen, setAlertsOpen] = createSignal(true);
  const [loading, setLoading] = createSignal(true);

  let logEndRef: HTMLDivElement | undefined;

  // Auto-scroll to bottom when new log lines arrive
  createEffect(() => {
    store.logs();
    logEndRef?.scrollIntoView({ behavior: "smooth" });
  });

  // Reconnect SSE when selectedFile or levelFilter changes
  createEffect(() => {
    store.selectedFile();
    store.levelFilter();
    store.connect();
  });

  onMount(() => {
    store.connect();
    Promise.all([
      store.fetchHealth(),
      store.fetchLogFiles(),
      store.fetchAlerts(),
    ]).finally(() => setLoading(false));
  });

  onCleanup(() => {
    store.disconnect();
  });

  function handleFileClick(name: string) {
    store.setSelectedFile(name);
    store.fetchLogs(name);
  }

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "8px 14px",
        "border-bottom": "1px solid var(--border-color)",
        "flex-shrink": "0",
      }}>
        <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
          <span style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
            VPS Monitoring
          </span>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <span style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              "border-radius": "50%",
              background: store.isConnected() ? "#00b894" : "#d63031",
            }} />
            <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
              {store.isConnected() ? "Connecté" : "Déconnecté"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
          <Show when={store.alertCount() > 0}>
            <span
              onClick={() => { setAlertsOpen(true); store.clearAlertCount(); }}
              style={{
                "font-size": "10px",
                background: "#d63031",
                color: "white",
                padding: "1px 6px",
                "border-radius": "8px",
                cursor: "pointer",
              }}
            >
              {store.alertCount()} alerte{store.alertCount() > 1 ? "s" : ""}
            </span>
          </Show>
          <Button size="sm" variant="secondary" onClick={store.flushLogs}>
            Flush
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Show when={!loading()} fallback={
        <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>
          <CookieLoader size={48} message="Chargement VPS..." />
        </div>
      }>
        <div style={{ flex: "1", display: "flex", overflow: "hidden" }}>
          {/* Left sidebar */}
          <div style={{
            width: "200px",
            "flex-shrink": "0",
            "border-right": "1px solid var(--border-color)",
            overflow: "auto",
            display: "flex",
            "flex-direction": "column",
          }}>
            {/* Services section */}
            <div style={{ padding: "10px 12px 6px" }}>
              <span style={{
                "font-size": "11px",
                "font-weight": "600",
                color: "var(--text-muted)",
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
              }}>
                Services
              </span>
            </div>
            <Show when={store.health()?.services} fallback={
              <div style={{ padding: "4px 12px", "font-size": "11px", color: "var(--text-muted)" }}>
                Aucun service
              </div>
            }>
              <For each={store.health()!.services}>
                {(svc) => (
                  <div style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "4px 12px",
                  }}>
                    <span style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      "border-radius": "50%",
                      background: statusDotColor(svc.status),
                      "flex-shrink": "0",
                    }} />
                    <div style={{ "min-width": "0" }}>
                      <div style={{ "font-size": "12px", color: "var(--text-primary)" }}>
                        {svc.name}
                      </div>
                      <Show when={svc.details}>
                        <div style={{ "font-size": "10px", color: "var(--text-muted)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                          {svc.details}
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </Show>

            {/* Files section */}
            <div style={{ padding: "14px 12px 6px" }}>
              <span style={{
                "font-size": "11px",
                "font-weight": "600",
                color: "var(--text-muted)",
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
              }}>
                Fichiers
              </span>
            </div>
            <For each={store.logFiles()}>
              {(file) => (
                <button
                  onClick={() => handleFileClick(file.name)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "5px 12px",
                    border: "none",
                    background: store.selectedFile() === file.name ? "var(--bg-elevated)" : "transparent",
                    color: store.selectedFile() === file.name ? "var(--text-primary)" : "var(--text-muted)",
                    "font-size": "12px",
                    "text-align": "left",
                    cursor: "pointer",
                    "font-weight": store.selectedFile() === file.name ? "500" : "400",
                    "white-space": "nowrap",
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                  }}
                >
                  {file.name}
                  <span style={{ "font-size": "10px", color: "var(--text-muted)", "margin-left": "6px" }}>
                    {file.size_human}
                  </span>
                </button>
              )}
            </For>
          </div>

          {/* Main area */}
          <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
            {/* Log toolbar */}
            <div style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "6px 12px",
              "border-bottom": "1px solid var(--border-color)",
              "flex-shrink": "0",
            }}>
              <span style={{ "font-size": "12px", color: "var(--text-primary)", "font-weight": "500" }}>
                Logs ({store.selectedFile()})
              </span>
              <select
                value={store.levelFilter()}
                onChange={(e) => store.setLevelFilter(e.currentTarget.value)}
                style={{
                  "font-size": "11px",
                  padding: "3px 8px",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  "border-radius": "var(--radius-md)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <For each={LEVELS}>
                  {(level) => <option value={level}>{level}</option>}
                </For>
              </select>
            </div>

            {/* Log lines */}
            <div style={{
              flex: "1",
              overflow: "auto",
              padding: "6px 12px",
              "font-family": "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              "font-size": "11px",
              "line-height": "1.6",
            }}>
              <Show when={store.logs().length > 0} fallback={
                <div style={{ padding: "20px 0", color: "var(--text-muted)", "font-size": "12px", "text-align": "center", "font-family": "inherit" }}>
                  Aucun log à afficher
                </div>
              }>
                <For each={store.logs()}>
                  {(logLine) => (
                    <div style={{
                      color: logLineColor(logLine.level),
                      "white-space": "pre-wrap",
                      "word-break": "break-all",
                      padding: "1px 0",
                    }}>
                      <Show when={logLine.timestamp}>
                        <span style={{ color: "var(--text-muted)", "margin-right": "8px" }}>
                          {formatTimestamp(logLine.timestamp)}
                        </span>
                      </Show>
                      <span style={{
                        "font-weight": "600",
                        "margin-right": "6px",
                        color: LEVEL_COLORS[logLine.level] ?? "var(--text-muted)",
                      }}>
                        {logLine.level.padEnd(8)}
                      </span>
                      {logLine.line}
                    </div>
                  )}
                </For>
              </Show>
              <div ref={logEndRef} />
            </div>

            {/* Alerts section (collapsible) */}
            <div style={{
              "border-top": "1px solid var(--border-color)",
              "flex-shrink": "0",
              "max-height": alertsOpen() ? "200px" : "32px",
              transition: "max-height 0.2s ease",
              overflow: "hidden",
              display: "flex",
              "flex-direction": "column",
            }}>
              <button
                onClick={() => { setAlertsOpen((v) => !v); store.clearAlertCount(); }}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  "text-align": "left",
                  "font-size": "11px",
                  "font-weight": "600",
                  color: "var(--text-muted)",
                  "text-transform": "uppercase",
                  "letter-spacing": "0.5px",
                  cursor: "pointer",
                  "flex-shrink": "0",
                }}
              >
                <span style={{
                  "font-size": "9px",
                  transition: "transform 0.15s",
                  transform: alertsOpen() ? "rotate(90deg)" : "rotate(0deg)",
                }}>
                  &#9654;
                </span>
                Alertes ({store.alerts().length})
              </button>
              <Show when={alertsOpen()}>
                <div style={{ overflow: "auto", padding: "0 12px 8px", flex: "1" }}>
                  <Show when={store.alerts().length > 0} fallback={
                    <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 0" }}>
                      Aucune alerte
                    </div>
                  }>
                    <For each={store.alerts()}>
                      {(alert) => (
                        <div style={{
                          display: "flex",
                          "align-items": "flex-start",
                          gap: "8px",
                          padding: "4px 0",
                          "border-bottom": "1px solid var(--border-color)",
                        }}>
                          <span style={{
                            display: "inline-block",
                            width: "6px",
                            height: "6px",
                            "border-radius": "50%",
                            background: severityColor(alert.severity),
                            "margin-top": "5px",
                            "flex-shrink": "0",
                          }} />
                          <div style={{ "min-width": "0", flex: "1" }}>
                            <div style={{
                              "font-size": "12px",
                              color: severityColor(alert.severity),
                            }}>
                              {alert.message}
                            </div>
                            <div style={{ "font-size": "10px", color: "var(--text-muted)" }}>
                              {alert.kind} — {formatTimestamp(alert.timestamp)}
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
