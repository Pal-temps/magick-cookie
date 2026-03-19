import { createSignal } from "solid-js";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { api } from "../../../infrastructure/api/apiClient";
import { Button } from "../common/Button";
import type { UserPreferences } from "../../../domain/models/UserPreferences";

const LAST_SYNC_KEY = "magick-cookie-last-sync";

export function DataSettings() {
  const settings = useSettingsStore();
  const [saving, setSaving] = createSignal(false);
  const [restoring, setRestoring] = createSignal(false);
  const [feedback, setFeedback] = createSignal<{ type: "success" | "error"; msg: string } | null>(null);
  const [lastSync, setLastSync] = createSignal<string | null>(localStorage.getItem(LAST_SYNC_KEY));

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/user-preferences", settings.getSnapshot());
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
      showFeedback("success", "Preferences sauvegardees sur le serveur.");
    } catch (e) {
      showFeedback("error", "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const data = await api.get<UserPreferences | null>("/user-preferences");
      if (!data) {
        showFeedback("error", "Aucune preference trouvee sur le serveur.");
        return;
      }
      settings.importFromSync(data);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
      showFeedback("success", "Preferences restaurees depuis le serveur.");
    } catch (e) {
      showFeedback("error", "Erreur lors de la restauration.");
    } finally {
      setRestoring(false);
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "Jamais";
    try {
      return new Date(iso).toLocaleString("fr-FR");
    } catch {
      return iso;
    }
  }

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
        Synchronisation des preferences
      </h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        Seules les preferences d'interface sont synchronisees. Les cles API, mots de passe et tokens ne sont jamais inclus.
      </p>

      <div style={{ display: "flex", gap: "8px", "margin-bottom": "16px" }}>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving()}>
          {saving() ? "..." : "Sauvegarder sur le serveur"}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleRestore} disabled={restoring()}>
          {restoring() ? "..." : "Restaurer depuis le serveur"}
        </Button>
      </div>

      <div style={{ "font-size": "12px", color: "var(--text-muted)", "margin-bottom": "12px" }}>
        Derniere synchronisation : {formatDate(lastSync())}
      </div>

      {feedback() && (
        <div style={{
          padding: "8px 12px",
          "border-radius": "var(--radius-md)",
          "font-size": "13px",
          background: feedback()!.type === "success" ? "rgba(0,184,148,0.1)" : "rgba(214,48,49,0.1)",
          color: feedback()!.type === "success" ? "#00b894" : "#d63031",
        }}>
          {feedback()!.msg}
        </div>
      )}
    </div>
  );
}
