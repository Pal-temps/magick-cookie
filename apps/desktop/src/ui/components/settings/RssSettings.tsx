import { createSignal } from "solid-js";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { api } from "../../../infrastructure/api/apiClient";
import { Button } from "../common/Button";

export function RssSettings() {
  const settings = useSettingsStore();
  const [retentionDays, setRetentionDays] = createSignal(settings.getRss().retentionDays);
  const [cleaning, setCleaning] = createSignal(false);
  const [cleanResult, setCleanResult] = createSignal<number | null>(null);

  function handleChange(value: number) {
    const clamped = Math.max(7, Math.min(365, value));
    setRetentionDays(clamped);
    settings.patchRss({ retentionDays: clamped });
  }

  async function handleCleanup() {
    setCleaning(true);
    setCleanResult(null);
    try {
      const data = await api.post<{ deleted: number }>("/rss-feeds/cleanup", { retentionDays: retentionDays() });
      setCleanResult(data.deleted);
    } catch (e) {
      console.error("Cleanup failed:", e);
    } finally {
      setCleaning(false);
    }
  }

  const labelStyle = {
    "font-size": "12px",
    "font-weight": "500" as const,
    color: "var(--text-muted)",
    "margin-bottom": "4px",
    display: "block",
  };

  const helpStyle = {
    "font-size": "11px",
    color: "var(--text-muted)",
    "margin-top": "4px",
  };

  const sectionStyle = {
    "margin-bottom": "24px",
  };

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>Flux RSS</h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        Configurez la retention et le nettoyage automatique des articles RSS.
      </p>

      {/* Retention */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Conservation des articles</label>
        <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
          <input
            type="number"
            min="7"
            max="365"
            value={retentionDays()}
            onInput={(e) => handleChange(Number(e.currentTarget.value))}
            style={{
              width: "80px",
              padding: "6px 10px",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              "font-size": "13px",
              "text-align": "center",
            }}
          />
          <span style={{ "font-size": "13px", color: "var(--text-primary)" }}>jours</span>
        </div>
        <div style={helpStyle}>
          Les articles plus anciens sont supprimes automatiquement lors de chaque synchronisation.
          Les articles en favoris sont toujours conserves.
        </div>
      </div>

      {/* Presets */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Presets</label>
        <div style={{ display: "flex", gap: "6px" }}>
          {[30, 60, 90, 180, 365].map((d) => (
            <Button
              size="sm"
              variant={retentionDays() === d ? "primary" : "secondary"}
              onClick={() => handleChange(d)}
            >
              {d}j
            </Button>
          ))}
        </div>
      </div>

      {/* Manual cleanup */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Nettoyage manuel</label>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Button variant="secondary" size="sm" onClick={handleCleanup} disabled={cleaning()}>
            {cleaning() ? "Nettoyage..." : "Nettoyer maintenant"}
          </Button>
          {cleanResult() !== null && (
            <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>
              {cleanResult() === 0 ? "Rien a supprimer" : `${cleanResult()} article${cleanResult()! > 1 ? "s" : ""} supprime${cleanResult()! > 1 ? "s" : ""}`}
            </span>
          )}
        </div>
        <div style={helpStyle}>
          Supprime les articles non-favoris datant de plus de {retentionDays()} jours.
        </div>
      </div>
    </div>
  );
}
