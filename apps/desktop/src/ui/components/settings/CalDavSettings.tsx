import { createSignal, onMount, Show, For } from "solid-js";
import { useCalDavStore, type CreateCalDavAccountInput } from "../../../application/stores/caldavStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { Button } from "../common/Button";

export function CalDavSettings() {
  const { accounts, isLoading, isSyncing, fetchAccounts, createAccount, updateAccount, deleteAccount, syncAccount, testConnection } = useCalDavStore();
  const calendarStore = useCalendarStore();

  const [showForm, setShowForm] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [label, setLabel] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [calendarId, setCalendarId] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [testResult, setTestResult] = createSignal<boolean | null>(null);
  const [syncResult, setSyncResult] = createSignal<string | null>(null);

  onMount(async () => {
    await fetchAccounts();
    await calendarStore.fetchCalendars();
  });

  function resetForm() {
    setLabel("");
    setUrl("");
    setUsername("");
    setPassword("");
    setCalendarId("");
    setEditingId(null);
    setShowForm(false);
    setTestResult(null);
  }

  function startEdit(account: (typeof accounts extends () => (infer T)[] ? T : never)) {
    setLabel(account.label);
    setUrl(account.url);
    setUsername(account.username);
    setPassword("");
    setCalendarId(account.calendarId || "");
    setEditingId(account.id);
    setShowForm(true);
    setTestResult(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const input: CreateCalDavAccountInput = {
        label: label(),
        url: url(),
        username: username(),
        password: password(),
        calendarId: calendarId() || undefined,
      };

      if (editingId()) {
        await updateAccount(editingId()!, {
          label: label(),
          url: url(),
          username: username(),
          password: password() || undefined,
          calendarId: calendarId() || undefined,
        });
      } else {
        await createAccount(input);
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    try {
      const success = await testConnection({
        label: label(),
        url: url(),
        username: username(),
        password: password(),
      });
      setTestResult(success);
    } catch {
      setTestResult(false);
    }
  }

  async function handleSync(id: string) {
    setSyncResult(null);
    try {
      const result = await syncAccount(id);
      setSyncResult(`${result.imported} importe(s), ${result.updated} mis a jour`);
      setTimeout(() => setSyncResult(null), 3000);
    } catch (err) {
      setSyncResult("Erreur de synchronisation");
      setTimeout(() => setSyncResult(null), 3000);
    }
  }

  async function handleDelete(id: string) {
    await deleteAccount(id);
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
    "margin-bottom": "16px",
  };

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
        CalDAV
      </h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        Importez vos evenements depuis Google Calendar, Outlook ou tout serveur CalDAV.
      </p>

      {/* Account list */}
      <Show when={accounts().length > 0}>
        <div style={{ "margin-bottom": "16px" }}>
          <For each={accounts()}>
            {(account) => (
              <div style={{
                padding: "12px 14px",
                background: "var(--bg-elevated)",
                "border-radius": "var(--radius-md)",
                "margin-bottom": "8px",
                border: "1px solid var(--border-color)",
              }}>
                <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center" }}>
                  <div>
                    <div style={{ "font-weight": "500", color: "var(--text-primary)", "font-size": "13px" }}>
                      {account.label}
                    </div>
                    <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px" }}>
                      {account.url}
                    </div>
                    <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                      Derniere sync : {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString("fr-FR") : "jamais"}
                      {" "} | {account.syncEnabled ? "Active" : "Desactive"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Button size="sm" variant="secondary" onClick={() => handleSync(account.id)} disabled={isSyncing()}>
                      {isSyncing() ? "..." : "Sync"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => startEdit(account)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDelete(account.id)}>
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={syncResult()}>
        <div style={{ "font-size": "12px", color: "#00b894", "margin-bottom": "12px" }}>
          {syncResult()}
        </div>
      </Show>

      {/* Add/Edit form */}
      <Show when={!showForm()}>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          Ajouter un compte CalDAV
        </Button>
      </Show>

      <Show when={showForm()}>
        <div style={{
          padding: "16px",
          background: "var(--bg-elevated)",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
        }}>
          <div style={sectionStyle}>
            <label style={labelStyle}>Nom</label>
            <input type="text" value={label()} onInput={(e) => setLabel(e.target.value)} style={inputStyle} placeholder="Mon calendrier Google" />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>URL CalDAV</label>
            <input type="text" value={url()} onInput={(e) => setUrl(e.target.value)} style={inputStyle} placeholder="https://calendar.google.com/calendar/dav/..." />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Nom d'utilisateur</label>
            <input type="text" value={username()} onInput={(e) => setUsername(e.target.value)} style={inputStyle} placeholder="email@example.com" />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Mot de passe</label>
            <input type="password" value={password()} onInput={(e) => setPassword(e.target.value)} style={inputStyle} placeholder={editingId() ? "Laisser vide pour garder l'actuel" : "Mot de passe ou app password"} />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Calendrier cible</label>
            <select
              value={calendarId()}
              onChange={(e) => setCalendarId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Selectionner --</option>
              <For each={calendarStore.calendars()}>
                {(cal) => <option value={cal.id}>{cal.name}</option>}
              </For>
            </select>
            <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>
              Les evenements importes seront ajoutes a ce calendrier.
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving() || !label() || !url() || !username() || (!password() && !editingId())}>
              {saving() ? "..." : editingId() ? "Mettre a jour" : "Ajouter"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={!url() || !username() || !password()}>
              Tester
            </Button>
            <Button variant="secondary" size="sm" onClick={resetForm}>
              Annuler
            </Button>

            <Show when={testResult() !== null}>
              <span style={{ "font-size": "12px", color: testResult() ? "#00b894" : "#d63031", "margin-left": "8px" }}>
                {testResult() ? "Connexion OK" : "Echec de connexion"}
              </span>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
