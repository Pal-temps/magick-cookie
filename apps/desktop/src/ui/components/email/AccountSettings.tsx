import { createSignal, For, Show } from "solid-js";
import type { EmailAccount, CreateEmailAccountDTO } from "../../../domain/models/Email";
import { api } from "../../../infrastructure/api/apiClient";
import { Button } from "../common/Button";

interface AccountSettingsProps {
  accounts: EmailAccount[];
  onAdd: (input: CreateEmailAccountDTO) => Promise<EmailAccount>;
  onRemove: (id: string) => void;
  onTestConnection: (input: CreateEmailAccountDTO) => Promise<boolean>;
  onClose: () => void;
}

const PRESETS: Record<string, { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number; smtpSecure: boolean; selfSigned?: boolean }> = {
  Gmail: { imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true },
  Outlook: { imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecure: false },
  Yahoo: { imapHost: "imap.mail.yahoo.com", imapPort: 993, smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpSecure: true },
  Apple: { imapHost: "imap.mail.me.com", imapPort: 993, smtpHost: "smtp.mail.me.com", smtpPort: 587, smtpSecure: false },
  "Proton Bridge": { imapHost: "127.0.0.1", imapPort: 1143, smtpHost: "127.0.0.1", smtpPort: 1025, smtpSecure: false },
  OVH: { imapHost: "imap.mail.ovh.net", imapPort: 993, smtpHost: "ssl0.ovh.net", smtpPort: 465, smtpSecure: true },
  "Self-hosted": { imapHost: "mail.paltemps.fr", imapPort: 1993, smtpHost: "mail.paltemps.fr", smtpPort: 1587, smtpSecure: false, selfSigned: true },
};

const EMAIL_DOMAIN_PRESET: Record<string, string> = {
  "gmail.com": "Gmail",
  "googlemail.com": "Gmail",
  "outlook.com": "Outlook",
  "hotmail.com": "Outlook",
  "live.com": "Outlook",
  "yahoo.com": "Yahoo",
  "yahoo.fr": "Yahoo",
  "icloud.com": "Apple",
  "me.com": "Apple",
  "mac.com": "Apple",
  "ovh.net": "OVH",
  "ovh.com": "OVH",
  "paltemps.fr": "Self-hosted",
};

