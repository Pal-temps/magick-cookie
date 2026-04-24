import { onMount, onCleanup, createEffect, createSignal, Show, For } from "solid-js";
import { useVpsStore } from "../../../application/stores/vpsStore";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import { useT } from "../../../i18n/context";

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
  const { t } = useT();
  const store = useVpsStore();
  const [alertsOpen, setAlertsOpen] = createSignal(true);
  const [loading, setLoading] = createSignal(true);
  const [showSseDialog, setShowSseDialog] = createSignal(false);
  const [sseName, setSseName] = createSignal("");
  const [sseUrl, setSseUrl] = createSignal("");
  const [sseEventsInput, setSseEventsInput] = createSignal("");

  function handleAddSseFlux() {
    const name = sseName().trim();
    const url = sseUrl().trim();
    if (!name || !url) return;
    const events = sseEventsInput().split(",").map((e) => e.trim()).filter(Boolean);
    const flux = store.addSseFlux(name, url, events);
    store.connectSseFlux(flux.id);
    setShowSseDialog(false);
    setSseName("");
    setSseUrl("");
    setSseEventsInput("");
  }

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
            {t("vps.monitoring")}
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
              {store.isConnected() ? t("vps.connected") : t("vps.disconnected")}
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
              {store.alertCount()} {store.alertCount() > 1 ? t("vps.alerts") : t("vps.alert")}
            </span>
          </Show>
          <Button size="sm" variant="secondary" onClick={store.flushLogs}>
            {t("vps.flush")}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Show when={!loading()} fallback={
        <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>
          <CookieLoader size={48} message={t("vps.loadingVps")} />
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
                {t("vps.services")}
              </span>
            </div>
            <Show when={store.health()?.services} fallback={
              <div style={{ padding: "4px 12px", "font-size": "11px", color: "var(--text-muted)" }}>
                {t("vps.noService")}
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
                {t("vps.files")}
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
            {/* SSE Flux section */}
            <div style={{ padding: "14px 12px 6px", display: "flex", "align-items": "center", "justify-content": "space-between" }}>
              <span style={{
                "font-size": "11px",
                "font-weight": "600",
                color: "var(--text-muted)",
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
              }}>
                Flux SSE
              </span>
              <button
                onClick={() => setShowSseDialog(true)}
                style={{
                  background: "none", border: "1px solid var(--border-color)", color: "var(--text-muted)",
                  "border-radius": "var(--radius-sm)", cursor: "pointer", "font-size": "12px",
                  width: "20px", height: "20px", display: "flex", "align-items": "center", "justify-content": "center",
                }}
                title="Ajouter un flux SSE"
              >+</button>
            </div>
            <For each={store.sseFluxList()}>
              {(flux) => (
                <div style={{
                  display: "flex", "align-items": "center", gap: "6px", padding: "4px 12px",
                  background: store.activeSseFluxId() === flux.id ? "var(--bg-elevated)" : "transparent",
                  cursor: "pointer",
                }} onClick={() => store.connectSseFlux(flux.id)}>
                  <span style={{
                    display: "inline-block", width: "6px", height: "6px", "border-radius": "50%",
                    background: store.activeSseFluxId() === flux.id && store.sseConnected() ? "#00b894" : "var(--text-muted)",
                    "flex-shrink": "0",
                  }} />
                  <span style={{
                    "font-size": "12px", color: store.activeSseFluxId() === flux.id ? "var(--text-primary)" : "var(--text-muted)",
                    "font-weight": store.activeSseFluxId() === flux.id ? "500" : "400",
                    flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap",
                  }}>{flux.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); store.removeSseFlux(flux.id); }}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", "font-size": "10px", padding: "0 2px", opacity: "0.5" }}
                    title="Supprimer"
                  >&times;</button>
                </div>
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
                {t("vps.logs")} ({store.selectedFile()})
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
                  {t("vps.noLog")}
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
                {t("vps.alerts")} ({(store.alerts() ?? []).length})
              </button>
              <Show when={alertsOpen()}>
                <div style={{ overflow: "auto", padding: "0 12px 8px", flex: "1" }}>
                  <Show when={(store.alerts() ?? []).length > 0} fallback={
                    <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 0" }}>
                      {t("vps.noAlert")}
                    </div>
                  }>
                    <For each={store.alerts() ?? []}>
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

      {/* SSE Events overlay when a flux is active */}
      <Show when={store.activeSseFluxId()}>
        <div style={{
          position: "absolute", bottom: "0", right: "0", width: "400px", "max-height": "300px",
          background: "var(--bg-surface)", border: "1px solid var(--border-color)",
          "border-radius": "var(--radius-md) 0 0 0", "box-shadow": "0 -4px 16px var(--shadow-color)",
          display: "flex", "flex-direction": "column", overflow: "hidden", "z-index": "10",
        }}>
          <div style={{
            display: "flex", "align-items": "center", "justify-content": "space-between",
            padding: "6px 10px", "border-bottom": "1px solid var(--border-color)", "flex-shrink": "0",
          }}>
            <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: "6px", height: "6px", "border-radius": "50%", background: store.sseConnected() ? "#00b894" : "#d63031" }} />
              <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary)" }}>
                {store.sseFluxList().find((f) => f.id === store.activeSseFluxId())?.name ?? "SSE"}
              </span>
              <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>({store.sseEvents().length})</span>
            </div>
            <button onClick={() => store.disconnectSseFlux()} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", "font-size": "16px" }}>&times;</button>
          </div>
          <div style={{
            flex: "1", overflow: "auto", padding: "4px 8px",
            "font-family": "'JetBrains Mono', monospace", "font-size": "10px", "line-height": "1.5",
          }}>
            <Show when={store.sseEvents().length > 0} fallback={
              <div style={{ padding: "12px", "text-align": "center", color: "var(--text-muted)", "font-size": "11px" }}>En attente d'events...</div>
            }>
              <For each={store.sseEvents()}>
                {(evt) => (
                  <div style={{ padding: "2px 0", "border-bottom": "1px solid color-mix(in srgb, var(--border-color) 30%, transparent)" }}>
                    <span style={{ color: "var(--text-muted)", "margin-right": "6px" }}>{formatTimestamp(evt.timestamp)}</span>
                    <span style={{ color: "var(--accent-primary)", "font-weight": "600", "margin-right": "6px" }}>{evt.type}</span>
                    <span style={{ color: "var(--text-secondary)", "word-break": "break-all" }}>{evt.data.slice(0, 200)}</span>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>

      {/* SSE Flux config dialog */}
      <Show when={showSseDialog()}>
        <div style={{ position: "fixed", inset: "0", background: "rgba(0,0,0,0.5)", display: "flex", "align-items": "center", "justify-content": "center", "z-index": "1000" }}
          onClick={() => setShowSseDialog(false)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", "border-radius": "12px", width: "400px", "max-width": "90vw", "box-shadow": "0 16px 48px rgba(0,0,0,0.4)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "14px 18px", "border-bottom": "1px solid var(--border-color)", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
              Nouveau flux SSE
              <button onClick={() => setShowSseDialog(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", "font-size": "18px", cursor: "pointer" }}>&times;</button>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", "flex-direction": "column", gap: "12px" }}>
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                <label style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)" }}>Nom</label>
                <input value={sseName()} onInput={(e) => setSseName(e.currentTarget.value)} placeholder="Mon serveur" style={{ padding: "6px 10px", background: "var(--bg-base)", border: "1px solid var(--border-color)", "border-radius": "6px", color: "var(--text-primary)", "font-size": "12px", outline: "none" }} />
              </div>
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                <label style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)" }}>URL SSE</label>
                <input value={sseUrl()} onInput={(e) => setSseUrl(e.currentTarget.value)} placeholder="https://mon-serveur.com/api/sse" style={{ padding: "6px 10px", background: "var(--bg-base)", border: "1px solid var(--border-color)", "border-radius": "6px", color: "var(--text-primary)", "font-size": "12px", outline: "none" }} />
              </div>
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                <label style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)" }}>Events (optionnel)</label>
                <input value={sseEventsInput()} onInput={(e) => setSseEventsInput(e.currentTarget.value)} placeholder="log, alert, deploy (virgules)" style={{ padding: "6px 10px", background: "var(--bg-base)", border: "1px solid var(--border-color)", "border-radius": "6px", color: "var(--text-primary)", "font-size": "12px", outline: "none" }} />
                <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>Noms d'events SSE separes par virgules. Vide = ecoute "message".</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", padding: "12px 18px", "border-top": "1px solid var(--border-color)" }}>
              <Button variant="primary" size="sm" onClick={handleAddSseFlux} disabled={!sseName().trim() || !sseUrl().trim()}>Connecter</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSseDialog(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
