import { createSignal, Show } from "solid-js";
import { useVpsStore } from "../../../application/stores/vpsStore";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { Button } from "../common/Button";

export function VpsSettings() {
  const { health, isConnected, fetchHealth } = useVpsStore();
  const settings = useSettingsStore();
  const [testing, setTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<boolean | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = createSignal(
    settings.getVps().notificationsEnabled
  );

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      await fetchHealth();
      setTestResult(health() !== null);
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  }

  function toggleNotifications() {
    const next = !notificationsEnabled();
    setNotificationsEnabled(next);
    settings.patchVps({ notificationsEnabled: next });
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "13px",
    "box-sizing": "border-box" as const,
  };

  const labelStyle = {
    "font-size": "12px",
    "font-weight": "500" as const,
    color: "var(--text-muted)",
    "margin-bottom": "4px",
    display: "block",
  };

  const sectionStyle = {
    "margin-bottom": "24px",
  };

  const helpStyle = {
    "font-size": "11px",
    color: "var(--text-muted)",
    "margin-top": "4px",
  };

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>VPS Monitoring</h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        Configurez la connexion au serveur VPS pour le monitoring en temps reel.
      </p>

      {/* Connection status */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Statut</label>
        <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "8px 0" }}>
          <span style={{ width: "8px", height: "8px", "border-radius": "50%", background: isConnected() ? "#00b894" : "#d63031" }} />
          <span style={{ "font-size": "13px", color: "var(--text-primary)" }}>
            {isConnected() ? "Connecte" : "Deconnecte"}
          </span>
        </div>
        <div style={helpStyle}>
          L'URL et le token du VPS sont configures cote serveur (variables d'environnement VPS_API_URL et VPS_API_TOKEN).
        </div>
      </div>

      {/* Notifications toggle */}
      <div style={sectionStyle}>
        <label style={{ ...labelStyle, display: "flex", "align-items": "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={notificationsEnabled()} onChange={toggleNotifications} />
          Notifications systeme
        </label>
        <div style={helpStyle}>Recevez une notification quand une alerte critique est detectee.</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
        <Button variant="primary" size="sm" onClick={handleTest} disabled={testing()}>
          {testing() ? "..." : "Tester la connexion"}
        </Button>
        <Show when={testResult() !== null}>
          <span style={{ "font-size": "12px", color: testResult() ? "#00b894" : "#d63031", "margin-left": "8px" }}>
            {testResult() ? "Connexion OK" : "Echec de connexion"}
          </span>
        </Show>
      </div>

      {/* Health status */}
      <Show when={health()}>
        {(h) => (
          <div style={{ "margin-top": "24px", padding: "12px 14px", background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", "font-size": "12px", color: "var(--text-muted)" }}>
            <div style={{ "font-weight": "500", color: "var(--text-primary)", "margin-bottom": "6px" }}>Services</div>
            {h().services.map(s => (
              <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "2px" }}>
                <span style={{ width: "6px", height: "6px", "border-radius": "50%", background: s.status === "up" ? "#00b894" : s.status === "degraded" ? "#fdcb6e" : "#d63031" }} />
                {s.name} : {s.status}
              </div>
            ))}
          </div>
        )}
      </Show>
    </div>
  );
}