export function AccountSettings(props: AccountSettingsProps) {
  const [showForm, setShowForm] = createSignal(false);
  const [label, setLabel] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [imapHost, setImapHost] = createSignal("");
  const [imapPort, setImapPort] = createSignal(993);
  const [smtpHost, setSmtpHost] = createSignal("");
  const [smtpPort, setSmtpPort] = createSignal(587);
  const [smtpSecure, setSmtpSecure] = createSignal(false);
  const [selfSigned, setSelfSigned] = createSignal(false);
  const [isTesting, setIsTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<{ success: boolean; imap?: boolean; smtp?: boolean } | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);

  function applyPreset(name: string) {
    const p = PRESETS[name];
    if (!p) return;
    setImapHost(p.imapHost);
    setImapPort(p.imapPort);
    setSmtpHost(p.smtpHost);
    setSmtpPort(p.smtpPort);
    setSmtpSecure(p.smtpSecure);
    setSelfSigned(p.selfSigned ?? false);
  }

  function handleEmailInput(value: string) {
    setEmail(value);
    if (!username()) setUsername(value);
    const domain = value.split("@")[1]?.toLowerCase();
    if (domain && EMAIL_DOMAIN_PRESET[domain] && !imapHost()) {
      applyPreset(EMAIL_DOMAIN_PRESET[domain]);
    }
  }

  function buildInput(): CreateEmailAccountDTO {
    return {
      label: label(),
      email: email(),
      imapHost: imapHost(),
      imapPort: imapPort(),
      imapSecure: true,
      smtpHost: smtpHost(),
      smtpPort: smtpPort(),
      smtpSecure: smtpSecure(),
      username: username(),
      password: password(),
      selfSigned: selfSigned(),
    };
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const input = buildInput();
      const data = await api.post<{ success: boolean; imap: boolean; smtp: boolean }>("/email-accounts/test-connection", input);
      setTestResult(data);
    } catch {
      setTestResult({ success: false });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await props.onAdd(buildInput());
      resetForm();
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setShowForm(false);
    setLabel(""); setEmail(""); setUsername(""); setPassword("");
    setImapHost(""); setImapPort(993); setSmtpHost(""); setSmtpPort(587); setSmtpSecure(false); setSelfSigned(false);
    setTestResult(null);
  }

  const inputStyle = {
    width: "100%",
    padding: "6px 10px",
    background: "var(--bg-base)",
    border: "1px solid var(--border-color)",
    "border-radius": "var(--radius-sm)",
    color: "var(--text-primary)",
    "font-size": "12px",
    "box-sizing": "border-box" as const,
  };

  const labelStyle = {
    "font-size": "11px",
    color: "var(--text-muted)",
    "margin-bottom": "4px",
    display: "block" as const,
  };

  return (
    <div style={{ padding: "20px", height: "100%", "overflow-y": "auto" }}>
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "16px" }}>
        <h2 style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", margin: "0" }}>
          Comptes email
        </h2>
        <Button size="sm" variant="ghost" onClick={props.onClose}>Fermer</Button>
      </div>

      {/* Existing accounts */}
      <For each={props.accounts}>
        {(acc) => (
          <div style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            padding: "10px 12px",
            background: "var(--bg-surface)",
            "border-radius": "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            "margin-bottom": "8px",
          }}>
            <div>
              <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>{acc.label}</div>
              <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>{acc.email}</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => props.onRemove(acc.id)}>Supprimer</Button>
          </div>
        )}
      </For>

      {/* Add button / form */}
      <Show when={!showForm()}>
        <Button size="sm" variant="primary" onClick={() => setShowForm(true)} style={{ "margin-top": "8px" }}>
          + Ajouter un compte
        </Button>
      </Show>

      <Show when={showForm()}>
        <div style={{
          "margin-top": "12px",
          padding: "16px",
          background: "var(--bg-surface)",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
        }}>
          <h3 style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)", margin: "0 0 12px 0" }}>
            Nouveau compte
          </h3>

          {/* Presets */}
          <div style={{ "margin-bottom": "12px" }}>
            <span style={labelStyle}>Presets</span>
            <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
              {Object.keys(PRESETS).map((name) => (
                <Button size="sm" variant="secondary" onClick={() => applyPreset(name)}>{name}</Button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "10px" }}>
            <div>
              <span style={labelStyle}>Label</span>
              <input style={inputStyle} value={label()} onInput={(e) => setLabel(e.target.value)} placeholder="Perso" />
            </div>
            <div>
              <span style={labelStyle}>Email</span>
              <input style={inputStyle} value={email()} onInput={(e) => handleEmailInput(e.target.value)} placeholder="john@gmail.com" />
            </div>
            <div>
              <span style={labelStyle}>Nom d'utilisateur</span>
              <input style={inputStyle} value={username()} onInput={(e) => setUsername(e.target.value)} placeholder="john@gmail.com" />
            </div>
            <div>
              <span style={labelStyle}>Mot de passe</span>
              <input style={inputStyle} type="password" value={password()} onInput={(e) => setPassword(e.target.value)} placeholder="App password" />
            </div>
            <div>
              <span style={labelStyle}>IMAP Host</span>
              <input style={inputStyle} value={imapHost()} onInput={(e) => setImapHost(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>IMAP Port</span>
              <input style={inputStyle} type="number" value={imapPort()} onInput={(e) => setImapPort(Number(e.target.value))} />
            </div>
            <div>
              <span style={labelStyle}>SMTP Host</span>
              <input style={inputStyle} value={smtpHost()} onInput={(e) => setSmtpHost(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>SMTP Port</span>
              <input style={inputStyle} type="number" value={smtpPort()} onInput={(e) => setSmtpPort(Number(e.target.value))} />
            </div>
          </div>

          {/* Self-signed certificate checkbox */}
          <div style={{ "margin-top": "10px", display: "flex", "align-items": "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="selfSigned"
              checked={selfSigned()}
              onChange={(e) => setSelfSigned(e.target.checked)}
              style={{ width: "14px", height: "14px" }}
            />
            <label for="selfSigned" style={{ "font-size": "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
              Certificat auto-signe (self-hosted / dev local)
            </label>
          </div>

          {/* Test result */}
          <Show when={testResult() !== null}>
            <div style={{
              "margin-top": "10px",
              padding: "6px 10px",
              "border-radius": "var(--radius-sm)",
              "font-size": "12px",
              background: testResult()?.success ? "#22c55e22" : "#ef444422",
              color: testResult()?.success ? "#22c55e" : "#ef4444",
            }}>
              {testResult()?.success
                ? "IMAP + SMTP OK !"
                : `Echec — IMAP: ${testResult()?.imap ? "OK" : "KO"}, SMTP: ${testResult()?.smtp ? "OK" : "KO"}`}
            </div>
          </Show>

          <div style={{ display: "flex", gap: "8px", "margin-top": "14px", "justify-content": "flex-end" }}>
            <Button size="sm" variant="ghost" onClick={resetForm}>Annuler</Button>
            <Button size="sm" variant="secondary" onClick={handleTest} disabled={isTesting()}>
              {isTesting() ? "Test..." : "Tester"}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} disabled={isSaving() || !label() || !email() || !password()}>
              {isSaving() ? "..." : "Ajouter"}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
