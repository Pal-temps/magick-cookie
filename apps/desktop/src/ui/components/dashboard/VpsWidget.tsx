import { onMount, Show } from "solid-js";
import { useVpsStore } from "../../../application/stores/vpsStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { Button } from "../common/Button";

export function VpsWidget() {
  const { health, alertCount, isConnected, fetchHealth, clearAlertCount } = useVpsStore();
  const { setViewMode } = useViewStore();

  onMount(() => { fetchHealth(); });

  // Overall status: red if any service down, orange if degraded or alerts, green if all good
  const overallStatus = () => {
    const h = health();
    if (!h) return "unknown";
    if (h.services.some(s => s.status === "down")) return "down";
    if (h.services.some(s => s.status === "degraded") || alertCount() > 0) return "degraded";
    return "up";
  };

  const statusColor = () => {
    switch (overallStatus()) {
      case "up": return "#00b894";
      case "degraded": return "#fdcb6e";
      case "down": return "#d63031";
      default: return "var(--text-muted)";
    }
  };

  function openVps() {
    clearAlertCount();
    setViewMode("vps");
  }

  return (
    <div>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "8px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", "border-radius": "50%", background: statusColor(), display: "inline-block" }} />
          <Show when={alertCount() > 0}>
            <span style={{
              "font-size": "11px", "font-weight": "600", background: "#d63031", color: "white",
              padding: "1px 7px", "border-radius": "10px", "min-width": "18px", "text-align": "center",
            }}>
              {alertCount()}
            </span>
          </Show>
        </div>
        <Button size="sm" variant="secondary" onClick={openVps}>Ouvrir</Button>
      </div>

      <Show when={!health()}>
        <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "12px 0" }}>
          {isConnected() ? "Chargement..." : "VPS non connecte"}
        </div>
      </Show>

      <Show when={health()}>
        {(h) => (
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            {h().services.map((svc) => (
              <div style={{
                display: "flex", "align-items": "center", gap: "8px",
                padding: "4px 8px", "border-radius": "var(--radius-md)", background: "var(--bg-elevated)",
              }}>
                <span style={{
                  width: "6px", height: "6px", "border-radius": "50%",
                  background: svc.status === "up" ? "#00b894" : svc.status === "degraded" ? "#fdcb6e" : "#d63031",
                }} />
                <span style={{ "font-size": "12px", color: "var(--text-primary)", flex: "1" }}>{svc.name}</span>
                <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>{svc.status}</span>
              </div>
            ))}
          </div>
        )}
      </Show>
    </div>
  );
}
